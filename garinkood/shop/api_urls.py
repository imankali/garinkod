from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import api_views, marketplace_views, reference_views, farm_views

# ساخت Router
router = DefaultRouter()
router.register(r'categories', api_views.CategoryViewSet, basename='category')
router.register(r'products', api_views.ProductViewSet, basename='product')
router.register(r'comments', api_views.CommentViewSet, basename='comment')
router.register(r'cart', api_views.CartViewSet, basename='cart')
router.register(r'marketplace/listings', api_views.MarketplaceListingViewSet, basename='marketplace-listing')
router.register(r'marketplace/posts', api_views.StorefrontPostViewSet, basename='marketplace-post')
router.register(r'marketplace/post-comments', api_views.StorefrontPostCommentViewSet, basename='marketplace-post-comment')
router.register(r'marketplace/storefronts', marketplace_views.StorefrontDirectoryViewSet, basename='storefront-directory')
router.register(r'marketplace/highlights', marketplace_views.StorefrontHighlightViewSet, basename='storefront-highlight')

urlpatterns = [
    # API Routes (از Router)
    path('', include(router.urls)),

    # Auth Routes
    path('auth/register/', api_views.register, name='api_register'),
    path('auth/login/', api_views.login_view, name='api_login'),
    path('auth/logout/', api_views.logout_view, name='api_logout'),
    path('auth/session/', api_views.auth_session, name='api_auth_session'),

    # Profile Route
    path('profile/', api_views.user_profile, name='api_profile'),
    path('profile/avatar/', api_views.user_avatar, name='api_profile_avatar'),

    # Reference data: geography and agricultural input doses
    path('locations/', reference_views.locations, name='api_locations'),
    path('agri/inputs/', reference_views.agri_inputs, name='api_agri_inputs'),
    path('agri/crops/', reference_views.agri_crops, name='api_agri_crops'),
    path('agri/calculate/', reference_views.calculate_dose, name='api_agri_calculate'),

    # Orders and interim payment coordination
    path('orders/checkout/', api_views.checkout, name='api_checkout'),
    path('orders/lookup/', api_views.order_lookup, name='api_order_lookup'),
    path('orders/cancel/', api_views.cancel_order, name='api_order_cancel'),
    path('orders/mine/', api_views.my_orders, name='api_my_orders'),

    # Agriculture services, farmer procurement and marketplace storefronts
    path('services/requests/', api_views.create_service_request, name='api_service_request'),
    path('procurement/requests/', api_views.create_procurement_request, name='api_procurement_request'),
    path('marketplace/storefront/', api_views.my_storefront, name='api_my_storefront'),
    path('marketplace/storefront/availability/', marketplace_views.storefront_name_available, name='api_storefront_availability'),
    path('marketplace/following/', marketplace_views.my_following, name='api_my_following'),

    # Direct messages between buyers and storefronts
    path('marketplace/conversations/', marketplace_views.my_conversations, name='api_my_conversations'),
    path(
        'marketplace/conversations/<int:conversation_id>/messages/',
        marketplace_views.conversation_messages,
        name='api_conversation_messages',
    ),
    path(
        'marketplace/storefronts/<str:slug>/conversation/',
        marketplace_views.storefront_conversation,
        name='api_storefront_conversation',
    ),
    # The unified inbox: support, consulting and comment-reply threads all
    # resolve through the same conversation/message endpoints as storefront chat.
    path(
        'marketplace/conversations/service/<str:channel>/',
        marketplace_views.service_conversation,
        name='api_service_conversation',
    ),
    path(
        'marketplace/conversations/farmer/<int:user_id>/',
        marketplace_views.start_farmer_conversation,
        name='api_start_farmer_conversation',
    ),

    # Farm profile: lands, calendars and consultation
    path('farm/lands/', farm_views.my_lands, name='api_farm_lands'),
    path('farm/lands/<int:land_id>/', farm_views.land_detail, name='api_farm_land_detail'),
    path('farm/lands/<int:land_id>/events/', farm_views.land_events, name='api_farm_land_events'),
    path('farm/events/<int:event_id>/', farm_views.event_detail, name='api_farm_event_detail'),
    path('farm/calendar/', farm_views.my_calendar, name='api_farm_calendar'),
    path('farm/consultations/', farm_views.my_consultations, name='api_farm_consultations'),

    # Consultant side (level 3+)
    path('farm/consulting/requests/', farm_views.consulting_requests, name='api_consulting_requests'),
    path('farm/consulting/requests/<int:consultation_id>/reply/', farm_views.consulting_reply, name='api_consulting_reply'),
    path('farm/consulting/farmers/', farm_views.consulting_farmers, name='api_consulting_farmers'),
    path('farm/consulting/farmers/<int:user_id>/', farm_views.consulting_farmer_dossier, name='api_consulting_farmer_dossier'),
    path('farm/consulting/lands/<int:land_id>/events/', farm_views.consulting_land_event, name='api_consulting_land_event'),
    path('marketplace/finance/', api_views.storefront_finance, name='api_storefront_finance'),
    path('marketplace/finance/export/', api_views.storefront_finance_export, name='api_storefront_finance_export'),
    path('payments/options/', api_views.payment_options_view, name='api_payment_options'),
    path('affiliate/me/', api_views.affiliate_me, name='api_affiliate_me'),
    path('feedback/', api_views.submit_feedback, name='api_feedback'),
    path('complaints/storefront/', api_views.submit_storefront_complaint, name='api_storefront_complaint'),
    path('visual-search/', api_views.visual_search, name='api_visual_search'),
    path('rewards/me/', api_views.my_rewards, name='api_my_rewards'),
    path('wallet/me/', api_views.my_wallet, name='api_my_wallet'),

    # Staff command centre
    path('management/dashboard/', api_views.management_dashboard, name='management_dashboard'),
    path('management/staff/', api_views.management_staff, name='management_staff'),
    path('management/audit/', api_views.management_audit, name='management_audit'),
    path('management/orders/<str:code>/mark-paid/', api_views.management_mark_order_paid, name='management_mark_order_paid'),
    path('management/users/', api_views.management_users, name='management_users'),
    path('management/moderation/queue/', api_views.management_moderation_queue, name='management_moderation_queue'),
    path('management/moderation/bulk/', api_views.management_bulk_moderate, name='management_bulk_moderate'),
    path('management/moderate/<str:content_type>/<int:object_id>/', api_views.management_moderate_content, name='management_moderate_content'),
]