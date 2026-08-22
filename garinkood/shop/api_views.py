from contextlib import nullcontext
from threading import Lock

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .filters import ProductFilter
from .models import (
    Category, Product, Comment, UserAccount, Cart, CartItem, Order, OrderItem,
    ServiceRequest, ProcurementRequest, Storefront, MarketplaceListing
)
from .serializers import (
    CategorySerializer, ProductSerializer, ProductListSerializer,
    CommentSerializer, UserAccountSerializer, CartSerializer,
    UserSerializer, RegisterSerializer, CheckoutSerializer, OrderSerializer,
    ServiceRequestSerializer, ProcurementRequestSerializer, StorefrontSerializer,
    MarketplaceListingSerializer
)

# SQLite is used for local development only. It permits a single writer, so a
# process-local lock prevents its deferred transactions from upgrading into
# "database is locked" errors under a concurrent local smoke test. PostgreSQL
# relies on normal row locks and never takes this branch.
_SQLITE_CART_WRITE_LOCK = Lock()


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
            shipping_price = 0 if subtotal >= SHIPPING_FREE_THRESHOLD else STANDARD_SHIPPING_PRICE
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
                shipping_price=shipping_price,
                total_price=subtotal + shipping_price,
                payment_method=details['payment_method'],
                payment_status='unpaid',
                status='awaiting_review',
            )

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