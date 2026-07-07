from django.shortcuts import get_object_or_404
from django.http import HttpResponseRedirect
from django.contrib.auth import logout
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Product, Cart, CartItem


# ====================================
# Root Endpoint - Redirect به React
# ====================================

def home(request):
    """
    Root endpoint - Redirect به React Frontend
    """
    return HttpResponseRedirect('http://localhost:5173/')


# ====================================
# User Logout (برای backward compatibility)
# ====================================

@api_view(['POST'])
@permission_classes([AllowAny])
def user_logout(request):
    """
    خروج کاربر
    """
    try:
        request.user.auth_token.delete()
    except:
        pass

    logout(request)
    return Response({'message': 'خروج با موفقیت انجام شد'})