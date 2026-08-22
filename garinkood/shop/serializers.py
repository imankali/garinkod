from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Category, SubCategory, Product,
    FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail,
    UserAccount, Comment, Cart, CartItem, Order, OrderItem,
    ServiceRequest, ProcurementRequest, Storefront, MarketplaceListing,
    PaymentAttempt, AffiliateProfile, AffiliateConversion, FinancialLedgerEntry,
    PlatformFeedback, StorefrontComplaint, VisualSearchRequest
)


# ========================================
# Category Serializers
# ========================================
class SubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCategory
        fields = ['id', 'name', 'slug']


class CategorySerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'image', 'subcategories', 'product_count']

    def get_product_count(self, obj):
        return obj.get_product_count()


# ========================================
# Product Detail Serializers
# ========================================
class FertilizerDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = FertilizerDetail
        fields = ['fertilizer_type', 'nitrogen', 'phosphorus', 'potassium']


class PesticideDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = PesticideDetail
        fields = ['pesticide_type', 'active_ingredient', 'concentration']


class SeedDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeedDetail
        fields = ['crop_type', 'variety', 'weight']


class EquipmentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = EquipmentDetail
        fields = ['tool_type', 'material', 'weight']


# ========================================
# Product Serializer
# ========================================
class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    subcategory = SubCategorySerializer(read_only=True)
    author = serializers.StringRelatedField(read_only=True)
    image_url = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    # ✅ اصلاح: source با underscore (مطابق related_name در models.py)
    fertilizer_detail = FertilizerDetailSerializer(read_only=True, source='fertilizer_detail')
    pesticide_detail = PesticideDetailSerializer(read_only=True, source='pesticide_detail')
    seed_detail = SeedDetailSerializer(read_only=True, source='seed_detail')
    equipment_detail = EquipmentDetailSerializer(read_only=True, source='equipment_detail')

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'slug', 'author', 'category', 'subcategory',
            'description', 'publish', 'created', 'updated', 'status',
            'price', 'stock', 'available', 'is_featured', 'image', 'image_url',
            'is_in_stock', 'fertilizer_detail', 'pesticide_detail',
            'seed_detail', 'equipment_detail'
        ]
        read_only_fields = ['created', 'updated']

    def get_image_url(self, obj):
        return obj.image_url

    def get_is_in_stock(self, obj):
        return obj.is_in_stock


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer سبک‌تر برای لیست محصولات"""
    category = serializers.StringRelatedField(read_only=True)
    image_url = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'slug', 'category', 'price', 'stock',
            'available', 'is_featured', 'image', 'image_url', 'is_in_stock'
        ]

    def get_image_url(self, obj):
        return obj.image_url

    def get_is_in_stock(self, obj):
        return obj.is_in_stock


# ========================================
# Comment Serializer
# ========================================
class CommentSerializer(serializers.ModelSerializer):
    replies = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'product', 'name', 'email', 'body', 'parent',
            'created', 'updated', 'active', 'replies'
        ]
        read_only_fields = ['created', 'updated', 'active']

    def get_replies(self, obj):
        replies = obj.replies.filter(active=True)
        return CommentSerializer(replies, many=True).data


# ========================================
# User Account Serializer
# ========================================
class UserAccountSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = UserAccount
        fields = [
            'id', 'username', 'email', 'full_name', 'phone',
            'gender', 'address', 'created', 'updated'
        ]
        read_only_fields = ['created', 'updated']

    def get_full_name(self, obj):
        return obj.user.get_full_name()


# ========================================
# Cart Serializers
# ========================================
class CartItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = ['id', 'product', 'quantity', 'total_price']

    def get_total_price(self, obj):
        return obj.total_price


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_price', 'total_items', 'created_at', 'updated_at']

    def get_total_price(self, obj):
        return obj.total_price

    def get_total_items(self, obj):
        return obj.total_items


# ========================================
# Auth Serializers
# ========================================
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({"password": "رمزهای عبور مطابقت ندارند"})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            password=validated_data['password']
        )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


# ========================================
# Orders and checkout
# ========================================
class OrderItemSerializer(serializers.ModelSerializer):
    total_price = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_title', 'product_slug', 'unit_price', 'quantity', 'total_price']
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_label = serializers.CharField(source='get_payment_status_display', read_only=True)
    payment_method_label = serializers.CharField(source='get_payment_method_display', read_only=True)
    total_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'code', 'customer_name', 'phone', 'email', 'province', 'city',
            'address', 'postal_code', 'notes', 'subtotal', 'shipping_price',
            'total_price', 'status', 'status_label', 'payment_status',
            'payment_status_label', 'payment_method', 'payment_method_label', 'affiliate_code',
            'total_items', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = fields


class CheckoutSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True)
    province = serializers.CharField(max_length=80)
    city = serializers.CharField(max_length=80)
    address = serializers.CharField(max_length=500)
    postal_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    # Providers are validated against server configuration at checkout time.
    # A frontend never decides whether a gateway is operational.
    payment_method = serializers.ChoiceField(
        choices=['coordination', 'zarinpal', 'stripe_card', 'paypal', 'crypto'],
        default='coordination',
    )
    affiliate_code = serializers.CharField(max_length=32, required=False, allow_blank=True)
    terms_accepted = serializers.BooleanField()

    def validate_phone(self, value):
        normalised = value.replace(' ', '').replace('-', '')
        digits = ''.join(char for char in normalised if char.isdigit())
        if len(digits) < 10 or len(digits) > 15:
            raise serializers.ValidationError('شماره تماس معتبر نیست.')
        return normalised

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError('پذیرش شرایط ثبت سفارش الزامی است.')
        return value


# ========================================
# Services, procurement and marketplace foundation
# ========================================
class ServiceRequestSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    service_label = serializers.CharField(source='get_service_type_display', read_only=True)

    class Meta:
        model = ServiceRequest
        fields = [
            'id', 'code', 'service_type', 'service_label', 'customer_name', 'phone',
            'province', 'city', 'crop', 'farm_area_hectare', 'description',
            'status', 'status_label', 'created_at'
        ]
        read_only_fields = ['id', 'code', 'status', 'status_label', 'created_at']


class ProcurementRequestSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ProcurementRequest
        fields = [
            'id', 'code', 'farmer_name', 'phone', 'crop_name', 'variety',
            'quantity', 'unit', 'requested_price', 'province', 'city',
            'harvest_date', 'description', 'status', 'status_label', 'created_at'
        ]
        read_only_fields = ['id', 'code', 'status', 'status_label', 'created_at']


class StorefrontSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Storefront
        fields = [
            'id', 'name', 'slug', 'seller_type', 'bio', 'province', 'city',
            'is_verified', 'commission_rate', 'owner_name', 'created_at'
        ]
        read_only_fields = ['id', 'is_verified', 'commission_rate', 'owner_name', 'created_at']

    def get_owner_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class MarketplaceListingSerializer(serializers.ModelSerializer):
    storefront = StorefrontSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = MarketplaceListing
        fields = [
            'id', 'storefront', 'title', 'slug', 'crop_name', 'description',
            'price', 'unit', 'quantity_available', 'min_order_quantity',
            'harvest_date', 'image', 'image_url', 'status', 'status_label',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'storefront', 'status', 'status_label', 'image_url', 'created_at', 'updated_at']

    def get_image_url(self, obj):
        return obj.image_url

# ========================================
# Payments, finance, affiliate and trust
# ========================================
class PaymentAttemptSerializer(serializers.ModelSerializer):
    provider_label = serializers.CharField(source='get_provider_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PaymentAttempt
        fields = [
            'id', 'provider', 'provider_label', 'status', 'status_label', 'amount',
            'currency', 'external_reference', 'checkout_url', 'created_at', 'verified_at', 'expires_at'
        ]
        read_only_fields = fields


class FinancialLedgerEntrySerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    entry_type_label = serializers.CharField(source='get_entry_type_display', read_only=True)

    class Meta:
        model = FinancialLedgerEntry
        fields = ['id', 'owner_type', 'entry_type', 'entry_type_label', 'status', 'status_label', 'amount', 'currency', 'description', 'created_at', 'available_at']
        read_only_fields = fields


class AffiliateProfileSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AffiliateProfile
        fields = ['id', 'code', 'commission_rate', 'status', 'status_label', 'created_at']
        read_only_fields = ['id', 'code', 'commission_rate', 'status', 'status_label', 'created_at']


class AffiliateConversionSerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source='order.code', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AffiliateConversion
        fields = ['id', 'order_code', 'commission_amount', 'status', 'status_label', 'created_at']
        read_only_fields = fields


class PlatformFeedbackSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PlatformFeedback
        fields = ['id', 'name', 'email', 'kind', 'subject', 'message', 'status', 'status_label', 'created_at']
        read_only_fields = ['id', 'status', 'status_label', 'created_at']


class StorefrontComplaintSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    storefront_name = serializers.CharField(source='storefront.name', read_only=True)

    class Meta:
        model = StorefrontComplaint
        fields = ['id', 'storefront', 'storefront_name', 'listing', 'order', 'subject', 'description', 'status', 'status_label', 'resolution_note', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'status_label', 'resolution_note', 'created_at', 'updated_at']

    def validate_listing(self, listing):
        storefront = self.initial_data.get('storefront')
        if storefront and str(listing.storefront_id) != str(storefront):
            raise serializers.ValidationError('آگهی باید متعلق به همان غرفه باشد.')
        return listing


class VisualSearchRequestSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = VisualSearchRequest
        fields = ['id', 'image', 'target', 'status', 'status_label', 'result_payload', 'created_at']
        read_only_fields = ['id', 'status', 'status_label', 'result_payload', 'created_at']
