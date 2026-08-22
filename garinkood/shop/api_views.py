from contextlib import nullcontext
from datetime import timedelta
from secrets import token_urlsafe
from threading import Lock

from django.conf import settings
from django.db.models import Q, Sum
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import Group, User
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .filters import ProductFilter
from .models import (
    Category, Product, Comment, UserAccount, Cart, CartItem, Order, OrderItem,
    ServiceRequest, ProcurementRequest, Storefront, MarketplaceListing,
    PaymentAttempt, AffiliateProfile, AffiliateConversion, FinancialLedgerEntry,
    PlatformFeedback, StorefrontComplaint, VisualSearchRequest, Coupon, Wallet,
    WalletTransaction, StorefrontPost, AdminAuditLog
)
from .serializers import (
    CategorySerializer, ProductSerializer, ProductListSerializer,
    CommentSerializer, UserAccountSerializer, CartSerializer,
    UserSerializer, RegisterSerializer, CheckoutSerializer, OrderSerializer,
    ServiceRequestSerializer, ProcurementRequestSerializer, StorefrontSerializer,
    MarketplaceListingSerializer, PaymentAttemptSerializer, AffiliateProfileSerializer,
    AffiliateConversionSerializer, FinancialLedgerEntrySerializer, PlatformFeedbackSerializer,
    StorefrontComplaintSerializer, VisualSearchRequestSerializer, CouponSerializer,
    WalletSerializer, StorefrontPostSerializer, AdminAuditLogSerializer
)
from .management_roles import ROLE_PERMISSIONS
from .payments import get_provider, provider_options
from .rewards import mark_order_paid_and_reward

# SQLite is used for local development only. It permits a single writer, so a
# process-local lock prevents its deferred transactions from upgrading into
# "database is locked" errors under a concurrent local smoke test. PostgreSQL
# relies on normal row locks and never takes this branch.
_SQLITE_CART_WRITE_LOCK = Lock()


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

        return Response({
            'user': UserSerializer(user).data,
            'token': token.key,
            'message': 'ورود با موفقیت انجام شد'
        })

    return Response(
        {'error': 'نام کاربری یا رمز عبور اشتباه است'},
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    """ثبت‌نام کاربر"""
    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        # ساخت UserAccount
        UserAccount.objects.create(
            user=user,
            phone=request.data.get('phone', ''),
            gender=request.data.get('gender', 'male'),
            address=request.data.get('address', '')
        )

        # ساخت Token
        token, created = Token.objects.get_or_create(user=user)

        return Response({
            'user': UserSerializer(user).data,
            'token': token.key,
            'message': 'ثبت‌نام با موفقیت انجام شد'
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """خروج کاربر"""
    try:
        request.user.auth_token.delete()
    except:
        pass

    logout(request)
    return Response({'message': 'خروج با موفقیت انجام شد'})


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
    ordering_fields = ['price', 'publish', 'created']
    ordering = ['-publish']
    lookup_field = 'slug'

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
                    for guest_item in guest_cart.items.all():
                        cart_item, created = CartItem.objects.get_or_create(
                            cart=cart,
                            product=guest_item.product,
                            defaults={'quantity': guest_item.quantity}
                        )
                        if not created:
                            new_qty = cart_item.quantity + guest_item.quantity
                            cart_item.quantity = min(new_qty, guest_item.product.stock)
                            cart_item.save()
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
            serializer = CartSerializer(cart)
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

        serializer = CartSerializer(cart)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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

        serializer = CartSerializer(cart)
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
                    CartItem.objects.select_for_update().select_related('product'),
                    id=item_id,
                    cart=cart,
                )
                if quantity <= 0:
                    cart_item.delete()
                else:
                    max_qty = min(10, cart_item.product.stock)
                    cart_item.quantity = min(quantity, max_qty)
                    cart_item.save(update_fields=['quantity'])

        serializer = CartSerializer(cart)
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
                CartItem.objects.select_related('product').filter(cart=cart).order_by('product_id')
            )
            if not cart_items:
                return Response({'error': 'سبد خرید شما خالی است.'}, status=status.HTTP_400_BAD_REQUEST)

            product_ids = [item.product_id for item in cart_items]
            locked_products = {
                product.id: product
                for product in Product.objects.select_for_update().filter(id__in=product_ids).order_by('id')
            }
            missing_or_unavailable = []
            for item in cart_items:
                product = locked_products.get(item.product_id)
                if not product or product.status != 'published' or not product.available or product.stock < item.quantity:
                    missing_or_unavailable.append(item.product.title)

            if missing_or_unavailable:
                return Response(
                    {'error': f"موجودی این کالاها تغییر کرده است: {', '.join(missing_or_unavailable)}"},
                    status=status.HTTP_409_CONFLICT,
                )

            subtotal = sum(locked_products[item.product_id].price * item.quantity for item in cart_items)
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
            for item in cart_items:
                product = locked_products[item.product_id]
                product.stock -= item.quantity
                if product.stock == 0:
                    product.available = False
                product.save(update_fields=['stock', 'available', 'updated'])
                order_items.append(OrderItem(
                    order=order,
                    product=product,
                    product_title=product.title,
                    product_slug=product.slug,
                    unit_price=product.price,
                    quantity=item.quantity,
                ))
            OrderItem.objects.bulk_create(order_items)
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
    ordering_fields = ['price', 'created_at', 'harvest_date']
    ordering = ['-created_at']

    def get_queryset(self):
        base = MarketplaceListing.objects.select_related('storefront', 'storefront__user')
        if self.action in {'list', 'retrieve'}:
            return base.filter(status='published')
        if self.request.user.is_authenticated:
            return base.filter(storefront__user=self.request.user)
        return base.none()

    def get_permissions(self):
        if self.action in {'list', 'retrieve'}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        storefront = get_object_or_404(Storefront, user=self.request.user)
        serializer.save(storefront=storefront, status='pending_review')

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def mine(self, request):
        listings = self.get_queryset()
        return Response(self.get_serializer(listings, many=True).data)


@api_view(['GET', 'POST', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def my_storefront(request):
    storefront = Storefront.objects.filter(user=request.user).first()
    if request.method == 'GET':
        return Response(StorefrontSerializer(storefront).data if storefront else None)

    if request.method == 'POST':
        if storefront:
            return Response({'error': 'شما قبلاً غرفه ساخته‌اید.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = StorefrontSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        storefront = serializer.save(user=request.user)
        return Response(StorefrontSerializer(storefront).data, status=status.HTTP_201_CREATED)

    if not storefront:
        return Response({'error': 'ابتدا غرفه خود را بسازید.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = StorefrontSerializer(storefront, data=request.data, partial=True)
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
            account_serializer = UserAccountSerializer(account)
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
        for key in ('phone', 'gender', 'address')
        if key in request.data
    }

    account = getattr(user, 'account', None)
    account_serializer = None
    if account_data:
        # Validate before any database write so a bad profile payload cannot
        # partially save the user's name/email.
        account_serializer = UserAccountSerializer(
            account or UserAccount(user=user), data=account_data, partial=True
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
        'account': UserAccountSerializer(account).data if account else None,
        'message': 'پروفایل با موفقیت بروزرسانی شد'
    })

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
    storefront = get_object_or_404(Storefront, user=request.user)
    entries = FinancialLedgerEntry.objects.filter(storefront=storefront)
    totals = entries.values('status').annotate(total=Sum('amount'))
    balances = {row['status']: row['total'] or 0 for row in totals}
    return Response({
        'storefront': StorefrontSerializer(storefront).data,
        'balances': {
            'pending': balances.get('pending', 0),
            'available': balances.get('available', 0),
            'held': balances.get('held', 0),
            'paid': balances.get('paid', 0),
        },
        'entries': FinancialLedgerEntrySerializer(entries[:50], many=True).data,
        'notice': 'تسویه خودکار پس از راه‌اندازی سفارش امن marketplace و تأیید پرداخت فعال می‌شود.'
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
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
    serializer_class = StorefrontPostSerializer
    filter_backends = [OrderingFilter]
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        base = StorefrontPost.objects.select_related('storefront', 'listing')
        if self.action in {'list', 'retrieve'}:
            now = timezone.now()
            return base.filter(status='published').filter(
                Q(post_type='post') |
                Q(post_type='story', expires_at__gt=now)
            )
        if self.request.user.is_authenticated:
            return base.filter(storefront__user=self.request.user)
        return base.none()

    def get_permissions(self):
        if self.action in {'list', 'retrieve'}:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        storefront = get_object_or_404(Storefront, user=self.request.user)
        post_type = serializer.validated_data.get('post_type', 'post')
        expires_at = serializer.validated_data.get('expires_at')
        if post_type == 'story' and not expires_at:
            expires_at = timezone.now() + timedelta(hours=24)
        serializer.save(storefront=storefront, status='pending_review', expires_at=expires_at)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def mine(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)


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
@permission_classes([permissions.IsAdminUser])
def management_dashboard(request):
    if not request.user.is_superuser and not request.user.groups.exists():
        return Response({'error': 'برای مرکز مدیریت باید یک نقش سازمانی داشته باشید.'}, status=status.HTTP_403_FORBIDDEN)
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
        'alerts': [
            {'type': 'complaint', 'count': open_complaints, 'label': 'شکایت باز'},
            {'type': 'posts', 'count': pending_posts, 'label': 'پست/استوری در انتظار بررسی'},
            {'type': 'listings', 'count': pending_listings, 'label': 'آگهی در انتظار بررسی'},
            {'type': 'stock', 'count': low_stock, 'label': 'محصول با موجودی کم'},
        ],
    })


@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAdminUser])
def management_staff(request):
    if not request.user.is_superuser:
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
@permission_classes([permissions.IsAdminUser])
def management_audit(request):
    if not request.user.is_superuser and not _can_manage(request.user, 'view_adminauditlog'):
        return Response({'error': 'دسترسی مشاهده لاگ مدیریتی ندارید.'}, status=status.HTTP_403_FORBIDDEN)
    return Response(AdminAuditLogSerializer(AdminAuditLog.objects.select_related('actor')[:100], many=True).data)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
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
@permission_classes([permissions.IsAdminUser])
def management_moderate_content(request, content_type, object_id):
    status_value = request.data.get('status')
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
        obj.save(update_fields=['status', 'updated_at'])
    else:
        return Response({'error': 'نوع محتوا نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
    _audit(request.user, 'content_moderated', obj, f'{content_type} {object_id} به {status_value} تغییر کرد.', {'status': status_value})
    return Response({'id': obj.id, 'status': status_value})
