"""The operator's window: health, presence, the queue and the error log.

Three promises shape everything below.

**Numbers come from rows.** «کاربران آنلاین» is the presence table the middleware
writes from real requests, not a heartbeat widget the browser could fake, and the
capacity line carries the machine values it was computed from, so a disagreement
with the number is a conversation about ratios rather than about a mystery.

**The door is the operator's, not the code's.** Switching the waiting room on or
off is a checkbox; these views only report pressure and move the line. The queue
page is served from here rather than from the React app for the same reason: a busy
shop has to be able to show its own waiting room.

**Errors are written where staff already look.** Sentry stays the deep end for
tracebacks; this table is the shop's own notebook — automatic for anything that
raised, and open to a visitor who wants to say «خطا داد» without writing an e-mail.

Access follows the existing operations rule: a staff session or the ops token, and
a plain 404 to everyone else.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta

from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db import connection
from django.db.models import Count, Q
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.utils import timezone
from django.utils.cache import add_never_cache_headers
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from rest_framework import status as http_status
from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .admission import admit_waiting, admission_answer, queue_page_html, settings_row_safe, state_for
from .capacity import effective_limit, pressure, redact
from .models import (
    CapacitySettings, Comment, Order, PlatformFeedback, PresenceBeat, Product, QueueTicket,
    ResourceSample, SystemLogEntry, User,
)
from .operational import has_operations_access

# Per worker, so «چند دقیقه است بالا ست» means what it says.
PROCESS_STARTED_AT = timezone.now()

MAX_CLIENT_MESSAGE = 4000
MAX_CLIENT_NOTE = 1200



class ClientReportThrottle(ScopedRateThrottle):
    """A report endpoint that is open must also be cheap to leave open.

    It reuses the feedback budget: a visitor whose app is throwing errors is
    allowed to say so a few times, and a script cannot fill the notebook.
    """

    scope = 'feedback'


def _not_found() -> Response:
    """The same nothing the readiness endpoint answers, built fresh per request."""
    return Response({'detail': 'Not found.'}, status=http_status.HTTP_404_NOT_FOUND)


def _window(row: CapacitySettings) -> timezone.datetime:
    return timezone.now() - timedelta(minutes=max(1, row.activity_window_minutes))


def _page(html: str) -> HttpResponse:
    response = HttpResponse(html, content_type='text/html; charset=utf-8')
    add_never_cache_headers(response)
    return response


# --------------------------------------------------------------------------
# the waiting room, as an address of its own
# --------------------------------------------------------------------------

@never_cache
def queue_view(request):
    """A status page for the line, reachable when nothing else is.

    A held visitor is normally answered on the page they asked for, so this URL
    exists for the other two cases: someone who types it to see where they stand,
    and someone whose place came up while they were reading. Both get an honest
    answer instead of a redirect loop, and both move the line along — which is what
    makes the queue drain without a socket, a push service, or a promise about a
    time nobody can keep.
    """
    row = CapacitySettings.load()
    limit, _basis = effective_limit(settings=settings_row_safe(row))
    if row.queue_enabled:
        admit_waiting(row, limit)

    state = state_for(request, row, limit)
    if not row.queue_enabled or state['admitted'] or state['spare_places'] > 0:
        target = (state['ticket'].path if state['ticket'] else '') or '/'
        if not target.startswith('/') or target.startswith('//'):
            target = '/'
        response = HttpResponseRedirect(target)
        add_never_cache_headers(response)
        return response

    snapshot = {**pressure(row), 'position': state['position'], 'capacity': limit}
    return _page(queue_page_html(snapshot, state['ticket'], row))


@never_cache
@require_GET
def admission_state(request):
    """«کجای صف من است؟» — the one call a waiting storefront may make by itself.

    Deliberately public and deliberately cheap: it says nothing about anybody but
    the visitor asking, and it is the only thing an app outside the door is allowed
    to poll, so a waiting room cannot be turned into a stampede of status requests.
    """
    response = JsonResponse(admission_answer(request))
    add_never_cache_headers(response)
    return response


# --------------------------------------------------------------------------
# health
# --------------------------------------------------------------------------

@never_cache
def health(request):
    """One payload for the console's health tab.

    Answers with JSON to a browser session and to an ops-token probe alike, so the
    same URL serves the monitoring box and the staff screen. Non-operators get a
    plain 404 with nothing in it, which is what the existing readiness endpoint
    does — an attacker learns nothing about whether this console exists.
    """
    from django.http import JsonResponse

    if not has_operations_access(request):
        response = JsonResponse({'detail': 'Not found.'}, status=404)
        add_never_cache_headers(response)
        return response

    row = CapacitySettings.load()
    snapshot = pressure(row)
    since = _window(row)
    today = timezone.localdate()
    day_ago = timezone.now() - timedelta(hours=24)

    samples = [
        {
            'at': sample.created_at.isoformat(),
            'online': sample.online_users + sample.online_guests,
            'online_users': sample.online_users,
            'online_guests': sample.online_guests,
            'waiting': sample.queue_waiting,
            'capacity': sample.capacity_limit,
            'basis': sample.capacity_basis,
            'load_1m': sample.load_1m,
            'memory_available_mb': sample.memory_available_mb,
            'disk_free_mb': sample.disk_free_mb,
        }
        for sample in ResourceSample.objects.order_by('-created_at')[:90]
    ]

    beats = (
        PresenceBeat.objects.filter(last_seen_at__gte=since)
        .select_related('user')
        .order_by('-last_seen_at')
    )
    open_logs = SystemLogEntry.objects.filter(resolved_at__isnull=True)
    payload = {
        **snapshot,
        'uptime': {
            'process_seconds': int((timezone.now() - PROCESS_STARTED_AT).total_seconds()),
            'label': _human_duration(int((timezone.now() - PROCESS_STARTED_AT).total_seconds())),
            'started_at': PROCESS_STARTED_AT.isoformat(),
            'note': 'زمان کاری همین پروسه؛ با چند worker این عدد برای هر پروسه جدا خوانده می‌شود.',
        },
        'database': {
            'vendor': connection.vendor,
            'label': {'postgresql': 'PostgreSQL', 'sqlite': 'SQLite (محلی/آزمون)'}.get(connection.vendor, connection.vendor),
            'file': _basename(connection.settings_dict.get('NAME') or ''),
        },
        'queue': {
            'enabled': row.queue_enabled,
            'max_minutes': row.queue_max_minutes,
            'waiting': QueueTicket.objects.filter(status=QueueTicket.STATUS_WAITING).count(),
            'admitted_recently': QueueTicket.objects.filter(
                status=QueueTicket.STATUS_ADMITTED, admitted_at__gte=since
            ).count(),
            'next_positions': [
                {'position': index + 1, 'path': ticket.path, 'waiting_minutes': ticket.minutes_waiting()}
                for index, ticket in enumerate(
                    QueueTicket.objects.filter(status=QueueTicket.STATUS_WAITING).order_by('created_at')[:10]
                )
            ],
        },
        'presence': {
            'window_minutes': row.activity_window_minutes,
            'since': since.isoformat(),
            'staff': sum(1 for beat in beats if beat.is_staff),
            'recent': [
                {
                    'identity': beat.identity.split(':', 1)[-1][:8],
                    'kind': beat.kind,
                    'kind_label': 'کاربر' if beat.kind == PresenceBeat.KIND_USER else 'مهمان',
                    'path': beat.path,
                    'requests': beat.requests,
                    'last_seen_at': beat.last_seen_at.isoformat(),
                    'who': _user_label(beat),
                    'is_staff': beat.is_staff,
                }
                for beat in beats[:40]
            ],
        },
        'signals': {
            'users_total': User.objects.count(),
            'users_active': User.objects.filter(is_active=True).count(),
            'products_published': Product.objects.filter(status='published').count(),
            'orders_today': Order.objects.filter(created_at__date=today).count(),
            'orders_24h': Order.objects.filter(created_at__gte=day_ago).count(),
            'reviews_today': Comment.objects.filter(created__gte=day_ago, active=True).count(),
            'open_logs': open_logs.count(),
            'errors_24h': open_logs.filter(level=SystemLogEntry.LEVEL_ERROR, last_at__gte=day_ago).count(),
        },
        'samples': list(reversed(samples)),
    }
    response = JsonResponse(payload)
    add_never_cache_headers(response)
    return response


def _human_duration(seconds: int) -> str:
    days, rest = divmod(max(seconds, 0), 86400)
    hours, rest = divmod(rest, 3600)
    minutes = rest // 60
    parts = ([f'{days} روز'] if days else []) + ([f'{hours} ساعت'] if hours else []) + [f'{minutes} دقیقه']
    return ' '.join(parts)


def _basename(value: str) -> str:
    return value.rsplit('/', 1)[-1] if value else ''


def _user_label(beat) -> str:
    if beat.user_id and beat.user is not None:
        return beat.user.get_full_name() or beat.user.get_username()
    return 'مهمان'


# --------------------------------------------------------------------------
# the system log
# --------------------------------------------------------------------------

@api_view(['get'])
def log_list(request):
    """The notebook: grouped, counted, and filterable by whether anyone has looked.

    The summary and the per-source figures are computed over the whole filtered
    range rather than the page, because the question this list answers is «what is
    the pattern», and a pattern does not fit in twenty rows.
    """
    if not has_operations_access(request):
        return _not_found()

    entries = SystemLogEntry.objects.select_related('user', 'resolved_by')
    level = request.GET.get('level')
    if level in (SystemLogEntry.LEVEL_ERROR, SystemLogEntry.LEVEL_WARNING, SystemLogEntry.LEVEL_NOTICE):
        entries = entries.filter(level=level)
    source = (request.GET.get('source') or '').strip()
    if source:
        entries = entries.filter(source__icontains=source)
    if request.GET.get('open') in ('1', 'true'):
        entries = entries.filter(resolved_at__isnull=True)
    search = (request.GET.get('search') or '').strip()
    if search:
        entries = entries.filter(
            Q(title__icontains=search) | Q(message__icontains=search) | Q(path__icontains=search)
        )
    hours = request.GET.get('hours')
    if hours and hours.isdigit():
        entries = entries.filter(last_at__gte=timezone.now() - timedelta(hours=int(hours)))

    try:
        size = min(int(request.GET.get('page_size') or 20), 100)
    except (TypeError, ValueError):
        size = 20
    paginator = Paginator(entries, max(5, size))
    try:
        page = paginator.page(request.GET.get('page') or 1)
    except (PageNotAnInteger, EmptyPage):
        page = paginator.page(1)

    recent = SystemLogEntry.objects.filter(last_at__gte=timezone.now() - timedelta(hours=24))
    by_level = dict(recent.values('level').annotate(total=Count('id')).values_list('level', 'total'))
    by_source = list(
        SystemLogEntry.objects.filter(resolved_at__isnull=True)
        .values('source')
        .annotate(groups=Count('id'), occurrences=Count('count'))
        .order_by('-occurrences')[:8]
    )

    return Response({
        'count': paginator.count,
        'page': page.number,
        'pages': paginator.num_pages,
        'summary': {
            'error_24h': by_level.get(SystemLogEntry.LEVEL_ERROR, 0),
            'warning_24h': by_level.get(SystemLogEntry.LEVEL_WARNING, 0),
            'notice_24h': by_level.get(SystemLogEntry.LEVEL_NOTICE, 0),
            'open': SystemLogEntry.objects.filter(resolved_at__isnull=True).count(),
            'occurrences_open': SystemLogEntry.objects.filter(resolved_at__isnull=True)
            .aggregate(total=Count('count'))['total'] or 0,
        },
        'sources': by_source,
        'results': [_log_row(entry) for entry in page.object_list],
    })


def _log_row(entry) -> dict:
    return {
        'id': entry.pk,
        'level': entry.level,
        'level_label': entry.get_level_display(),
        'source': entry.source,
        'title': entry.title,
        'message': entry.message,
        'path': entry.path,
        'method': entry.method,
        'status_code': entry.status_code,
        'count': entry.count,
        'first_at': entry.first_at.isoformat(),
        'last_at': entry.last_at.isoformat(),
        'user': entry.user_label,
        'is_open': entry.is_open,
        'resolved_at': entry.resolved_at.isoformat() if entry.resolved_at else None,
        'resolved_by': entry.resolved_by.get_username() if entry.resolved_by_id else None,
        'note': entry.note,
        # The context was cleaned on the way in; it is cleaned again on the way out
        # so a hand-edited row cannot leak what the writer was told to hide.
        'context': redact(entry.context or {}),
    }


@api_view(['post'])
def log_resolve(request, pk: int):
    """Close a line, or reopen it. The note is the handover to the next person."""
    if not has_operations_access(request):
        return _not_found()

    entry = SystemLogEntry.objects.filter(pk=pk).first()
    if entry is None:
        return _not_found()

    user = request.user if getattr(request.user, 'is_authenticated', False) else None
    note = str(request.data.get('note') or '')[:1000]
    if str(request.data.get('action') or '') == 'reopen':
        entry.resolved_at = None
        entry.resolved_by = None
    else:
        entry.resolved_at = timezone.now()
        entry.resolved_by = user
    entry.note = note
    entry.save(update_fields=['resolved_at', 'resolved_by', 'note'])
    return Response(_log_row(entry))


@api_view(['post'])
@throttle_classes([ClientReportThrottle])
def client_report(request):
    """A visitor's «اینجا خطا داد», in the same list staff read.

    Open on purpose — a report that needs an account is a report nobody files — and
    therefore small and cleaned: whatever arrives is cut to a few kilobytes and run
    through the same redaction the automatic entries get, so no credential ends up
    living in an error notebook. Repeated identical reports raise a counter instead
    of a row, which is also what makes leaving it open affordable.
    """
    data = request.data if isinstance(request.data, dict) else {}
    title = str(data.get('title') or 'گزارش خطای سمت کاربر').strip()[:200]
    message = str(data.get('message') or '')[:MAX_CLIENT_MESSAGE]
    note = str(data.get('note') or '')[:MAX_CLIENT_NOTE]
    path = str(data.get('path') or '')[:200]
    source = (str(data.get('source') or 'frontend').strip()[:40] or 'frontend')
    level = data.get('level') if data.get('level') in ('error', 'warning', 'notice') else 'error'

    if not (message or note or path):
        return Response(
            {'error': 'برای ثبت گزارش، متن خطا یا نشانی صفحه لازم است.'},
            status=http_status.HTTP_400_BAD_REQUEST,
        )

    # Grouped on the reported problem, not on the visitor, so ten people hitting the
    # same broken page read as one problem that is annoying ten people.
    mark = hashlib.sha1(f'{title}|{message[:200]}|{path}'.encode('utf-8')).hexdigest()[:12]
    authenticated = bool(getattr(request.user, 'is_authenticated', False))
    user = request.user if authenticated else None

    entry = SystemLogEntry.record(
        source=f'{source}:{mark}',
        title=title,
        level=level,
        message=message or note,
        path=path,
        method='CLIENT',
        user=user,
        context={
            'user_agent': request.headers.get('User-Agent', '')[:200],
            'note': note,
            'reported_by_client': True,
        },
    )
    if entry is None:
        return Response({'error': 'گزارش ثبت نشد.'}, status=http_status.HTTP_503_SERVICE_UNAVAILABLE)

    # Someone who took the trouble to write a sentence deserves to reach the inbox
    # staff already read; a machine line alone is often not enough to fix anything.
    if note:
        PlatformFeedback.objects.create(
            kind='other',
            subject=f'گزارش خطای کاربر ({source})',
            message=note[:3000],
            name=user.get_username() if authenticated else '',
            user=user,
        )

    return Response(
        {'reported': True, 'id': entry.pk, 'count': entry.count},
        status=http_status.HTTP_201_CREATED,
    )
