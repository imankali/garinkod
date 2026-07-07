from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    Category, Product, Comment, UserAccount, Cart, CartItem
)
from .serializers import (
    CategorySerializer, ProductSerializer, ProductListSerializer,
    CommentSerializer, UserAccountSerializer, CartSerializer,
    UserSerializer, RegisterSerializer
)


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
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    lookup_field = 'slug'


# ========================================
# Product ViewSet
# ========================================
class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(status='published')
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category__slug', 'is_featured', 'available']
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
        cart = self._get_or_create_cart(request)
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def add(self, request):
        """افزودن محصول به سبد خرید"""
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))

        if not product_id:
            return Response(
                {'error': 'product_id الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        product = get_object_or_404(Product, id=product_id, status='published')

        if not product.is_in_stock:
            return Response(
                {'error': 'این محصول موجود نیست'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # محدودیت تعداد
        max_qty = min(10, product.stock)
        quantity = max(1, min(quantity, max_qty))

        cart = self._get_or_create_cart(request)

        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': quantity}
        )

        if not created:
            new_qty = min(cart_item.quantity + quantity, max_qty)
            cart_item.quantity = new_qty
            cart_item.save()

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
        quantity = int(request.data.get('quantity', 1))

        if not item_id:
            return Response(
                {'error': 'item_id الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cart = self._get_or_create_cart(request)
        cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)

        if quantity <= 0:
            cart_item.delete()
        else:
            max_qty = min(10, cart_item.product.stock)
            cart_item.quantity = min(quantity, max_qty)
            cart_item.save()

        serializer = CartSerializer(cart)
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

    elif request.method in ['PUT', 'PATCH']:
        # ✅ به‌روزرسانی User
        user_serializer = UserSerializer(user, data=request.data, partial=True)
        if user_serializer.is_valid():
            user_serializer.save()

            # ✅ به‌روزرسانی UserAccount (اگر وجود دارد)
            account_data = {}
            if 'phone' in request.data:
                account_data['phone'] = request.data['phone']
            if 'gender' in request.data:
                account_data['gender'] = request.data['gender']
            if 'address' in request.data:
                account_data['address'] = request.data['address']

            if account_data:
                account, created = UserAccount.objects.get_or_create(user=user)
                account_serializer = UserAccountSerializer(
                    account,
                    data=account_data,
                    partial=True
                )
                if account_serializer.is_valid():
                    account_serializer.save()

            return Response({
                'user': UserSerializer(user).data,
                'account': UserAccountSerializer(account).data if account else None,
                'message': 'پروفایل با موفقیت بروزرسانی شد'
            })

        return Response(user_serializer.errors, status=status.HTTP_400_BAD_REQUEST)