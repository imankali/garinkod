from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token


class CookieTokenAuthentication(TokenAuthentication):
    """Authenticate browser clients from an HttpOnly cookie.

    Authorization headers remain supported for service integrations and test
    clients. Browser JavaScript never needs to read the token.
    """

    def authenticate(self, request):
        header_auth = super().authenticate(request)
        if header_auth is not None:
            return header_auth

        token_key = request.COOKIES.get('garinkood_auth')
        if not token_key:
            return None
        try:
            token = Token.objects.select_related('user').get(key=token_key)
        except Token.DoesNotExist:
            return None
        return token.user, token
