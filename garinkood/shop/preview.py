"""What an embedded preview may present as proof of who it is.

A sandbox preview is shown inside a frame of another host, and in that frame the browser
may keep neither a cookie nor its own storage — while the proxy in front of the frame is
free to drop an ``Authorization`` header on its way through. So a preview with the switch
on (``GK_PREVIEW_IFRAME_COOKIES``, and ``DEBUG``, or none of this exists) may carry the
same key the HttpOnly cookie would have held in the query string, where a rewriting proxy
has to leave it alone because that is the page's own address.

Nothing here is trusted by being present: the key is looked up in the same table DRF
uses, and an unknown or deactivated one means an anonymous visitor. It is also recorded
nowhere — the shop's error notebook stores a path without its query string, and so does
presence — and the production shop has no reason to turn the switch on, so there the only
credential a browser presents is the cookie.
"""

PREVIEW_PARAM = 'gk_token'


def enabled() -> bool:
    from django.conf import settings

    return bool(getattr(settings, 'PREVIEW_IFRAME_COOKIES', False)) and settings.DEBUG


def credential(request) -> str:
    """The token this request presents — by header anywhere, by parameter in a preview."""
    header = request.headers.get('Authorization', '')
    if header.startswith('Token '):
        return header[len('Token '):].strip()[:64]
    if not enabled():
        return ''
    return (request.GET.get(PREVIEW_PARAM) or '').strip()[:64]


def user_for(request):
    """The active user behind that credential, or ``None``."""
    from rest_framework.authtoken.models import Token

    key = credential(request)
    if not key:
        return None
    row = Token.objects.select_related('user').filter(key=key).first()
    if row is None or not row.user.is_active:
        return None
    return row.user
