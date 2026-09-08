from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck, TokenAuthentication
from rest_framework.authtoken.models import Token

from . import preview


class CookieTokenAuthentication(TokenAuthentication):
    """Authenticate integrations by header and browsers by CSRF-bound cookie."""

    def authenticate(self, request):
        # Explicit Authorization credentials are not ambient browser authority
        # and remain suitable for service integrations without CSRF tokens.
        header_auth = super().authenticate(request)
        if header_auth is not None:
            return header_auth

        token_key = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
        cookie_authenticated = bool(token_key)
        if not token_key and preview.enabled():
            token_key = request.GET.get(preview.PREVIEW_PARAM)
        if not token_key:
            return None
        try:
            token = Token.objects.select_related("user").get(key=token_key)
        except Token.DoesNotExist:
            return None

        # Only ambient cookie credentials require CSRF.  The DEBUG-only preview
        # query fallback behaves like an Authorization credential, not a cookie.
        if cookie_authenticated:
            self.enforce_csrf(request)
        return token.user, token

    def enforce_csrf(self, request):
        check = CSRFCheck(lambda _request: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
