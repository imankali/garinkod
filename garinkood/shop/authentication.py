from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token

from . import preview


class CookieTokenAuthentication(TokenAuthentication):
    """Authenticate browser clients from an HttpOnly cookie.

    Authorization headers remain supported for service integrations and test clients, and
    a preview whose browser keeps nothing may present the same key in its address — see
    ``shop.preview``, which is off unless the preview switch is on under DEBUG. Browser
    JavaScript never needs to read the token on the real shop.
    """

    def authenticate(self, request):
        header_auth = super().authenticate(request)
        if header_auth is not None:
            return header_auth

        token_key = request.COOKIES.get('garinkood_auth')
        if not token_key and preview.enabled():
            # A frame with no cookie, behind a proxy that drops Authorization headers,
            # can still carry the key in the address it is already fetching.
            token_key = request.GET.get(preview.PREVIEW_PARAM)
        if not token_key:
            return None
        try:
            token = Token.objects.select_related('user').get(key=token_key)
        except Token.DoesNotExist:
            return None
        return token.user, token
