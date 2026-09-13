"""Project-wide middleware.

Only one thing lives here today, and it exists because of a failure mode that is
invisible to every backend test in this repository: a cookie-authenticated SPA
whose server never hands out a CSRF cookie.

`shop.authentication.CookieTokenAuthentication` authenticates a browser by an
HttpOnly token cookie and then *requires* a CSRF token for every unsafe request —
correctly, because ambient cookie credentials are exactly what CSRF protects
against. But nothing in the API ever issued that cookie: Django writes it only
when a view asks for a token, and no DRF view renders `{% csrf_token %}`. The
result, measured against a running server, was a 403 `permission_denied` on every
POST/PUT/PATCH/DELETE a signed-in browser made — adding to a cart, sending a
message, opening a stall. Django's test client hides this (CSRF checks are off by
default) and DRF's `APIRequestFactory` never reaches the cookie layer at all, which
is how a broken write path stayed green across the whole backend suite.

The middleware asks for the token on the way in, so `CsrfViewMiddleware` writes
the cookie on the way out. JavaScript then reads it and echoes it back in
`X-CSRFToken`, which is the standard double-submit arrangement for a same-origin
SPA.
"""

from django.middleware.csrf import get_token


class IssueCsrfCookieMiddleware:
    """Make sure every response can carry the CSRF cookie the SPA must echo.

    Ordering: this runs *after* `django.middleware.csrf.CsrfViewMiddleware` in
    `MIDDLEWARE`, so `get_token()` executes during request processing and
    `CsrfViewMiddleware.process_response` — which runs later, because response
    hooks are unwound in reverse — is what actually writes the cookie. Placing it
    before the CSRF middleware would be too late to matter and reads as a mistake
    to the next person editing the list.

    Responses served by WhiteNoise never get this far, so static assets keep
    their cacheability.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Idempotent and cheap: Django caches the token on the request, so calling
        # it again in a view changes nothing.
        get_token(request)
        return self.get_response(request)
