"""Legacy compatibility views.

The active API is defined in api_views.py; these views are kept safe in case an
older integration still imports them.
"""

from django.conf import settings
from django.contrib.auth import logout
from django.http import HttpResponseRedirect
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


def home(_request):
    return HttpResponseRedirect(settings.FRONTEND_URL)


@api_view(['POST'])
@permission_classes([AllowAny])
def user_logout(request):
    if request.user.is_authenticated:
        Token.objects.filter(user=request.user).delete()
    logout(request)
    response = Response({'message': 'خروج با موفقیت انجام شد'})
    response.delete_cookie(settings.AUTH_COOKIE_NAME, path='/', samesite=settings.AUTH_COOKIE_SAMESITE)
    return response
