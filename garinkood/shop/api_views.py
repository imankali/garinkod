from contextlib import nullcontext
from decimal import Decimal, InvalidOperation
from datetime import timedelta
from secrets import token_urlsafe
from threading import Lock

from django.conf import settings
from django.db.models import Count, Exists, F, OuterRef, Prefetch, Q, Sum
from rest_framework import mixins, viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import Group, User
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination

from .filters import ProductFilter
from .models import (
    Category, Product, Comment, UserAccount, Cart, CartItem, Order, OrderItem,
    ServiceRequest, ProcurementRequest, Storefront, MarketplaceListing,
    PaymentAttempt, AffiliateProfile, AffiliateConversion, FinancialLedgerEntry,
    PlatformFeedback, StorefrontComplaint, VisualSearchRequest, Coupon, Wallet,
    WalletTransaction, StorefrontPost, AdminAuditLog, Location, AgriInput,
    AgriInputDose, StorefrontFollow, StorefrontHighlight, StorefrontHighlightItem,
    StorefrontPostComment, StorefrontPostLike, StorefrontStoryView,
    UserAccount, account_level
)
from .serializers import (
    CategorySerializer, ProductSerializer, ProductListSerializer,
    CommentSerializer, UserAccountSerializer, CartSerializer,
    UserSerializer, RegisterSerializer, CheckoutSerializer, OrderSerializer,
    ServiceRequestSerializer, ProcurementRequestSerializer, StorefrontSerializer,
    MarketplaceListingSerializer, PaymentAttemptSerializer, AffiliateProfileSerializer,
    AffiliateConversionSerializer, FinancialLedgerEntrySerializer, PlatformFeedbackSerializer,
    StorefrontComplaintSerializer, VisualSearchRequestSerializer, CouponSerializer,
    WalletSerializer, StorefrontPostSerializer, AdminAuditLogSerializer,
    LocationSerializer, AgriInputSerializer, StorefrontHighlightSerializer,
    StorefrontPostCommentSerializer
)
from .management_roles import ROLE_PERMISSIONS
from .payments import get_provider, provider_options
from .rewards import mark_order_paid_and_reward
from .settlements import record_marketplace_sale, reverse_marketplace_sale, restore_listing_quantities
from .notifications import notify_comment_reply
from .permissions import IsModerator, IsAdminLevel, IsOwnerLevel
from .slugs import slugify_fa, unique_storefront_slug, unique_listing_slug
from .throttling import (
    LoginRateThrottle, RegisterRateThrottle, SearchRateThrottle,
    CheckoutRateThrottle, UploadRateThrottle, FeedbackRateThrottle,
)

class ClientConfigurablePagination(PageNumberPagination):
    """Page size the client may choose, with a ceiling.

    The cap matters: without it a single request could ask for every row and
    turn a paginated endpoint into an accidental full-table export.
    """

    page_size_query_param = 'page_size'
    max_page_size = 48


# SQLite is used for local development only. It permits a single writer, so a
# process-local lock prevents its deferred transactions from upgrading into
# "database is locked" errors under a concurrent local smoke test. PostgreSQL
# relies on normal row locks and never takes this branch.
_SQLITE_CART_WRITE_LOCK = Lock()


def _set_auth_cookie(response, token):
    response.set_cookie(
        settings.AUTH_COOKIE_NAME,
        token.key,
        max_age=settings.AUTH_COOKIE_AGE,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path='/',
    )
    return response


def _clear_auth_cookie(response):
    response.delete_cookie(settings.AUTH_COOKIE_NAME, path='/', samesite=settings.AUTH_COOKIE_SAMESITE)
    return response


def _generate_affiliate_code() -> str:
    """Generate a short code while respecting the database uniqueness rule."""
    while True:
        code = f"GKAF-{token_urlsafe(5).upper().replace('-', '')}"
        if not AffiliateProfile.objects.filter(code=code).exists():
            return code


# ========================================
# Auth Views
# ========================================

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginRateThrottle])
def login_view(request):
    """ورود کاربر"""
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'error': 'نام کاربری و رمز عبور الزامی است'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=username, password=password)

    if user:
        login(request, user)
        token, created = Token.objects.get_or_create(user=user)

        response = Response({
            'user': UserSerializer(user).data,
            'message': 'ورود با موفقیت انجام شد'
        })
        return _set_auth_cookie(response, token)

    return Response(
        {'error': 'نام کاربری یا رمز عبور اشتباه است'},
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([RegisterRateThrottle])
def register(request):
    """ثبت‌نام کاربر"""
    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        # ساخت UserAccount
        # A level-1 account row already exists (created by the post_save
        # signal); fill in the optional profile details the form supplied.
        UserAccount.objects.update_or_create(
            user=user,
            defaults={
                'phone': request.data.get('phone', ''),
                'gender': request.data.get('gender', 'male'),
                'address': request.data.get('address', ''),
            },
        )

        # ساخت Token
        token, created = Token.objects.get_or_create(user=user)

        response = Response({
            'user': UserSerializer(user).data,
            'message': 'ثبت‌نام با موفقیت انجام شد'
        }, status=status.HTTP_201_CREATED)
        return _set_auth_cookie(response, token)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """خروج کاربر"""
    Token.objects.filter(user=request.user).delete()
    logout(request)
    return _clear_auth_cookie(Response({'message': 'خروج با موفقیت انجام شد'}))


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def auth_session(request):
    account = getattr(request.user, 'account', None)
    return Response({
        'user': UserSerializer(request.user).data,
        'account': UserAccountSerializer(account).data if account else None,
    })


# ========================================
# Category ViewSet
# ========================================
class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.prefetch_related('subcategories')
    serializer_class = CategorySerializer
    lookup_field = 'slug'


# ========================================
# Product ViewSet
# ========================================
class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(status='published').select_related('category', 'subcategory')
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ['title', 'description']
    ordering_fields = ['price', 'publish', 'created', 'sales_count', 'discount_percent']
    ordering = ['-publish']
    lookup_field = 'slug'
    throttle_classes = [SearchRateThrottle]

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        return ProductSerializer

    @action(detail=False, methods=['get'])
    def featured(self, request):
        featured_products = self.queryset.filter(is_featured=True)[:8]
        serializer = ProductListSerializer(featured_products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def similar(self, request, slug=None):
        product = self.get_object()
        similar = self.queryset.exclude(id=product.id)
        if product.category_id:
            similar = similar.filter(category_id=product.category_id)
        serializer = ProductListSerializer(similar[:4], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        category_slug = request.query_params.get('category', None)
        if category_slug:
            products = self.queryset.filter(category__slug=category_slug)
            serializer = ProductListSerializer(products, many=True)
            return Response(serializer.data)
        return Response({'error': 'Category slug is required'}, status=400)


# ========================================
# Comment ViewSet
# ========================================
class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.filter(active=True, parent=None)
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user, active=True)

    @action(detail=False, methods=['get'])
    def by_product(self, request):
        product_slug = request.query_params.get('product', None)
        if product_slug:
            product = get_object_or_404(Product, slug=product_slug)
            comments = self.queryset.filter(product=product)
            serializer = self.get_serializer(comments, many=True)
            return Response(serializer.data)
        return Response({'error': 'Product slug is required'}, status=400)


# ========================================
# Cart ViewSet - ✅ اصلاح شده با پشتیبانی از Guest Cart
# ========================================
class CartViewSet(viewsets.ViewSet):
    """
    سبد خرید با پشتیبانی از کاربران مهمان (Guest)
    """
    permission_classes = [permissions.AllowAny]  # ✅ AllowAny برای guest cart

    def _get_or_create_cart(self, request):
        """دریافت یا ساخت سبد خرید (با پشتیبانی از session برای مهمان)"""
        if request.user.is_authenticated:
            cart, created = Cart.objects.get_or_create(user=request.user)
            # Merge guest cart if exists
            session_id = request.session.session_key
            if session_id:
                guest_cart = Cart.objects.filter(
                    session_id=session_id
                ).exclude(user__isnull=False).first()
                if guest_cart and guest_cart.id != cart.id:
                    for guest_item in guest_cart.items.select_related('product', 'listing'):
                        # A row references either a product or a listing; merge
                        # on whichever it is and cap at what is still available.
                        lookup = (
                            {'listing': guest_item.listing}
                            if guest_item.listing_id
                            else {'product': guest_item.product}
                        )
                        cart_item, created = CartItem.objects.get_or_create(
                            cart=cart, **lookup, defaults={'quantity': guest_item.quantity}
                        )
                        if not created:
                            new_qty = cart_item.quantity + guest_item.quantity
                            cart_item.quantity = max(min(new_qty, guest_item.available_quantity), 1)
                            cart_item.save(update_fields=['quantity'])
                    guest_cart.delete()
            return cart
        else:
            if not request.session.session_key:
                request.session.create()
            session_id = request.session.session_key
            cart, created = Cart.objects.get_or_create(session_id=session_id)
            return cart

    def list(self, request):
        """دریافت سبد خرید"""
        sqlite_lock = _SQLITE_CART_WRITE_LOCK if connection.vendor == 'sqlite' else nullcontext()
        with sqlite_lock:
            cart = self._get_or_create_cart(request)
            serializer = CartSerializer(cart, context={'request': request})
            return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add(self, request):
        """افزودن محصول به سبد خرید"""
        product_id = request.data.get('product_id')
        if product_id in (None, ''):
            return Response({'error': 'product_id الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product_id = int(product_id)
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response(
                {'error': 'شناسه محصول و تعداد باید عدد صحیح باشند'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if quantity < 1:
            return Response({'error': 'تعداد باید حداقل ۱ باشد'}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product, id=product_id, status='published')
        if not product.is_in_stock:
            return Response({'error': 'این محصول موجود نیست'}, status=status.HTTP_400_BAD_REQUEST)

        max_qty = min(10, product.stock)
        quantity = min(quantity, max_qty)

        # Locking the cart item makes repeated clicks and concurrent requests
        # from one browser deterministic instead of losing an increment.
        sqlite_lock = _SQLITE_CART_WRITE_LOCK if connection.vendor == 'sqlite' else nullcontext()
        with sqlite_lock:
            with transaction.atomic():
                cart = self._get_or_create_cart(request)
                cart_item = CartItem.objects.select_for_update().filter(
                    cart=cart, product=product
                ).first()
                if cart_item:
                    cart_item.quantity = min(cart_item.quantity + quantity, max_qty)
                    cart_item.save(update_fields=['quantity'])
                else:
                    CartItem.objects.create(cart=cart, product=product, quantity=quantity)

        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='add-listing')
    def add_listing(self, request):
        """Add a storefront listing to the cart.

        Unlike catalogue products, a listing carries a seller-defined minimum
        order, so a quantity below it is rejected rather than silently raised,
        and the ceiling is whatever the seller still has available.
        """
        listing_id = request.data.get('listing_id')
        if listing_id in (None, ''):
            return Response({'error': 'listing_id الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            listing_id = int(listing_id)
            quantity = int(request.data.get('quantity', 0) or 0)
        except (TypeError, ValueError):
            return Response(
                {'error': 'شناسه آگهی و تعداد باید عدد صحیح باشند.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        listing = get_object_or_404(
            MarketplaceListing.objects.select_related('storefront'), id=listing_id
        )
        if not listing.is_purchasable:
            return Response(
                {'error': 'این آگهی در حال حاضر قابل خرید نیست.'},
                status=status.HTTP_409_CONFLICT,
            )

        minimum = listing.minimum_order
        available = int(listing.quantity_available)
        if quantity <= 0:
            quantity = minimum
        if quantity < minimum:
            return Response(
                {
                    'error': f'حداقل سفارش این آگهی {minimum} {listing.unit} است.',
                    'fields': {'quantity': [f'حداقل سفارش {minimum} {listing.unit} است.']},
                    'min_order_quantity': minimum,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if quantity > available:
            return Response(
                {
                    'error': f'موجودی این آگهی {available} {listing.unit} است.',
                    'fields': {'quantity': [f'حداکثر {available} {listing.unit} قابل سفارش است.']},
                    'available_quantity': available,
                },
                status=status.HTTP_409_CONFLICT,
            )

        sqlite_lock = _SQLITE_CART_WRITE_LOCK if connection.vendor == 'sqlite' else nullcontext()
        with sqlite_lock:
            with transaction.atomic():
                cart = self._get_or_create_cart(request)
                cart_item = CartItem.objects.select_for_update().filter(
                    cart=cart, listing=listing
                ).first()
                if cart_item:
                    cart_item.quantity = min(cart_item.quantity + quantity, available)
                    cart_item.save(update_fields=['quantity'])
                else:
                    CartItem.objects.create(cart=cart, listing=listing, quantity=quantity)

        return Response(
            CartSerializer(cart, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'])
    def remove(self, request):
        """حذف محصول از سبد خرید"""
        item_id = request.data.get('item_id')

        if not item_id:
            return Response(
                {'error': 'item_id الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cart = self._get_or_create_cart(request)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
        cart_item.delete()

        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='update_quantity')
    def update_quantity(self, request):
        """به‌روزرسانی تعداد محصول در سبد خرید"""
        item_id = request.data.get('item_id')
        if item_id in (None, ''):
            return Response({'error': 'item_id الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            item_id = int(item_id)
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response(
                {'error': 'شناسه آیتم و تعداد باید عدد صحیح باشند'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sqlite_lock = _SQLITE_CART_WRITE_LOCK if connection.vendor == 'sqlite' else nullcontext()
        with sqlite_lock:
            cart = self._get_or_create_cart(request)
            with transaction.atomic():
                cart_item = get_object_or_404(
                    CartItem.objects.select_for_update().select_related('product', 'listing'),
                    id=item_id,
                    cart=cart,
                )
                if quantity <= 0:
                    cart_item.delete()
                elif cart_item.listing_id:
                    # Listings honour the seller's minimum order and stock, not
                    # the catalogue's flat cap of ten.
                    listing = cart_item.listing
                    minimum = listing.minimum_order
                    available = int(listing.quantity_available)
                    if quantity < minimum:
                        return Response(
                            {
                                'error': f'حداقل سفارش این آگهی {minimum} {listing.unit} است.',
                                'fields': {'quantity': [f'حداقل سفارش {minimum} {listing.unit} است.']},
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if quantity > available:
                        return Response(
                            {
                                'error': f'موجودی این آگهی {available} {listing.unit} است.',
                                'fields': {'quantity': [f'حداکثر {available} {listing.unit} قابل سفارش است.']},
                            },
                            status=status.HTTP_409_CONFLICT,
                        )
                    cart_item.quantity = quantity
                    cart_item.save(update_fields=['quantity'])
                else:
                    max_qty = min(10, cart_item.product.stock)
                    cart_item.quantity = min(quantity, max_qty)
                    cart_item.save(update_fields=['quantity'])

        serializer = CartSerializer(cart, context={'request': request})
        return Response(serializer.data)


# ========================================
# Checkout and order tracking
# ========================================
SHIPPING_FREE_THRESHOLD = 3_000_000
STANDARD_SHIPPING_PRICE = 45_000


def _checkout_cart(request):
    """Use the same guest/authenticated cart semantics as the cart API."""
    return CartViewSet()._get_or_create_cart(request)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([CheckoutRateThrottle])
def checkout(request):
    """Create a reviewable order from the caller's cart.

    No gateway is called here. Before Zarinpal is wired in, payment is clearly
    marked unpaid and an expert coordinates the order. Stock is reserved in the
    same transaction so two buyers cannot confirm more than what is available.
    """
    serializer = CheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    details = serializer.validated_data
    provider = get_provider(details['payment_method'])
    if not provider or not provider.enabled:
        return Response(
            {'error': 'روش پرداخت انتخاب‌شده هنوز برای دریافت وجه فعال نشده است.'},
            status=status.HTTP_409_CONFLICT,
        )
    sqlite_lock = _SQLITE_CART_WRITE_LOCK if connection.vendor == 'sqlite' else nullcontext()

    with sqlite_lock:
        with transaction.atomic():
            cart = _checkout_cart(request)
            cart_items = list(
                CartItem.objects
                .select_related('product', 'listing', 'listing__storefront', 'listing__storefront__user')
                .filter(cart=cart)
                .order_by('product_id', 'listing_id')
            )
            if not cart_items:
                return Response({'error': 'سبد خرید شما خالی است.'}, status=status.HTTP_400_BAD_REQUEST)

            product_items = [item for item in cart_items if item.product_id]
            listing_items = [item for item in cart_items if item.listing_id]

            # Rows are locked in a stable order (products, then listings, each
            # by ascending id) so two concurrent checkouts can never deadlock.
            product_ids = [item.product_id for item in product_items]
            locked_products = {
                product.id: product
                for product in Product.objects.select_for_update().filter(id__in=product_ids).order_by('id')
            }
            listing_ids = [item.listing_id for item in listing_items]
            locked_listings = {
                listing.id: listing
                for listing in MarketplaceListing.objects
                .select_for_update()
                .select_related('storefront', 'storefront__user')
                .filter(id__in=listing_ids)
                .order_by('id')
            }

            missing_or_unavailable = []
            for item in product_items:
                product = locked_products.get(item.product_id)
                if not product or product.status != 'published' or not product.available or product.stock < item.quantity:
                    missing_or_unavailable.append(item.product.title)
            for item in listing_items:
                listing = locked_listings.get(item.listing_id)
                if not listing or listing.status != 'published' or int(listing.quantity_available) < item.quantity:
                    missing_or_unavailable.append(item.listing.title)
                elif item.quantity < listing.minimum_order:
                    return Response(
                        {
                            'error': (
                                f'حداقل سفارش «{listing.title}» برابر '
                                f'{listing.minimum_order} {listing.unit} است.'
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if missing_or_unavailable:
                return Response(
                    {'error': f"موجودی این کالاها تغییر کرده است: {', '.join(missing_or_unavailable)}"},
                    status=status.HTTP_409_CONFLICT,
                )

            subtotal = (
                sum(locked_products[item.product_id].price * item.quantity for item in product_items)
                + sum(locked_listings[item.listing_id].price * item.quantity for item in listing_items)
            )
            coupon_code = details.get('coupon_code', '').strip().upper()
            coupon = None
            discount_amount = 0
            if coupon_code:
                coupon = Coupon.objects.select_for_update().filter(code=coupon_code).first()
                if not coupon:
                    return Response({'error': 'کد تخفیف پیدا نشد.'}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    discount_amount = coupon.calculate_discount(
                        subtotal,
                        phone=details['phone'],
                        user=request.user if request.user.is_authenticated else None,
                    )
                except ValueError as error:
                    return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)
            shipping_price = 0 if subtotal - discount_amount >= SHIPPING_FREE_THRESHOLD else STANDARD_SHIPPING_PRICE
            affiliate_code = details.get('affiliate_code', '').strip().upper()
            affiliate = None
            if affiliate_code:
                affiliate = AffiliateProfile.objects.filter(code=affiliate_code, status='active').first()
                if not affiliate:
                    return Response({'error': 'کد همکاری در فروش معتبر یا فعال نیست.'}, status=status.HTTP_400_BAD_REQUEST)
            order = Order.objects.create(
                user=request.user if request.user.is_authenticated else None,
                customer_name=details['customer_name'],
                phone=details['phone'],
                email=details.get('email', ''),
                province=details['province'],
                city=details['city'],
                address=details['address'],
                postal_code=details.get('postal_code', ''),
                notes=details.get('notes', ''),
                subtotal=subtotal,
                discount_amount=discount_amount,
                coupon_code=coupon_code,
                shipping_price=shipping_price,
                total_price=subtotal - discount_amount + shipping_price,
                payment_method=details['payment_method'],
                affiliate_code=affiliate_code,
                payment_status='unpaid',
                status='awaiting_review',
            )

            if coupon:
                coupon.usage_count += 1
                coupon.save(update_fields=['usage_count', 'updated_at'])

            order_items = []
            for item in product_items:
                product = locked_products[item.product_id]
                product.stock -= item.quantity
                if product.stock == 0:
                    product.available = False
                product.save(update_fields=['stock', 'available', 'updated'])
                order_items.append(OrderItem(
                    order=order,
                    product=product,
                    kind='product',
                    product_title=product.title,
                    product_slug=product.slug,
                    unit_price=product.price,
                    quantity=item.quantity,
                ))

            for item in listing_items:
                listing = locked_listings[item.listing_id]
                storefront = listing.storefront
                listing.quantity_available = F('quantity_available') - item.quantity
                listing.save(update_fields=['quantity_available', 'updated_at'])
                listing.refresh_from_db(fields=['quantity_available'])
                if listing.quantity_available <= 0:
                    listing.status = 'sold_out'
                    listing.save(update_fields=['status', 'updated_at'])

                line_total = listing.price * item.quantity
                commission_rate = storefront.commission_rate or 0
                order_items.append(OrderItem(
                    order=order,
                    listing=listing,
                    storefront=storefront,
                    seller=storefront.user,
                    kind='listing',
                    product_title=listing.title,
                    product_slug=listing.slug,
                    storefront_name=storefront.name,
                    storefront_slug=storefront.slug,
                    unit=listing.unit,
                    unit_price=listing.price,
                    quantity=item.quantity,
                    commission_rate=commission_rate,
                    commission_amount=int(line_total * commission_rate / 100),
                ))

            OrderItem.objects.bulk_create(order_items)
            # Record the seller/platform split now; it stays pending until the
            # order is actually paid.
            if listing_items:
                record_marketplace_sale(order)
            if affiliate:
                commission_amount = int(subtotal * affiliate.commission_rate / 100)
                conversion = AffiliateConversion.objects.create(
                    affiliate=affiliate,
                    order=order,
                    commission_amount=commission_amount,
                    status='pending',
                )
                FinancialLedgerEntry.objects.create(
                    owner_type='affiliate',
                    user=affiliate.user,
                    order=order,
                    affiliate_conversion=conversion,
                    entry_type='affiliate_commission',
                    status='pending',
                    amount=commission_amount,
                    currency='IRR',
                    description=f'کمیسیون همکاری در فروش سفارش {order.code}',
                )
            CartItem.objects.filter(cart=cart).delete()

    return Response({
        'order': OrderSerializer(order).data,
        'message': 'سفارش ثبت شد. کارشناس برای تأیید موجودی و هماهنگی پرداخت با شما تماس می‌گیرد.'
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def order_lookup(request):
    code = request.query_params.get('code', '').strip().upper()
    phone = request.query_params.get('phone', '').strip().replace(' ', '').replace('-', '')
    if not code or not phone:
        return Response({'error': 'کد سفارش و شماره تماس الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)

    order = get_object_or_404(Order.objects.prefetch_related('items'), code=code, phone=phone)
    return Response(OrderSerializer(order).data)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def cancel_order(request):
    code = str(request.data.get('code', '')).strip().upper()
    phone = str(request.data.get('phone', '')).strip().replace(' ', '').replace('-', '')
    if not code or not phone:
        return Response({'error': 'کد سفارش و شماره تماس الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)
    order = get_object_or_404(Order, code=code, phone=phone)
    try:
        order = order.cancel_and_restore_stock()
    except ValueError as error:
        return Response({'error': str(error)}, status=status.HTTP_409_CONFLICT)
    return Response({'order': OrderSerializer(order).data, 'message': 'سفارش لغو شد و موجودی رزروشده آزاد شد.'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_orders(request):
    orders = Order.objects.filter(user=request.user).prefetch_related('items')
    return Response(OrderSerializer(orders, many=True).data)


# ========================================
# Agricultural services and farmer procurement
# ========================================
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def create_service_request(request):
    serializer = ServiceRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    service_request = serializer.save(user=request.user if request.user.is_authenticated else None)
    return Response({
        'request': ServiceRequestSerializer(service_request).data,
        'message': 'درخواست شما ثبت شد؛ کارشناس مناسب با شما تماس می‌گیرد.'
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def create_procurement_request(request):
    serializer = ProcurementRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    procurement_request = serializer.save(user=request.user if request.user.is_authenticated else None)
    return Response({
        'request': ProcurementRequestSerializer(procurement_request).data,
        'message': 'درخواست فروش محصول ثبت شد و پس از ارزیابی با شما تماس می‌گیریم.'
    }, status=status.HTTP_201_CREATED)


# ========================================
# Farmer marketplace foundation
# ========================================
class MarketplaceListingViewSet(viewsets.ModelViewSet):
    serializer_class = MarketplaceListingSerializer
    lookup_field = 'slug'
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['title', 'crop_name', 'description', 'storefront__name']
    ordering_fields = [
        'price', 'created_at', 'harvest_date', 'quantity_available',
        'sales_count', 'discount_percent',
    ]
    ordering = ['-created_at']
    throttle_classes = [SearchRateThrottle]
    # Without this the ?page_size= parameter is silently ignored and every
    # caller is stuck with the global default.
    pagination_class = ClientConfigurablePagination

    def get_queryset(self):
        # The nested storefront serializer reports follower and listing counts.
        # Annotating them here turns two extra queries *per row* into one join,
        # which is the difference between 16 queries and 2 on a full page.
        # The nested storefront serializer reports follower and listing counts.
        # Those counts must be annotated on the *storefront* rows the
        # serializer actually reads, so the storefronts are prefetched from an
        # annotated queryset rather than joined onto the listing.
        annotated_storefronts = Storefront.objects.select_related('user').annotate(
            followers_total=Count('followers', distinct=True),
            listings_total=Count(
                'listings', filter=Q(listings__status='published'), distinct=True
            ),
        )
        base = MarketplaceListing.objects.prefetch_related(
            Prefetch('storefront', queryset=annotated_storefronts)
        )
        if self.action in {'list', 'retrieve'}:
            queryset = base.filter(status='published')
            return self._apply_marketplace_filters(queryset)
        if self.request.user.is_authenticated:
            return base.filter(storefront__user=self.request.user)
        return base.none()

    def _apply_marketplace_filters(self, queryset):
        """Server-side filters shared by the marketplace list view.

        Everything the buyer can narrow by lives here rather than in the
        client, so a filtered result set is paginated correctly instead of
        being trimmed after the fact.
        """
        params = self.request.query_params

        province = params.get('province', '').strip()
        if province:
            queryset = queryset.filter(storefront__province__iexact=province)
        city = params.get('city', '').strip()
        if city:
            queryset = queryset.filter(storefront__city__iexact=city)
        seller_type = params.get('seller_type', '').strip()
        if seller_type:
            queryset = queryset.filter(storefront__seller_type=seller_type)
        storefront_slug = params.get('storefront', '').strip()
        if storefront_slug:
            queryset = queryset.filter(storefront__slug=storefront_slug)
        crop = params.get('crop', '').strip()
        if crop:
            queryset = queryset.filter(crop_name__icontains=crop)
        unit = params.get('unit', '').strip()
        if unit:
            queryset = queryset.filter(unit__iexact=unit)
        if params.get('verified') in {'1', 'true', 'True'}:
            queryset = queryset.filter(storefront__is_verified=True)
        if params.get('in_stock') in {'1', 'true', 'True'}:
            queryset = queryset.filter(quantity_available__gt=0)

        for param, lookup in (('min_price', 'price__gte'), ('max_price', 'price__lte'),
                              ('min_quantity', 'quantity_available__gte')):
            raw = params.get(param, '').strip()
            if raw:
                try:
                    queryset = queryset.filter(**{lookup: Decimal(raw)})
                except (InvalidOperation, ValueError):
                    # An unparsable bound is ignored rather than 500-ing the
                    # whole listing page.
                    continue
        return queryset

    def get_permissions(self):
        if self.action in {'list', 'retrieve'}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'request': self.request}

    def perform_create(self, serializer):
        storefront = get_object_or_404(Storefront, user=self.request.user)
        # The seller never supplies an address; it is derived from the title and
        # de-duplicated with a numeric suffix.
        serializer.save(
            storefront=storefront,
            status='pending_review',
            slug=unique_listing_slug(serializer.validated_data.get('title', '')),
        )

    def perform_update(self, serializer):
        # Editing a rejected or published listing sends it back for review, and
        # clears the previous rejection note so stale feedback is not shown.
        serializer.save(status='pending_review', rejection_reason='')

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def mine(self, request):
        listings = self.get_queryset()
        return Response(self.get_serializer(listings, many=True).data)


@api_view(['GET', 'POST', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def my_storefront(request):
    storefront = Storefront.objects.filter(user=request.user).first()
    if request.method == 'GET':
        return Response(
            StorefrontSerializer(storefront, context={'request': request}).data if storefront else None
        )

    if request.method == 'POST':
        if storefront:
            return Response({'error': 'شما قبلاً غرفه ساخته‌اید.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = StorefrontSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        storefront = serializer.save(user=request.user)
        return Response(
            StorefrontSerializer(storefront, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    if not storefront:
        return Response({'error': 'ابتدا غرفه خود را بسازید.'}, status=status.HTTP_404_NOT_FOUND)
    # PATCH accepts multipart so the seller can set the shop avatar and cover
    # in the same request as the textual details.
    serializer = StorefrontSerializer(
        storefront, data=request.data, partial=True, context={'request': request}
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ========================================
# User Profile View - ✅ اصلاح شده
# ========================================
@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def user_profile(request):
    """
    دریافت و به‌روزرسانی پروفایل کاربر
    """
    user = request.user

    if request.method == 'GET':
        user_serializer = UserSerializer(user)
        try:
            account = user.account
            account_serializer = UserAccountSerializer(account, context={'request': request})
            return Response({
                'user': user_serializer.data,
                'account': account_serializer.data
            })
        except UserAccount.DoesNotExist:
            return Response({
                'user': user_serializer.data,
                'account': None
            })

    # PUT/PATCH: update the core account first, then the optional profile.
    # `account` must be initialised even when only a name/email is changed.
    user_serializer = UserSerializer(user, data=request.data, partial=True)
    if not user_serializer.is_valid():
        return Response(user_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    account_data = {
        key: request.data[key]
        for key in ('phone', 'gender', 'address', 'avatar')
        if key in request.data
    }

    account = getattr(user, 'account', None)
    account_serializer = None
    if account_data:
        # Validate before any database write so a bad profile payload cannot
        # partially save the user's name/email.
        account_serializer = UserAccountSerializer(
            account or UserAccount(user=user), data=account_data, partial=True,
            context={'request': request},
        )
        if not account_serializer.is_valid():
            return Response(account_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        user_serializer.save()
        if account_serializer:
            account, _created = UserAccount.objects.get_or_create(user=user)
            account_serializer.instance = account
            account_serializer.save()

    return Response({
        'user': UserSerializer(user).data,
        'account': UserAccountSerializer(account, context={'request': request}).data if account else None,
        'message': 'پروفایل با موفقیت بروزرسانی شد'
    })

@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([UploadRateThrottle])
def user_avatar(request):
    """Upload (POST) or remove (DELETE) the caller's profile picture.

    Validation lives in the serializer so the same MIME/size/dimension rules
    apply whether the avatar arrives here or through the profile endpoint.
    """
    account, _ = UserAccount.objects.get_or_create(user=request.user, defaults={'phone': ''})

    if request.method == 'DELETE':
        if account.avatar:
            account.avatar.delete(save=False)
            account.avatar = None
            account.save(update_fields=['avatar', 'updated'])
        return Response(UserAccountSerializer(account, context={'request': request}).data)

    upload = request.FILES.get('avatar')
    if not upload:
        return Response(
            {'error': 'فایل تصویر ارسال نشده است.', 'fields': {'avatar': ['تصویری انتخاب کنید.']}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    serializer = UserAccountSerializer(
        account, data={'avatar': upload}, partial=True, context={'request': request}
    )
    serializer.is_valid(raise_exception=True)
    # Replacing an avatar should not leave the previous file behind.
    old_file = account.avatar
    serializer.save()
    if old_file and old_file.name != account.avatar.name:
        old_file.delete(save=False)
    return Response(serializer.data)


# ========================================
# Payments, affiliate, finance and trust centre
# ========================================
@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def payment_options_view(_request):
    """Expose only the payment availability declared by the server registry."""
    return Response({
        'providers': [
            {
                'code': provider.code,
                'label': provider.label,
                'currency': provider.currency,
                'enabled': provider.enabled,
                'configured': provider.configured,
                'reason': provider.reason,
            }
            for provider in provider_options()
        ]
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def affiliate_me(request):
    profile = AffiliateProfile.objects.filter(user=request.user).first()
    if request.method == 'POST':
        if profile:
            return Response({'error': 'حساب همکاری در فروش قبلاً ایجاد شده است.'}, status=status.HTTP_400_BAD_REQUEST)
        profile = AffiliateProfile.objects.create(user=request.user, code=_generate_affiliate_code())
        return Response({
            'profile': AffiliateProfileSerializer(profile).data,
            'message': 'درخواست همکاری ثبت شد؛ پس از بررسی، کد برای ثبت تبدیل فعال می‌شود.'
        }, status=status.HTTP_201_CREATED)

    if not profile:
        return Response({'profile': None, 'conversions': [], 'ledger': []})

    conversions = AffiliateConversion.objects.filter(affiliate=profile).select_related('order')
    ledger = FinancialLedgerEntry.objects.filter(user=request.user, owner_type='affiliate')
    return Response({
        'profile': AffiliateProfileSerializer(profile).data,
        'conversions': AffiliateConversionSerializer(conversions, many=True).data,
        'ledger': FinancialLedgerEntrySerializer(ledger, many=True).data,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def storefront_finance(request):
    """The seller's ledger, filterable by status, type and date range."""
    storefront = get_object_or_404(Storefront, user=request.user)
    entries = FinancialLedgerEntry.objects.filter(storefront=storefront).select_related('order')

    # Balances are always computed over the *unfiltered* ledger: a filtered
    # view must not make a seller think their available balance changed.
    totals = FinancialLedgerEntry.objects.filter(storefront=storefront).values('status').annotate(total=Sum('amount'))
    balances = {row['status']: row['total'] or 0 for row in totals}

    params = request.query_params
    status_filter = params.get('status', '').strip()
    if status_filter:
        entries = entries.filter(status=status_filter)
    entry_type = params.get('entry_type', '').strip()
    if entry_type:
        entries = entries.filter(entry_type=entry_type)
    date_from = params.get('date_from', '').strip()
    if date_from:
        entries = entries.filter(created_at__date__gte=date_from)
    date_to = params.get('date_to', '').strip()
    if date_to:
        entries = entries.filter(created_at__date__lte=date_to)
    search = params.get('search', '').strip()
    if search:
        entries = entries.filter(Q(description__icontains=search) | Q(order__code__icontains=search))

    try:
        page = max(int(params.get('page', 1)), 1)
        page_size = min(max(int(params.get('page_size', 25)), 1), 100)
    except (TypeError, ValueError):
        return Response({'error': 'پارامترهای صفحه‌بندی نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)

    total_count = entries.count()
    start = (page - 1) * page_size
    return Response({
        'storefront': StorefrontSerializer(storefront, context={'request': request}).data,
        'balances': {
            'pending': balances.get('pending', 0),
            'available': balances.get('available', 0),
            'held': balances.get('held', 0),
            'paid': balances.get('paid', 0),
        },
        'count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': (total_count + page_size - 1) // page_size or 1,
        'entry_types': [{'value': value, 'label': label} for value, label in FinancialLedgerEntry.ENTRY_TYPE_CHOICES],
        'statuses': [{'value': value, 'label': label} for value, label in FinancialLedgerEntry.STATUS_CHOICES],
        'entries': FinancialLedgerEntrySerializer(entries[start:start + page_size], many=True).data,
        'notice': 'مبالغ «قابل تسویه» پس از پایان دوره رسیدگی به شکایت قابل برداشت خواهند بود.'
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def storefront_finance_export(request):
    """Download the seller's ledger as CSV.

    A UTF-8 BOM is written before the rows: without it Excel on Windows opens
    Persian text as mojibake, which makes the export useless for the audience
    most likely to need it.
    """
    import csv
    from urllib.parse import quote

    from django.http import HttpResponse

    storefront = get_object_or_404(Storefront, user=request.user)
    entries = (
        FinancialLedgerEntry.objects
        .filter(storefront=storefront)
        .select_related('order')
        .order_by('-created_at')
    )
    params = request.query_params
    if params.get('status'):
        entries = entries.filter(status=params['status'].strip())
    if params.get('entry_type'):
        entries = entries.filter(entry_type=params['entry_type'].strip())
    if params.get('date_from'):
        entries = entries.filter(created_at__date__gte=params['date_from'].strip())
    if params.get('date_to'):
        entries = entries.filter(created_at__date__lte=params['date_to'].strip())

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    # A Persian slug in the header would force base64 encoding, which some
    # browsers save literally. RFC 5987 gives an ASCII fallback plus a UTF-8
    # version, so every client gets a sensible filename.
    ascii_name = f'garinkood-ledger-{storefront.id}-{timezone.now():%Y%m%d}.csv'
    utf8_name = quote(f'گزارش-مالی-{storefront.name}-{timezone.now():%Y%m%d}.csv')
    response['Content-Disposition'] = (
        f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_name}'
    )
    response.write('\ufeff')

    writer = csv.writer(response)
    writer.writerow([
        'شناسه تراکنش', 'تاریخ', 'نوع', 'وضعیت', 'مبلغ (تومان)',
        'ارز', 'کد سفارش', 'شرح', 'تاریخ قابل تسویه',
    ])
    for entry in entries:
        writer.writerow([
            f'GKF-{entry.id:08d}',
            timezone.localtime(entry.created_at).strftime('%Y-%m-%d %H:%M'),
            entry.get_entry_type_display(),
            entry.get_status_display(),
            entry.amount,
            entry.currency,
            entry.order.code if entry.order_id else '',
            entry.description,
            timezone.localtime(entry.available_at).strftime('%Y-%m-%d') if entry.available_at else '',
        ])

    _audit(request.user, 'finance_exported', storefront, f'گزارش مالی غرفه {storefront.name} دریافت شد.', {'rows': entries.count()})
    return response


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([FeedbackRateThrottle])
def submit_feedback(request):
    serializer = PlatformFeedbackSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    feedback = serializer.save(user=request.user if request.user.is_authenticated else None)
    return Response({
        'feedback': PlatformFeedbackSerializer(feedback).data,
        'message': 'بازخورد شما ثبت شد و برای بررسی به تیم مربوطه ارسال می‌شود.'
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([FeedbackRateThrottle])
def submit_storefront_complaint(request):
    serializer = StorefrontComplaintSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    complaint = serializer.save(complainant=request.user)
    return Response({
        'complaint': StorefrontComplaintSerializer(complaint).data,
        'message': 'شکایت ثبت شد. تا زمان بررسی، وضعیت آن در پنل عملیات پیگیری می‌شود.'
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([UploadRateThrottle])
def visual_search(request):
    upload = request.FILES.get('image')
    if not upload:
        return Response({'error': 'تصویر برای جستجو الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)
    if upload.size > settings.VISUAL_SEARCH_MAX_UPLOAD_BYTES:
        return Response({'error': 'حجم تصویر از حد مجاز بیشتر است.'}, status=status.HTTP_400_BAD_REQUEST)
    if upload.content_type not in {'image/jpeg', 'image/png', 'image/webp'}:
        return Response({'error': 'فرمت تصویر باید JPG، PNG یا WebP باشد.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = VisualSearchRequestSerializer(data={'image': upload, 'target': request.data.get('target', 'product')})
    serializer.is_valid(raise_exception=True)
    search_request = serializer.save(user=request.user if request.user.is_authenticated else None)
    return Response({
        'request': VisualSearchRequestSerializer(search_request).data,
        'message': 'تصویر ثبت شد. تا اتصال موتور بینایی ماشین، نتیجهٔ خودکار نمایش داده نمی‌شود.'
    }, status=status.HTTP_201_CREATED)


# ========================================
# Loyalty rewards, wallet and seller publishing
# ========================================
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_rewards(request):
    phone = getattr(getattr(request.user, 'account', None), 'phone', '')
    coupons = Coupon.objects.filter(is_active=True).filter(
        Q(issued_to_user=request.user) | Q(issued_to_phone=phone)
    )
    return Response(CouponSerializer(coupons, many=True).data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_wallet(request):
    wallet, _ = Wallet.objects.get_or_create(user=request.user)
    wallet = Wallet.objects.prefetch_related('transactions').get(pk=wallet.pk)
    return Response(WalletSerializer(wallet).data)


class StorefrontPostViewSet(viewsets.ModelViewSet):
    """Storefront posts and stories, with Instagram-style social actions.

    Owners may edit and delete their own posts; everyone else gets the public,
    published feed. Likes, comments and story views live on nested routes so a
    single post payload can carry its own counters.
    """

    serializer_class = StorefrontPostSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def _annotate(self, queryset):
        """Attach the social counters in the same query as the rows.

        Without this each card in a feed would trigger its own COUNT for likes
        and comments plus two existence probes — the classic N+1 that makes a
        20-post page issue 80 queries.
        """
        user = self.request.user
        queryset = queryset.annotate(
            likes_total=Count('likes', distinct=True),
            comments_total=Count(
                'comments', filter=Q(comments__is_hidden=False), distinct=True
            ),
        )
        if user.is_authenticated:
            queryset = queryset.annotate(
                liked_by_me=Exists(
                    StorefrontPostLike.objects.filter(post=OuterRef('pk'), user=user)
                ),
                seen_by_me=Exists(
                    StorefrontStoryView.objects.filter(post=OuterRef('pk'), user=user)
                ),
            )
        return queryset

    def _apply_feed_filters(self, queryset):
        """Narrow the feed by the parameters the clients actually send.

        The stories strip and the posts feed are two separate sections of the
        same page, so both request the same endpoint with ?post_type=. Without
        this the strip and the feed were handed identical mixed payloads.
        """
        params = self.request.query_params
        post_type = params.get('post_type', '').strip()
        if post_type in {'post', 'story'}:
            queryset = queryset.filter(post_type=post_type)
        storefront = params.get('storefront', '').strip()
        if storefront:
            # Accept either the numeric id or the slug: the profile page has
            # the slug in the URL, list callers usually have the id.
            if storefront.isdigit():
                queryset = queryset.filter(storefront_id=int(storefront))
            else:
                queryset = queryset.filter(storefront__slug=storefront)
        return queryset

    def get_queryset(self):
        base = StorefrontPost.objects.select_related('storefront', 'storefront__user', 'listing')
        if self.action in {'list', 'retrieve', 'comments', 'like', 'seen'}:
            now = timezone.now()
            # Expired stories are gone for everyone, owner included: a story is
            # ephemeral by definition and resurfacing it would be a bug, not a
            # privilege.
            live = base.filter(Q(post_type='post') | Q(post_type='story', expires_at__gt=now))
            public = live.filter(status='published')
            # The owner also sees their own pending/rejected items in place,
            # so a post under review does not silently vanish from their page.
            if self.request.user.is_authenticated:
                public = live.filter(
                    Q(pk__in=public.values('pk')) | Q(storefront__user=self.request.user)
                )
            return self._annotate(self._apply_feed_filters(public))
        if self.request.user.is_authenticated:
            return self._annotate(base.filter(storefront__user=self.request.user))
        return base.none()

    def get_permissions(self):
        # Actions declare their own permissions (``comments`` is readable by
        # anyone). Overriding them here unconditionally made an anonymous
        # visitor's attempt to read a comment thread return 401, which the
        # frontend interceptor turns into a redirect to the login page.
        if getattr(self, 'action', None) and hasattr(self, self.action):
            handler = getattr(self, self.action)
            declared = getattr(handler, 'kwargs', {}).get('permission_classes')
            if declared:
                return [permission() for permission in declared]
        if self.action in {'list', 'retrieve'}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def _assert_owner(self, post):
        if post.storefront.user_id != self.request.user.id:
            raise PermissionDenied('این پست متعلق به غرفه شما نیست.')

    def perform_create(self, serializer):
        storefront = get_object_or_404(Storefront, user=self.request.user)
        post_type = serializer.validated_data.get('post_type', 'post')
        expires_at = serializer.validated_data.get('expires_at')
        if post_type == 'story' and not expires_at:
            expires_at = timezone.now() + timedelta(hours=24)
        serializer.save(storefront=storefront, status='pending_review', expires_at=expires_at)

    def perform_update(self, serializer):
        """An owner may revise a post; the revision goes back for review.

        Re-queuing matters: without it an approved post could be edited into
        content that was never moderated.
        """
        self._assert_owner(serializer.instance)
        serializer.save(status='pending_review')

    def perform_destroy(self, instance):
        self._assert_owner(instance)
        instance.delete()

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def mine(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @action(detail=True, methods=['post', 'delete'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        """Like (POST) or unlike (DELETE) a post — both are idempotent."""
        post = self.get_object()
        if request.method == 'POST':
            StorefrontPostLike.objects.get_or_create(post=post, user=request.user)
        else:
            StorefrontPostLike.objects.filter(post=post, user=request.user).delete()
        return Response({
            'is_liked': request.method == 'POST',
            'like_count': post.likes.count(),
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def seen(self, request, pk=None):
        """Mark a story as viewed, which greys out its ring for this user."""
        post = self.get_object()
        StorefrontStoryView.objects.get_or_create(post=post, user=request.user)
        return Response({'is_seen': True})

    @action(
        detail=True, methods=['get', 'post'],
        permission_classes=[permissions.IsAuthenticatedOrReadOnly],
    )
    def comments(self, request, pk=None):
        """List a post's comment thread, or add a comment / reply to it."""
        post = self.get_object()

        if request.method == 'GET':
            roots = (
                post.comments.filter(parent__isnull=True, is_hidden=False)
                .select_related('user', 'user__account', 'post__storefront')
                .prefetch_related(
                    Prefetch(
                        'replies',
                        queryset=StorefrontPostComment.objects.filter(is_hidden=False)
                        .select_related('user', 'user__account', 'post__storefront')
                        .order_by('created_at'),
                    )
                )
                .order_by('created_at')
            )
            return Response({
                'count': post.comments.filter(is_hidden=False).count(),
                'results': StorefrontPostCommentSerializer(
                    roots, many=True, context={'request': request}
                ).data,
            })

        serializer = StorefrontPostCommentSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        parent = None
        parent_id = request.data.get('parent')
        if parent_id:
            parent = get_object_or_404(StorefrontPostComment, pk=parent_id, post=post)

        comment = serializer.save(post=post, user=request.user, parent=parent)

        # Replying to someone notifies them in the unified inbox, so a reply is
        # never something the author has to come back and hunt for.
        if parent is not None and parent.user_id != request.user.id:
            notify_comment_reply(comment)

        return Response(
            StorefrontPostCommentSerializer(comment, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class StorefrontPostCommentViewSet(
    mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet
):
    """Editing and removing a single comment.

    The author may edit or delete their own comment; the owner of the post may
    remove (but not rewrite) anything on their page — moderation without
    putting words in someone else's mouth.
    """

    serializer_class = StorefrontPostCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return StorefrontPostComment.objects.select_related(
            'user', 'user__account', 'post', 'post__storefront'
        )

    def perform_update(self, serializer):
        if serializer.instance.user_id != self.request.user.id:
            raise PermissionDenied('فقط نویسنده می‌تواند دیدگاه را ویرایش کند.')
        serializer.save()

    def perform_destroy(self, instance):
        is_author = instance.user_id == self.request.user.id
        is_post_owner = instance.post.storefront.user_id == self.request.user.id
        if not (is_author or is_post_owner):
            raise PermissionDenied('اجازه حذف این دیدگاه را ندارید.')
        instance.delete()


# ========================================
# Management command centre (staff only)
# ========================================
def _can_manage(user, permission_codename: str) -> bool:
    return bool(user.is_superuser or user.has_perm(f'shop.{permission_codename}'))


def _audit(actor, action: str, target, summary: str, metadata: dict | None = None):
    return AdminAuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target.__class__.__name__,
        target_id=str(target.pk),
        summary=summary,
        metadata=metadata or {},
    )


@api_view(['GET'])
@permission_classes([IsModerator])
def management_dashboard(request):
    can_view_orders = _can_manage(request.user, 'view_order')
    can_view_finance = _can_manage(request.user, 'view_financialledgerentry')
    paid_revenue = Order.objects.filter(payment_status='paid').aggregate(total=Sum('total_price'))['total'] or 0 if can_view_finance else None
    pending_orders = Order.objects.filter(status='awaiting_review').count() if can_view_orders else None
    open_complaints = StorefrontComplaint.objects.exclude(status__in=['resolved', 'rejected']).count() if _can_manage(request.user, 'view_storefrontcomplaint') else None
    pending_posts = StorefrontPost.objects.filter(status='pending_review').count() if _can_manage(request.user, 'view_storefrontpost') else None
    pending_listings = MarketplaceListing.objects.filter(status='pending_review').count() if _can_manage(request.user, 'view_marketplacelisting') else None
    low_stock = Product.objects.filter(status='published', stock__lt=10).count() if _can_manage(request.user, 'view_product') else None
    recent_orders = Order.objects.prefetch_related('items').all()[:8] if can_view_orders else []
    return Response({
        'viewer': {
            'username': request.user.username,
            'is_superuser': request.user.is_superuser,
            'groups': list(request.user.groups.values_list('name', flat=True)),
        },
        'metrics': {
            'paid_revenue': paid_revenue,
            'pending_orders': pending_orders,
            'open_complaints': open_complaints,
            'pending_posts': pending_posts,
            'pending_listings': pending_listings,
            'low_stock_products': low_stock,
            'active_storefronts': Storefront.objects.filter(is_verified=True).count() if _can_manage(request.user, 'view_storefront') else None,
            'active_affiliates': AffiliateProfile.objects.filter(status='active').count() if _can_manage(request.user, 'view_affiliateprofile') else None,
        },
        'recent_orders': OrderSerializer(recent_orders, many=True).data,
        # The review queue is surfaced on the dashboard itself so a moderator
        # sees pending work without first opening a separate tab.
        'pending_review': {
            'listings': MarketplaceListingSerializer(
                MarketplaceListing.objects.select_related('storefront')
                .filter(status='pending_review').order_by('-created_at')[:8],
                many=True, context={'request': request},
            ).data if _can_manage(request.user, 'view_marketplacelisting') else [],
            'posts': StorefrontPostSerializer(
                StorefrontPost.objects.select_related('storefront')
                .filter(status='pending_review').order_by('-created_at')[:8],
                many=True, context={'request': request},
            ).data if _can_manage(request.user, 'view_storefrontpost') else [],
        },
        'viewer_level': account_level(request.user),
        'alerts': [
            {'type': 'complaint', 'count': open_complaints, 'label': 'شکایت باز'},
            {'type': 'posts', 'count': pending_posts, 'label': 'پست/استوری در انتظار بررسی'},
            {'type': 'listings', 'count': pending_listings, 'label': 'آگهی در انتظار بررسی'},
            {'type': 'stock', 'count': low_stock, 'label': 'محصول با موجودی کم'},
        ],
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAdminLevel])
def management_staff(request):
    if account_level(request.user) < UserAccount.LEVEL_OWNER:
        return Response({'error': 'تنها مالک/سوپریوزر می‌تواند دسترسی کارمندان را تغییر دهد.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        staff = User.objects.filter(is_staff=True).prefetch_related('groups').order_by('username')
        return Response({
            'roles': list(ROLE_PERMISSIONS.keys()),
            'staff': [
                {
                    'id': member.id,
                    'username': member.username,
                    'email': member.email,
                    'is_superuser': member.is_superuser,
                    'is_active': member.is_active,
                    'groups': list(member.groups.values_list('name', flat=True)),
                }
                for member in staff
            ],
        })

    username = str(request.data.get('username', '')).strip()
    groups = request.data.get('groups', [])
    is_active = request.data.get('is_active', True)
    if not username or not isinstance(groups, list):
        return Response({'error': 'نام کاربری و فهرست نقش‌ها الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)
    invalid = set(groups) - set(ROLE_PERMISSIONS)
    if invalid:
        return Response({'error': f"نقش نامعتبر: {', '.join(sorted(invalid))}"}, status=status.HTTP_400_BAD_REQUEST)
    member = get_object_or_404(User, username=username)
    if member.is_superuser and member != request.user:
        return Response({'error': 'تغییر نقش سوپریوزر دیگر از این مسیر مجاز نیست.'}, status=status.HTTP_403_FORBIDDEN)
    member.is_staff = True
    member.is_active = bool(is_active)
    member.save(update_fields=['is_staff', 'is_active'])
    member.groups.set(Group.objects.filter(name__in=groups))
    _audit(request.user, 'staff_roles_updated', member, f'نقش‌های {member.username} به‌روزرسانی شد.', {'groups': groups, 'is_active': bool(is_active)})
    return Response({'username': member.username, 'groups': list(member.groups.values_list('name', flat=True)), 'is_active': member.is_active})


@api_view(['GET'])
@permission_classes([IsModerator])
def management_audit(request):
    if not request.user.is_superuser and not _can_manage(request.user, 'view_adminauditlog'):
        return Response({'error': 'دسترسی مشاهده لاگ مدیریتی ندارید.'}, status=status.HTTP_403_FORBIDDEN)
    return Response(AdminAuditLogSerializer(AdminAuditLog.objects.select_related('actor')[:100], many=True).data)


@api_view(['POST'])
@permission_classes([IsModerator])
def management_mark_order_paid(request, code):
    if not _can_manage(request.user, 'change_order'):
        return Response({'error': 'مجوز مدیریت سفارش ندارید.'}, status=status.HTTP_403_FORBIDDEN)
    order = get_object_or_404(Order, code=code)
    try:
        order, coupon = mark_order_paid_and_reward(order)
    except ValueError as error:
        return Response({'error': str(error)}, status=status.HTTP_409_CONFLICT)
    _audit(request.user, 'order_paid', order, f'پرداخت سفارش {order.code} تأیید شد.', {'coupon': coupon.code if coupon else None})
    return Response({'order': OrderSerializer(order).data, 'coupon': CouponSerializer(coupon).data if coupon else None})


@api_view(['POST'])
@permission_classes([IsModerator])
def management_moderate_content(request, content_type, object_id):
    """Approve or reject one piece of content.

    Rejecting requires a reason: it is stored on the listing so the seller can
    read *why* it was rejected, and mirrored into the audit log so the decision
    is attributable.
    """
    status_value = request.data.get('status')
    reason = str(request.data.get('reason', '')).strip()
    rejecting = status_value == 'rejected'
    if rejecting and len(reason) < 5:
        return Response(
            {
                'error': 'برای رد محتوا باید دلیل بنویسید.',
                'fields': {'reason': ['دلیل رد باید حداقل ۵ کاراکتر باشد.']},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if content_type == 'comment':
        if not _can_manage(request.user, 'change_comment'):
            return Response({'error': 'مجوز مدیریت کامنت ندارید.'}, status=status.HTTP_403_FORBIDDEN)
        obj = get_object_or_404(Comment, id=object_id)
        obj.active = status_value == 'published'
        obj.save(update_fields=['active', 'updated'])
    elif content_type == 'post':
        if not _can_manage(request.user, 'change_storefrontpost'):
            return Response({'error': 'مجوز مدیریت محتوا ندارید.'}, status=status.HTTP_403_FORBIDDEN)
        if status_value not in dict(StorefrontPost.STATUS_CHOICES):
            return Response({'error': 'وضعیت محتوا نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
        obj = get_object_or_404(StorefrontPost, id=object_id)
        obj.status = status_value
        obj.save(update_fields=['status', 'updated_at'])
    elif content_type == 'listing':
        if not _can_manage(request.user, 'change_marketplacelisting'):
            return Response({'error': 'مجوز مدیریت آگهی ندارید.'}, status=status.HTTP_403_FORBIDDEN)
        if status_value not in dict(MarketplaceListing.STATUS_CHOICES):
            return Response({'error': 'وضعیت آگهی نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
        obj = get_object_or_404(MarketplaceListing, id=object_id)
        obj.status = status_value
        obj.rejection_reason = reason if rejecting else ''
        obj.reviewed_at = timezone.now()
        obj.reviewed_by = request.user
        obj.save(update_fields=[
            'status', 'rejection_reason', 'reviewed_at', 'reviewed_by', 'updated_at',
        ])
    else:
        return Response({'error': 'نوع محتوا نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)

    _audit(
        request.user,
        'content_rejected' if rejecting else 'content_moderated',
        obj,
        f'{content_type} {object_id} به {status_value} تغییر کرد.',
        {'status': status_value, 'reason': reason},
    )
    return Response({'id': obj.id, 'status': status_value, 'reason': reason})


@api_view(['POST'])
@permission_classes([IsModerator])
def management_bulk_moderate(request):
    """Approve or reject many items of one type in a single transaction.

    Either the whole batch applies or none of it does, so a partially-moderated
    queue cannot result from one failing row.
    """
    content_type = str(request.data.get('content_type', '')).strip()
    ids = request.data.get('ids') or []
    status_value = request.data.get('status')
    reason = str(request.data.get('reason', '')).strip()

    if content_type not in {'listing', 'post', 'comment'}:
        return Response({'error': 'نوع محتوا نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(ids, list) or not ids:
        return Response(
            {'error': 'حداقل یک مورد را انتخاب کنید.', 'fields': {'ids': ['فهرست شناسه‌ها خالی است.']}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(ids) > 100:
        return Response({'error': 'در هر درخواست حداکثر ۱۰۰ مورد قابل بررسی است.'}, status=status.HTTP_400_BAD_REQUEST)
    rejecting = status_value == 'rejected'
    if rejecting and len(reason) < 5:
        return Response(
            {'error': 'برای رد گروهی باید دلیل بنویسید.', 'fields': {'reason': ['دلیل رد الزامی است.']}},
            status=status.HTTP_400_BAD_REQUEST,
        )

    permission_map = {
        'listing': 'change_marketplacelisting',
        'post': 'change_storefrontpost',
        'comment': 'change_comment',
    }
    if not _can_manage(request.user, permission_map[content_type]):
        return Response({'error': 'مجوز لازم برای این عملیات را ندارید.'}, status=status.HTTP_403_FORBIDDEN)

    with transaction.atomic():
        if content_type == 'listing':
            if status_value not in dict(MarketplaceListing.STATUS_CHOICES):
                return Response({'error': 'وضعیت آگهی نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
            updated = MarketplaceListing.objects.filter(id__in=ids).update(
                status=status_value,
                rejection_reason=reason if rejecting else '',
                reviewed_at=timezone.now(),
                reviewed_by=request.user,
                updated_at=timezone.now(),
            )
        elif content_type == 'post':
            if status_value not in dict(StorefrontPost.STATUS_CHOICES):
                return Response({'error': 'وضعیت محتوا نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
            updated = StorefrontPost.objects.filter(id__in=ids).update(
                status=status_value, updated_at=timezone.now()
            )
        else:
            updated = Comment.objects.filter(id__in=ids).update(
                active=status_value == 'published', updated=timezone.now()
            )

        AdminAuditLog.objects.create(
            actor=request.user,
            action='content_bulk_rejected' if rejecting else 'content_bulk_moderated',
            target_type=content_type,
            target_id=','.join(str(i) for i in ids[:20]),
            summary=f'{updated} مورد {content_type} به {status_value} تغییر کرد.',
            metadata={'ids': ids, 'status': status_value, 'reason': reason},
        )

    return Response({'updated': updated, 'status': status_value})


@api_view(['GET'])
@permission_classes([IsModerator])
def management_moderation_queue(request):
    """A single paginated queue across listings, posts, comments and reports.

    ``?type=`` narrows to one content type and ``?status=`` to one state;
    without them the caller gets everything currently awaiting review.
    """
    content_type = request.query_params.get('type', 'all')
    status_filter = request.query_params.get('status', 'pending')
    search = request.query_params.get('search', '').strip()
    try:
        page = max(int(request.query_params.get('page', 1)), 1)
        page_size = min(max(int(request.query_params.get('page_size', 20)), 1), 100)
    except (TypeError, ValueError):
        return Response({'error': 'پارامترهای صفحه‌بندی نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)

    rows = []

    if content_type in {'all', 'listing'} and _can_manage(request.user, 'view_marketplacelisting'):
        listings = MarketplaceListing.objects.select_related('storefront')
        if status_filter == 'pending':
            listings = listings.filter(status='pending_review')
        elif status_filter != 'all':
            listings = listings.filter(status=status_filter)
        if search:
            listings = listings.filter(Q(title__icontains=search) | Q(storefront__name__icontains=search))
        for listing in listings.order_by('-created_at')[:500]:
            rows.append({
                'type': 'listing',
                'id': listing.id,
                'title': listing.title,
                'excerpt': listing.description[:160],
                'status': listing.status,
                'status_label': listing.get_status_display(),
                'storefront': listing.storefront.name,
                'storefront_slug': listing.storefront.slug,
                'image_url': listing.image_url,
                'rejection_reason': listing.rejection_reason,
                'created_at': listing.created_at,
            })

    if content_type in {'all', 'post'} and _can_manage(request.user, 'view_storefrontpost'):
        posts = StorefrontPost.objects.select_related('storefront')
        if status_filter == 'pending':
            posts = posts.filter(status='pending_review')
        elif status_filter != 'all':
            posts = posts.filter(status=status_filter)
        if search:
            posts = posts.filter(Q(caption__icontains=search) | Q(storefront__name__icontains=search))
        for post in posts.order_by('-created_at')[:500]:
            rows.append({
                'type': 'post',
                'id': post.id,
                'title': post.get_post_type_display(),
                'excerpt': post.caption[:160],
                'status': post.status,
                'status_label': post.get_status_display(),
                'storefront': post.storefront.name,
                'storefront_slug': post.storefront.slug,
                'image_url': post.image_url,
                'rejection_reason': '',
                'created_at': post.created_at,
            })

    if content_type in {'all', 'comment'} and _can_manage(request.user, 'view_comment'):
        comments = Comment.objects.select_related('product')
        if status_filter == 'pending':
            comments = comments.filter(active=False)
        elif status_filter == 'published':
            comments = comments.filter(active=True)
        if search:
            comments = comments.filter(Q(body__icontains=search) | Q(name__icontains=search))
        for comment in comments.order_by('-created')[:500]:
            rows.append({
                'type': 'comment',
                'id': comment.id,
                'title': f'نظر {comment.name}',
                'excerpt': comment.body[:160],
                'status': 'published' if comment.active else 'pending_review',
                'status_label': 'منتشر شده' if comment.active else 'در انتظار بررسی',
                'storefront': '',
                'storefront_slug': '',
                'image_url': comment.image.url if comment.image else '',
                'rejection_reason': '',
                'created_at': comment.created,
            })

    if content_type in {'all', 'feedback'} and _can_manage(request.user, 'view_platformfeedback'):
        feedback = PlatformFeedback.objects.all()
        if status_filter == 'pending':
            feedback = feedback.filter(status='new')
        elif status_filter != 'all':
            feedback = feedback.filter(status=status_filter)
        if search:
            feedback = feedback.filter(Q(subject__icontains=search) | Q(message__icontains=search))
        for entry in feedback.order_by('-created_at')[:500]:
            rows.append({
                'type': 'feedback',
                'id': entry.id,
                'title': entry.subject,
                'excerpt': entry.message[:160],
                'status': entry.status,
                'status_label': entry.get_status_display(),
                'storefront': '',
                'storefront_slug': '',
                'image_url': '',
                'rejection_reason': '',
                'created_at': entry.created_at,
            })

    if content_type in {'all', 'complaint'} and _can_manage(request.user, 'view_storefrontcomplaint'):
        complaints = StorefrontComplaint.objects.select_related('storefront')
        if status_filter == 'pending':
            complaints = complaints.exclude(status__in=['resolved', 'rejected'])
        elif status_filter != 'all':
            complaints = complaints.filter(status=status_filter)
        if search:
            complaints = complaints.filter(Q(subject__icontains=search) | Q(description__icontains=search))
        for complaint in complaints.order_by('-created_at')[:500]:
            rows.append({
                'type': 'complaint',
                'id': complaint.id,
                'title': complaint.subject,
                'excerpt': complaint.description[:160],
                'status': complaint.status,
                'status_label': complaint.get_status_display(),
                'storefront': complaint.storefront.name,
                'storefront_slug': complaint.storefront.slug,
                'image_url': '',
                'rejection_reason': complaint.resolution_note,
                'created_at': complaint.created_at,
            })

    rows.sort(key=lambda row: row['created_at'], reverse=True)
    total = len(rows)
    start = (page - 1) * page_size
    return Response({
        'count': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size or 1,
        'results': rows[start:start + page_size],
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAdminLevel])
def management_users(request):
    """List platform users and change their access level.

    Guardrails encoded here rather than left to the UI:
    * only a level-5 owner may create or modify another owner;
    * an owner can never be demoted or deactivated through this endpoint —
      including by themselves, which would otherwise lock the platform out.
    """
    actor_level = account_level(request.user)

    if request.method == 'GET':
        search = request.query_params.get('search', '').strip()
        level_filter = request.query_params.get('level', '').strip()
        try:
            page = max(int(request.query_params.get('page', 1)), 1)
            page_size = min(max(int(request.query_params.get('page_size', 20)), 1), 100)
        except (TypeError, ValueError):
            return Response({'error': 'پارامترهای صفحه‌بندی نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = User.objects.select_related('account').prefetch_related('groups').order_by('-date_joined')
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | Q(email__icontains=search) |
                Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )
        if level_filter.isdigit():
            queryset = queryset.filter(account__level=int(level_filter))

        total = queryset.count()
        start = (page - 1) * page_size
        members = queryset[start:start + page_size]
        return Response({
            'count': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size or 1,
            'levels': [{'value': value, 'label': label} for value, label in UserAccount.LEVEL_CHOICES],
            'results': [
                {
                    'id': member.id,
                    'username': member.username,
                    'email': member.email,
                    'full_name': member.get_full_name(),
                    'level': account_level(member),
                    'level_label': dict(UserAccount.LEVEL_CHOICES).get(account_level(member), ''),
                    'is_active': member.is_active,
                    'is_staff': member.is_staff,
                    'is_superuser': member.is_superuser,
                    'groups': list(member.groups.values_list('name', flat=True)),
                    'date_joined': member.date_joined,
                }
                for member in members
            ],
        })

    username = str(request.data.get('username', '')).strip()
    if not username:
        return Response(
            {'error': 'نام کاربری الزامی است.', 'fields': {'username': ['نام کاربری را وارد کنید.']}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    member = get_object_or_404(User.objects.select_related('account'), username=username)
    member_level = account_level(member)

    if member_level >= UserAccount.LEVEL_OWNER:
        return Response(
            {'error': 'حساب مالک سیستم قابل تغییر یا حذف نیست.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    new_level = request.data.get('level')
    if new_level is not None:
        try:
            new_level = int(new_level)
        except (TypeError, ValueError):
            return Response(
                {'error': 'سطح دسترسی نامعتبر است.', 'fields': {'level': ['سطح باید عددی بین ۱ تا ۵ باشد.']}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_level not in dict(UserAccount.LEVEL_CHOICES):
            return Response(
                {'error': 'سطح دسترسی نامعتبر است.', 'fields': {'level': ['سطح باید عددی بین ۱ تا ۵ باشد.']}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_level >= UserAccount.LEVEL_OWNER and actor_level < UserAccount.LEVEL_OWNER:
            return Response(
                {'error': 'تنها مالک سیستم می‌تواند مالک جدید تعیین کند.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if new_level >= actor_level and actor_level < UserAccount.LEVEL_OWNER:
            return Response(
                {'error': 'نمی‌توانید سطحی برابر یا بالاتر از سطح خودتان اعطا کنید.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            account, _ = UserAccount.objects.get_or_create(user=member, defaults={'phone': ''})
            account.level = new_level
            account.save(update_fields=['level', 'updated'])
            # Staff levels need the Django flag too so the admin site and any
            # IsAdminUser-protected endpoint stay consistent with the level.
            member.is_staff = new_level in UserAccount.STAFF_LEVELS
            if new_level >= UserAccount.LEVEL_OWNER:
                member.is_superuser = True
            member.save(update_fields=['is_staff', 'is_superuser'])
        _audit(request.user, 'user_level_changed', member, f'سطح {member.username} به {new_level} تغییر کرد.', {'level': new_level})

    if 'is_active' in request.data:
        member.is_active = bool(request.data.get('is_active'))
        member.save(update_fields=['is_active'])
        _audit(request.user, 'user_activation_changed', member, f'وضعیت فعال بودن {member.username} تغییر کرد.', {'is_active': member.is_active})

    member.refresh_from_db()
    return Response({
        'username': member.username,
        'level': account_level(member),
        'is_active': member.is_active,
        'is_staff': member.is_staff,
    })
