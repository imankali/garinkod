from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import api_views

# ساخت Router
router = DefaultRouter()
router.register(r'categories', api_views.CategoryViewSet, basename='category')
router.register(r'products', api_views.ProductViewSet, basename='product')
router.register(r'comments', api_views.CommentViewSet, basename='comment')
router.register(r'cart', api_views.CartViewSet, basename='cart')

urlpatterns = [
    # API Routes (از Router)
    path('', include(router.urls)),

    # Auth Routes
    path('auth/register/', api_views.register, name='api_register'),
    path('auth/login/', api_views.login_view, name='api_login'),
    path('auth/logout/', api_views.logout_view, name='api_logout'),

    # Profile Route
    path('profile/', api_views.user_profile, name='api_profile'),
]