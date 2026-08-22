from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import api_views

# ساخت Router
router = DefaultRouter()
router.register(r'categories', api_views.CategoryViewSet, basename='category')
router.register(r'products', api_views.ProductViewSet, basename='product')
router.register(r'comments', api_views.CommentViewSet, basename='comment')
router.register(r'cart', api_views.CartViewSet, basename='cart')
router.register(r'marketplace/listings', api_views.MarketplaceListingViewSet, basename='marketplace-listing')

urlpatterns = [
    # API Routes (از Router)
    path('', include(router.urls)),

    # Auth Routes
    path('auth/register/', api_views.register, name='api_register'),
    path('auth/login/', api_views.login_view, name='api_login'),
    path('auth/logout/', api_views.logout_view, name='api_logout'),

    # Profile Route
    path('profile/', api_views.user_profile, name='api_profile'),

    # Orders and interim payment coordination
    path('orders/checkout/', api_views.checkout, name='api_checkout'),
    path('orders/lookup/', api_views.order_lookup, name='api_order_lookup'),
    path('orders/mine/', api_views.my_orders, name='api_my_orders'),

    # Agriculture services, farmer procurement and marketplace storefronts
    path('services/requests/', api_views.create_service_request, name='api_service_request'),
    path('procurement/requests/', api_views.create_procurement_request, name='api_procurement_request'),
    path('marketplace/storefront/', api_views.my_storefront, name='api_my_storefront'),
]