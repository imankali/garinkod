"""The door: presence bookkeeping, and a waiting room when the operator opens it.

A traffic light is an easy way to take a shop down by accident, so this module is
written to fail open:

* anything raising inside the middleware lets the request through;
* assets, the admin and the monitoring probes are never held, so a queued
  visitor's app can still load what it needs and a health check never reports an
  outage because the waiting room is working;
* staff walk past the line (configurable) so whoever has to fix the site can;
* nobody waits past the configured ceiling, whatever the number says;
* the line moves by itself, oldest first, as places free up;
* people already inside are never asked to leave because the hall filled up —
  nobody is thrown out of a checkout they are standing in.

Occupancy is the presence table rather than a counter in memory, because with
several workers the rules above need a number everybody agrees on. The visitor's
place in line is keyed by the same session identity the cart already uses, so there
is no second cookie to lose: the worst case of a phone changing networks is that its
owner takes the end of the line again, which costs a minute and not a customer.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone
from django.utils.html import escape

from .capacity import record_activity, sample_if_due, visitor_key

logger = logging.getLogger(__name__)

# Paths that answer even when people are waiting.
EXEMPT_PATHS = (
    '/admin/', '/media/', '/static/', '/health', '/ops/metrics', '/favicon',
    '/robots.txt', '/sitemap.xml', '/llms.txt', '/queue',
)

# How often a waiting page (or a waiting app) asks again. Short enough that the
# line feels alive; long enough that a hundred waiting phones are not a hundred
# requests a second against the very server they are waiting for.
REFRESH_SECONDS = 15

API_PREFIX = '/api/'

# The one API call a waiting visitor is allowed to make: asking where they stand.
# Holding it would mean the queue cannot be left, since the answer to «am I in?»
# can only come from outside the line.
ADMISSION_QUERY_PATH = '/api/ops/admission/'


def is_api(request) -> bool:
    return request.path.startswith(API_PREFIX)


def can_be_held(request) -> bool:
    """Is this a read that a person would rather wait for than lose?

    Only GET/HEAD: a POST is a farmer pressing «ثبت سفارش», and a queue that
    swallows it is worse than a slow one. A visitor who is not yet admitted cannot
    reach a POST anyway — the page that would have carried it was held first.
    """
    if request.method not in ('GET', 'HEAD'):
        return False
    if is_api(request):
        # The API is held too: otherwise a queued visitor's app keeps hammering
        # the database that is the whole reason for the line.
        return request.path != ADMISSION_QUERY_PATH
    if any(request.path.startswith(prefix) for prefix in EXEMPT_PATHS):
        return False
    accept = request.headers.get('Accept', '')
    return 'text/html' in accept or accept in ('', '*/*')


def settings_row_safe(row):
    """A settings row that cannot produce a nonsense limit.

    A fixed strategy with no number in it would leave the shop with a ceiling of
    nothing; the measured number is used instead and the console says why, rather
    than the door being thrown wide open.
    """
    from .models import CapacitySettings

    if row.strategy == CapacitySettings.STRATEGY_FIXED and not row.fixed_limit:
        clone = CapacitySettings(pk=1, strategy=CapacitySettings.STRATEGY_AUTO)
        for field in (
            'users_per_cpu_core', 'users_per_gb_ram', 'safety_percent', 'derate_load_percent',
            'activity_window_minutes', 'sample_interval_seconds', 'queue_enabled',
            'queue_max_minutes', 'queue_message', 'bypass_staff',
        ):
            setattr(clone, field, getattr(row, field))
        return clone
    return row


def occupancy_excluding(identity: str, row) -> int:
    """How many *other* people are inside right now.

    The visitor being measured is left out, otherwise a shop with one free place
    and one visitor at the door counts them against themselves and queues them out
    of a hall they could have walked into.
    """
    from .models import PresenceBeat

    since = timezone.now() - timedelta(minutes=max(1, row.activity_window_minutes))
    return PresenceBeat.objects.filter(last_seen_at__gte=since).exclude(identity=identity).count()


def admit_waiting(row, limit: int) -> tuple[int, int]:
    """Let as many of the oldest waiting people in as there are places.

    Returns ``(admitted, still_waiting)``. Patience is capped on purpose: after
    ``queue_max_minutes`` a visitor is admitted whatever the pressure, because a
    line that never ends is how a shop loses a customer permanently rather than
    slowing them down for a minute.
    """
    from .models import PresenceBeat, QueueTicket

    now = timezone.now()
    waiting = list(
        QueueTicket.objects.filter(status=QueueTicket.STATUS_WAITING).order_by('created_at', 'id')[:200]
    )
    if not waiting:
        return 0, 0

    # Somebody still standing in the line may have been counted inside by their own
    # last request — a phone that is polling the status endpoint is generating beats.
    # Their own activity must not be what keeps them waiting.
    beats = set(
        PresenceBeat.objects.filter(
            last_seen_at__gte=now - timedelta(minutes=max(1, row.activity_window_minutes))
        ).values_list('identity', flat=True)
    )
    waiting_identities = {f'g:{ticket.key}' for ticket in waiting}
    inside = len(beats) - len(beats & waiting_identities)
    free = max(limit - inside, 0)
    deadline = now - timedelta(minutes=max(1, row.queue_max_minutes))

    admitted = 0
    for ticket in waiting:
        # A free place, or patience that has run out: either way the door opens.
        if free <= 0 and ticket.created_at > deadline:
            break
        ticket.status = QueueTicket.STATUS_ADMITTED
        ticket.admitted_at = now
        ticket.save(update_fields=['status', 'admitted_at'])
        free -= 1
        admitted += 1

    return admitted, QueueTicket.objects.filter(status=QueueTicket.STATUS_WAITING).count()


def state_for(request, row=None, limit: int | None = None) -> dict:
    """Everything one visitor needs to know about their place in line.

    Shared by the middleware, the waiting page and the small API the storefront
    polls, so «where am I?» can never mean two different things in three places.
    """
    from .capacity import effective_limit, presence_identity
    from .models import CapacitySettings, QueueTicket

    row = row or CapacitySettings.load()
    if limit is None:
        limit, _basis = effective_limit(settings=settings_row_safe(row))
    identity, _user_pk, _staff = presence_identity(request)
    key = visitor_key(request)
    ticket = QueueTicket.objects.filter(key=key).first()
    inside = occupancy_excluding(identity, row)

    return {
        'key': key,
        'ticket': ticket,
        'admitted': bool(ticket and ticket.status == QueueTicket.STATUS_ADMITTED),
        'capacity': limit,
        'inside_others': inside,
        'spare_places': max(limit - inside, 0),
        'position': ticket.position if ticket else 0,
        'waiting_minutes': ticket.minutes_waiting() if ticket else 0,
        'refresh_seconds': REFRESH_SECONDS,
        'queue_enabled': row.queue_enabled,
        'queue_max_minutes': row.queue_max_minutes,
    }


class AdmissionMiddleware:
    """Record who is here, sample the machine, and hold the line when told to."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            record_activity(request)
            sample_if_due()
            held = self.hold(request)
            if held is not None:
                return held
        except Exception:  # pragma: no cover - the door never causes the outage
            logger.exception('admission skipped after an error on %s', request.path)

        return self.get_response(request)

    def hold(self, request):
        from .models import CapacitySettings, QueueTicket

        if not can_be_held(request):
            return None

        row = CapacitySettings.load()
        if not row.queue_enabled:
            return None

        user = getattr(request, 'user', None)
        if row.bypass_staff and user is not None and getattr(user, 'is_authenticated', False) and user.is_staff:
            return None

        state = state_for(request, row)
        # Already through the door, or a place still free: no ceremony.
        if state['admitted'] or state['spare_places'] > 0:
            return None

        # A held request is also the moment the line is checked: whoever has waited
        # past the ceiling walks in here, whether or not a place came free.
        admit_waiting(row, state['capacity'])
        if QueueTicket.objects.filter(key=state['key'], status=QueueTicket.STATUS_ADMITTED).exists():
            return None

        ticket = state['ticket']
        if ticket is None:
            ticket = QueueTicket.objects.create(key=state['key'], path=request.path[:200])
            state['ticket'] = ticket
            state['position'] = ticket.position
        elif not is_api(request):
            # Where they wanted to go is a page, not the app's next data call; the
            # queue view hands them there once their place comes up.
            QueueTicket.objects.filter(pk=ticket.pk).update(path=request.path[:200])
        return hold_response(request, row, state)


def hold_response(request, row, state: dict):
    """What a held visitor gets: a page for a page, an answer for an API call.

    The waiting page is written by the API process rather than fetched from the
    storefront, because a shop under load has to be able to show its own door — and
    a page that needs the bundle to explain that the bundle is slow is a page that
    cannot load. The API answer is 503 with ``Retry-After``, which tells a client
    «wait» instead of «break».
    """
    from django.http import HttpResponse, JsonResponse

    if is_api(request):
        response = JsonResponse({
            'error': (
                'سایت در این لحظه شلوغ است. شما در صف هستید و به ترتیب ورود وارد '
                'می‌شوید؛ لازم نیست پی‌در‌پی تلاش کنید.'
            ),
            'code': 'shop_overloaded',
            'status': 503,
            'retry_after': REFRESH_SECONDS,
            'queue': {
                'position': state['position'],
                'waiting_minutes': state['waiting_minutes'],
                'capacity': state['capacity'],
                'max_wait_minutes': state['queue_max_minutes'],
            },
        }, status=503)
        response['Retry-After'] = str(REFRESH_SECONDS)
        response['Cache-Control'] = 'no-store'
        return response

    snapshot = {**state, 'queue_message': row.queue_message}
    response = HttpResponse(
        queue_page_html(snapshot, state['ticket'], row), content_type='text/html; charset=utf-8'
    )
    response['Cache-Control'] = 'no-store'
    response['X-Robots-Tag'] = 'noindex,nofollow'
    return response


def admission_answer(request) -> dict:
    """The JSON the storefront polls while it waits.

    It is the only answer a visitor outside the door may ask for, so it is small,
    public to whoever holds a ticket, and honest: the position and the ceiling on
    patience, never a promise about when the line will move.
    """
    from .capacity import pressure
    from .models import CapacitySettings

    row = CapacitySettings.load()
    limit, basis = effective_limit_measured(row)
    state = state_for(request, row, limit)
    if row.queue_enabled and not state['admitted']:
        # Asking is also the moment the line moves: whoever checks gets admitted
        # here rather than on the next page load, and the ceiling on patience is
        # honoured even when the hall never empties.
        admit_waiting(row, limit)
        state = state_for(request, row, limit)

    snapshot = pressure(row)
    return {
        'state': 'inside' if (state['admitted'] or state['spare_places'] > 0 or not row.queue_enabled) else 'waiting',
        'position': state['position'],
        'waiting_minutes': state['waiting_minutes'],
        'refresh_seconds': REFRESH_SECONDS,
        'capacity': limit,
        'capacity_basis': basis,
        'inside_now': snapshot['inside_now'],
        'waiting_now': snapshot['waiting_now'],
        'message': (row.queue_message or '').strip(),
    }


def effective_limit_measured(row):
    from .capacity import effective_limit

    return effective_limit(settings=settings_row_safe(row))


def queue_page_html(snapshot: dict, ticket, row) -> str:
    """The waiting page, self-contained.

    It refreshes itself so nothing is asked of the visitor, and it promises no
    finishing time, because the shop does not know when a place will free up and a
    made-up «۳ دقیقه دیگر» is the fastest way to lose someone's patience and their
    order both.
    """
    position = int(snapshot.get('position') or 0)
    ahead = max(position - 1, 0)
    message = (getattr(row, 'queue_message', '') or '').strip() or (
        'سایت در این لحظه شلوغ است. جایتان در صف نگه داشته شده و هر جا که خالی شود، '
        'به ترتیب ورود، همان صفحه‌ای که می‌خواستید باز می‌شود.'
    )
    if position:
        headline = f'شما نفر {fa(position)} در صف هستید'
        detail = f'{fa(ahead)} نفر جلوتر از شما هستند. صفحه را نبندید؛ خودش تازه می‌شود.'
    else:
        headline = 'صف برای شما باز می‌شود'
        detail = 'هنوز جای خالی‌ای به شما نرسیده است؛ کمی صبر کنید.'

    cells = (
        f'<div class="cell">نفرات جلوتر<b>{fa(ahead)}</b></div>'
        f'<div class="cell">ظرفیت سرور<b>{fa(int(snapshot.get("capacity") or 0))}</b></div>'
        f'<div class="cell">سقف ماندن در صف<b>{fa(int(snapshot.get("max_wait") or row.queue_max_minutes))} دقیقه</b></div>'
    )
    return f"""<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="refresh" content="{REFRESH_SECONDS}">
<title>صف انتظار | گرین کود</title>
<style>
:root {{ color-scheme: light dark }}
* {{ box-sizing: border-box }}
body {{ margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
  font-family: Tahoma, 'Segoe UI', system-ui, sans-serif;
  background:linear-gradient(160deg,#052e22,#065f46 55%,#a3e635); color:#0f172a; padding:20px }}
main {{ width:100%; max-width:560px; background:#fff; border-radius:26px; padding:26px 22px; text-align:center;
  box-shadow:0 24px 60px rgba(2,44,34,.35) }}
h1 {{ font-size:20px; margin:12px 0 6px }}
p {{ font-size:14px; line-height:2.05; color:#475569; margin:8px 0 }}
.badge {{ display:inline-block; background:#ecfdf5; color:#047857; border-radius:999px; padding:5px 13px;
  font-size:12px; font-weight:700 }}
.row {{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:14px }}
.cell {{ background:#f8fafc; border-radius:16px; padding:10px 14px; font-size:12px; color:#334155; min-width:118px }}
.cell b {{ display:block; font-size:17px; color:#0f172a; margin-top:3px }}
a {{ display:inline-block; margin-top:16px; min-height:44px; line-height:44px; padding:0 18px; border-radius:14px;
  background:#059669; color:#fff; font-weight:700; text-decoration:none }}
small {{ color:#94a3b8; font-size:11px; line-height:1.9; display:block; margin-top:14px }}
@media (prefers-color-scheme: dark) {{
  main {{ background:#0b1f1a; color:#e2e8f0 }}
  p {{ color:#a7f3d0 }}
  .cell {{ background:#12352b; color:#d1fae5 }}
  .cell b {{ color:#fff }}
}}
</style>
</head>
<body>
<main>
  <span class="badge">گرین کود — این لحظه شلوغ است</span>
  <h1>{escape(headline)}</h1>
  <p>{escape(message)}</p>
  <p>{escape(detail)}</p>
  <div class="row">{cells}</div>
  <a href="">دوباره نگاه می‌کنم</a>
  <small>این صفحه هر {fa(REFRESH_SECONDS)} ثانیه خودش را تازه می‌کند. رفرش‌های پی‌در‌پی شما را
  جلو نمی‌اندازد؛ صف به ترتیب زمان ورود حرکت می‌کند.</small>
</main>
</body>
</html>
"""


def fa(value) -> str:
    """Persian digits, because every other number the shop prints is one."""
    from .persian import fa_digits

    return fa_digits(value)
