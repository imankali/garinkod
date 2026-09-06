"""The shop's own notebook for what goes wrong while it is being used.

Sentry gets the traceback if a DSN is configured; this table is what the person
running the shop reads on a Sunday morning without an account anywhere. It exists
because a store's most expensive failures are silent: a checkout that raises for
one farmer produces no ticket, no phone call and no complaint — only an order that
was never placed.

Two choices keep it usable:

* only server errors are recorded. A 404 is someone typing an address wrong, and a
  log full of those is how the two lines that matter get skipped;
* entries are grouped with a counter rather than appended, so one bug firing on
  every page view is one readable row that says «۴٬۲۰۹ بار» instead of four
  thousand rows that say nothing.

Whatever is written is scrubbed first: a request body is exactly where a password
or a card number lives, and an error log is copied around more than any other table
in a shop.
"""

from __future__ import annotations

import json
import logging
import traceback

from .capacity import redact, visitor_key

logger = logging.getLogger(__name__)

# Paths whose failures are noise by definition: the monitoring probes and the
# waiting room itself must not fill the notebook with their own health.
SKIP_PREFIXES = ('/health', '/ops/', '/queue', '/media/', '/static/', '/favicon.ico')

BODY_SAMPLE_BYTES = 2000

INTERESTING_HEADERS = ('User-Agent', 'Referer', 'Accept-Language', 'Content-Type')


def describe_exception(exc) -> tuple[str, str]:
    """``(title, message)`` for a raised exception.

    The title is deliberately made of the exception *type* and the frame it died in,
    not of the message: a database error message quotes the SQL, which quotes a
    phone number, and the title is what rows are grouped and scanned by.
    """
    frames = traceback.extract_tb(getattr(exc, '__traceback__', None))
    where = frames[-1] if frames else None
    if where is None:
        return f'{type(exc).__name__}', str(exc)[:4000]
    short_file = where.filename.rsplit('/', 1)[-1].rsplit('\\', 1)[-1]
    return (
        f'{type(exc).__name__} در {short_file}:{where.lineno} ({where.name})',
        f'{type(exc).__name__}: {exc}'[:4000],
    )


def body_context(request) -> dict:
    """A small, scrubbed look at what was sent, for reproducing the fault.

    Only a JSON body is parsed, and only up to two kilobytes of it: anything else
    (a file upload, a form) gets its size, which is the part that helps and the
    part that is safe to keep.
    """
    content_type = (request.headers.get('Content-Type') or '').lower()
    if 'json' not in content_type:
        length = getattr(request, 'content_length', None)
        return {'body_bytes': length if isinstance(length, int) else None} if length else {}
    raw = request.body[:BODY_SAMPLE_BYTES] if hasattr(request, 'body') else b''
    if not raw:
        return {}
    try:
        parsed = json.loads(raw.decode('utf-8', 'replace'))
    except (ValueError, UnicodeDecodeError):
        # Truncated or malformed: keeping the bytes would keep whatever they
        # contain, which is the one thing this function is here not to do.
        return {'body_unparsed_bytes': len(raw)}
    return redact(parsed if isinstance(parsed, (dict, list)) else {'value': parsed})


def source_of(request) -> str:
    """Which view raised, as a short label an operator can recognise."""
    match = getattr(request, 'resolver_match', None)
    if match is None:
        try:
            from django.urls import resolve

            match = resolve(request.path_info)
        except Exception:  # resolver failures are the fault itself sometimes
            match = None
    if match is None:
        return 'unresolved'
    name = match.url_name or ''
    if not name:
        func = getattr(match.func, '__name__', 'view')
        module = getattr(match.func, '__module__', '').rsplit('.', 1)[-1]
        name = f'{module}.{func}'
    namespace = getattr(match, 'namespace', '') or ''
    return f'{namespace}:{name}'[:70] if namespace else name[:70]


def record_request_exception(request, exc=None, *, status_code: int | None = None, level: str = 'error'):
    """Write one grouped row. Never raises: a broken notebook must not close the shop.

    Returns the entry when there is one, so tests and callers can look at it.
    """
    from .models import SystemLogEntry

    if any(request.path.startswith(prefix) for prefix in SKIP_PREFIXES):
        return None
    try:
        if exc is not None:
            title, message = describe_exception(exc)
        else:
            title = f'پاسخ {status_code} بدون استثنا'
            message = ''

        user = getattr(request, 'user', None)
        authenticated = bool(user is not None and getattr(user, 'is_authenticated', False))
        context = {
            'query': request.GET.urlencode()[:400],
            'headers': {name: request.headers.get(name, '')[:200] for name in INTERESTING_HEADERS},
            'body': body_context(request),
        }
        return SystemLogEntry.record(
            source=source_of(request),
            title=title[:200],
            level=level,
            message=message[:4000],
            path=request.path[:200],
            method=request.method[:8],
            status_code=status_code,
            user=user if authenticated else None,
            visitor_key=visitor_key(request),
            context=context,
        )
    except Exception:  # pragma: no cover
        logger.exception('could not write the system log entry')
        return None


class ErrorLogMiddleware:
    """Catch what the views throw and put it where staff read.

    The exception is re-raised untouched — the response a visitor gets is exactly
    what it was before this middleware existed, including in DEBUG. Nothing about
    the failure is *shown* to them from here; the row is for whoever fixes it.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception as exc:
            record_request_exception(request, exc, status_code=500)
            raise

        code = getattr(response, 'status_code', 200)
        if code >= 500:
            # A view that hands back a 500 itself (a gateway outage, a dead carrier)
            # has no exception to describe, and is still worth a row.
            record_request_exception(request, status_code=code, level='error')
        elif code == 429:
            # Throttling is not a fault, but a shop that starts refusing farmers is
            # a fact worth seeing once a day in the same list.
            record_request_exception(request, status_code=code, level='notice')
        return response
