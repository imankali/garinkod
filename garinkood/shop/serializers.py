from rest_framework import serializers
from django.conf import settings
from django.contrib.auth.models import User
from .models import (
    Category, SubCategory, Product, Location, AgriInput, AgriInputDose,
    StorefrontFollow, StorefrontHighlight, StorefrontHighlightItem,
    FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail,
    UserAccount, Comment, Cart, CartItem, Order, OrderItem,
    ServiceRequest, ProcurementRequest, Storefront, MarketplaceListing,
    PaymentAttempt, AffiliateProfile, AffiliateConversion, FinancialLedgerEntry,
    PlatformFeedback, StorefrontComplaint, VisualSearchRequest, Coupon, Wallet,
    WalletTransaction, StorefrontPost, AdminAuditLog
)
from .slugs import slugify_fa, unique_storefront_slug


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
            'id', 'product', 'name', 'email', 'body', 'image', 'sticker', 'parent',
            'created', 'updated', 'active', 'replies'
        ]
        read_only_fields = ['created', 'updated', 'active']

    def validate_image(self, image):
        if image and image.size > settings.VISUAL_SEARCH_MAX_UPLOAD_BYTES:
            raise serializers.ValidationError('حجم تصویر نظر از حد مجاز بیشتر است.')
        return image

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
    avatar_url = serializers.SerializerMethodField()
    level_label = serializers.CharField(source='get_level_display', read_only=True)
    has_storefront = serializers.SerializerMethodField()

    class Meta:
        model = UserAccount
        fields = [
            'id', 'username', 'email', 'full_name', 'phone',
            'gender', 'address', 'avatar', 'avatar_url', 'level', 'level_label',
            'has_storefront', 'created', 'updated'
        ]
        # `level` is derived from what the user owns and may only be changed
        # through the management API, never by the profile endpoint.
        read_only_fields = ['created', 'updated', 'level', 'level_label', 'avatar_url', 'has_storefront']

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if not obj.avatar:
            return ''
        return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url

    def get_has_storefront(self, obj):
        return Storefront.objects.filter(user_id=obj.user_id).exists()

    def validate_avatar(self, image):
        """Reject anything that is not a reasonably sized, real raster image."""
        if not image:
            return image
        max_bytes = settings.AVATAR_MAX_UPLOAD_BYTES
        if image.size > max_bytes:
            raise serializers.ValidationError(
                f'حجم تصویر پروفایل باید کمتر از {max_bytes // (1024 * 1024)} مگابایت باشد.'
            )
        content_type = getattr(image, 'content_type', '')
        if content_type and content_type not in settings.AVATAR_ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError('فرمت تصویر باید JPEG، PNG یا WebP باشد.')
        width = getattr(image, 'image', None)
        if width is not None:
            if image.image.width < 64 or image.image.height < 64:
                raise serializers.ValidationError('ابعاد تصویر باید حداقل ۶۴×۶۴ پیکسل باشد.')
            if image.image.width > 4096 or image.image.height > 4096:
                raise serializers.ValidationError('ابعاد تصویر نباید بیشتر از ۴۰۹۶ پیکسل باشد.')
        return image


# ========================================
# Cart Serializers
# ========================================
class CartListingSerializer(serializers.ModelSerializer):
    """The listing fields a cart row needs, without the full storefront tree."""

    storefront_name = serializers.CharField(source='storefront.name', read_only=True)
    storefront_slug = serializers.CharField(source='storefront.slug', read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = MarketplaceListing
        fields = [
            'id', 'title', 'slug', 'price', 'unit', 'quantity_available',
            'min_order_quantity', 'image_url', 'storefront_name', 'storefront_slug',
        ]
        read_only_fields = fields

    def get_image_url(self, obj):
        return obj.image_url


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    listing = CartListingSerializer(read_only=True)
    kind = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True)
    unit_price = serializers.IntegerField(read_only=True)
    total_price = serializers.IntegerField(read_only=True)
    available_quantity = serializers.IntegerField(read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    min_order_quantity = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = [
            'id', 'kind', 'product', 'listing', 'title', 'quantity', 'unit_price',
            'total_price', 'available_quantity', 'min_order_quantity', 'is_in_stock',
        ]

    def get_min_order_quantity(self, obj):
        return obj.listing.minimum_order if obj.listing_id else 1


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
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    seller_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'kind', 'kind_label', 'product', 'listing', 'product_title', 'product_slug',
            'storefront', 'storefront_name', 'storefront_slug', 'seller_name',
            'unit', 'unit_price', 'quantity', 'total_price',
        ]
        read_only_fields = fields

    def get_seller_name(self, obj):
        if not obj.seller_id:
            return ''
        return obj.seller.get_full_name() or obj.seller.username


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
            'address', 'postal_code', 'notes', 'subtotal', 'discount_amount',
            'coupon_code', 'shipping_price', 'total_price', 'status', 'status_label', 'payment_status',
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
    coupon_code = serializers.CharField(max_length=40, required=False, allow_blank=True)
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
    # Sellers submit a name; the address is derived from it unless they supply
    # one explicitly, so `slug` is optional on input.
    slug = serializers.SlugField(max_length=180, required=False, allow_blank=True)
    owner_name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()
    seller_type_label = serializers.CharField(source='get_seller_type_display', read_only=True)
    followers_count = serializers.IntegerField(read_only=True)
    listing_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = Storefront
        fields = [
            'id', 'name', 'slug', 'seller_type', 'seller_type_label', 'bio',
            'avatar', 'avatar_url', 'cover', 'cover_url', 'province', 'city',
            'is_verified', 'is_active', 'commission_rate', 'rating', 'sales_count',
            'followers_count', 'listing_count', 'is_following', 'owner_name', 'created_at'
        ]
        read_only_fields = [
            'id', 'is_verified', 'is_active', 'commission_rate', 'rating', 'sales_count',
            'owner_name', 'created_at', 'avatar_url', 'cover_url', 'seller_type_label',
            'followers_count', 'listing_count', 'is_following',
        ]

    def get_owner_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_avatar_url(self, obj):
        return obj.avatar_url

    def get_cover_url(self, obj):
        return obj.cover_url

    def get_listing_count(self, obj):
        return obj.published_listing_count

    def get_is_following(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return StorefrontFollow.objects.filter(storefront=obj, user=request.user).exists()

    def validate_name(self, name):
        """Reject a name already taken by another storefront, case-insensitively."""
        cleaned = ' '.join(name.split())
        if len(cleaned) < 3:
            raise serializers.ValidationError('نام غرفه باید حداقل ۳ کاراکتر باشد.')
        taken = Storefront.objects.filter(name__iexact=cleaned)
        if self.instance:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError('این نام غرفه قبلاً ثبت شده است. نام دیگری انتخاب کنید.')
        return cleaned

    def validate_slug(self, slug):
        if not slug:
            return ''
        cleaned = slugify_fa(slug)
        if not cleaned:
            raise serializers.ValidationError('آدرس غرفه معتبر نیست.')
        taken = Storefront.objects.filter(slug=cleaned)
        if self.instance:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError('این آدرس قبلاً استفاده شده است.')
        return cleaned

    def validate(self, attrs):
        # A storefront created without an explicit address gets one derived
        # from its name, so the seller never has to invent a slug by hand.
        if not self.instance and not attrs.get('slug'):
            attrs['slug'] = unique_storefront_slug(attrs.get('name', ''))
        return attrs


class StorefrontHighlightItemSerializer(serializers.ModelSerializer):
    image_url = serializers.CharField(source='post.image_url', read_only=True)
    caption = serializers.CharField(source='post.caption', read_only=True)
    created_at = serializers.DateTimeField(source='post.created_at', read_only=True)

    class Meta:
        model = StorefrontHighlightItem
        fields = ['id', 'post', 'position', 'image_url', 'caption', 'created_at']
        read_only_fields = ['id', 'image_url', 'caption', 'created_at']


class StorefrontHighlightSerializer(serializers.ModelSerializer):
    items = StorefrontHighlightItemSerializer(many=True, read_only=True)
    cover_url = serializers.SerializerMethodField()
    post_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False,
        help_text='شناسه استوری‌هایی که در این هایلایت قرار می‌گیرند.'
    )

    class Meta:
        model = StorefrontHighlight
        fields = ['id', 'title', 'cover', 'cover_url', 'position', 'items', 'post_ids', 'created_at']
        read_only_fields = ['id', 'cover_url', 'items', 'created_at']

    def get_cover_url(self, obj):
        return obj.cover_url

    def validate_post_ids(self, post_ids):
        """Only the requesting seller's own published stories may be highlighted."""
        request = self.context.get('request')
        if not request:
            return post_ids
        owned = set(
            StorefrontPost.objects
            .filter(id__in=post_ids, storefront__user=request.user)
            .values_list('id', flat=True)
        )
        invalid = [pid for pid in post_ids if pid not in owned]
        if invalid:
            raise serializers.ValidationError('برخی از استوری‌های انتخاب‌شده متعلق به غرفه شما نیستند.')
        return post_ids


class MarketplaceListingSerializer(serializers.ModelSerializer):
    storefront = StorefrontSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    is_purchasable = serializers.BooleanField(read_only=True)
    minimum_order = serializers.IntegerField(read_only=True)

    class Meta:
        model = MarketplaceListing
        fields = [
            'id', 'storefront', 'title', 'slug', 'crop_name', 'description',
            'price', 'unit', 'quantity_available', 'min_order_quantity', 'minimum_order',
            'harvest_date', 'image', 'image_url', 'status', 'status_label',
            'is_purchasable', 'rejection_reason', 'reviewed_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'storefront', 'slug', 'status', 'status_label', 'image_url',
            'is_purchasable', 'minimum_order', 'rejection_reason', 'reviewed_at',
            'created_at', 'updated_at',
        ]

    def get_image_url(self, obj):
        return obj.image_url

    def validate_min_order_quantity(self, value):
        if value is None:
            return 1
        if value <= 0:
            raise serializers.ValidationError('حداقل سفارش باید بزرگ‌تر از صفر باشد.')
        return value

    def validate(self, attrs):
        """The minimum order can never exceed what is actually on offer."""
        available = attrs.get(
            'quantity_available',
            getattr(self.instance, 'quantity_available', None),
        )
        minimum = attrs.get(
            'min_order_quantity',
            getattr(self.instance, 'min_order_quantity', None),
        )
        if available is not None and minimum is not None and minimum > available:
            raise serializers.ValidationError({
                'min_order_quantity': 'حداقل سفارش نمی‌تواند از موجودی آگهی بیشتر باشد.'
            })
        return attrs


# ========================================
# Geography
# ========================================
class LocationSerializer(serializers.ModelSerializer):
    province_name = serializers.CharField(read_only=True)

    class Meta:
        model = Location
        fields = ['id', 'name', 'slug', 'kind', 'parent', 'province_name']
        read_only_fields = fields


# ========================================
# Agricultural input reference data
# ========================================
class AgriInputDoseSerializer(serializers.ModelSerializer):
    basis_label = serializers.CharField(source='get_basis_display', read_only=True)

    class Meta:
        model = AgriInputDose
        fields = [
            'id', 'crop_name', 'target', 'basis', 'basis_label',
            'min_rate', 'max_rate', 'rate_unit', 'notes',
        ]
        read_only_fields = fields


class AgriInputSerializer(serializers.ModelSerializer):
    doses = AgriInputDoseSerializer(many=True, read_only=True)
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    product_slug = serializers.CharField(source='product.slug', read_only=True, default='')

    class Meta:
        model = AgriInput
        fields = [
            'id', 'name', 'slug', 'kind', 'kind_label', 'active_ingredient',
            'formulation', 'unit', 'product', 'product_slug', 'safety_notes',
            'preharvest_interval_days', 'doses',
        ]
        read_only_fields = fields

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


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'description', 'discount_type', 'discount_value',
            'max_discount_amount', 'min_order_amount', 'usage_limit', 'usage_count',
            'is_active', 'valid_from', 'valid_until'
        ]
        read_only_fields = fields


class WalletTransactionSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    type_label = serializers.CharField(source='get_transaction_type_display', read_only=True)

    class Meta:
        model = WalletTransaction
        fields = ['id', 'order', 'amount', 'transaction_type', 'type_label', 'status', 'status_label', 'description', 'created_at', 'available_at']
        read_only_fields = fields


class WalletSerializer(serializers.ModelSerializer):
    transactions = WalletTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = Wallet
        fields = ['id', 'currency', 'balance', 'updated_at', 'transactions']
        read_only_fields = fields


class StorefrontPostSerializer(serializers.ModelSerializer):
    storefront_name = serializers.CharField(source='storefront.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    post_type_label = serializers.CharField(source='get_post_type_display', read_only=True)

    class Meta:
        model = StorefrontPost
        fields = [
            'id', 'storefront', 'storefront_name', 'listing', 'post_type',
            'post_type_label', 'caption', 'image', 'image_url', 'status',
            'status_label', 'expires_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'storefront', 'storefront_name', 'image_url', 'status', 'status_label', 'created_at', 'updated_at']

    def validate_image(self, image):
        if image and image.size > settings.VISUAL_SEARCH_MAX_UPLOAD_BYTES:
            raise serializers.ValidationError('حجم تصویر پست از حد مجاز بیشتر است.')
        return image

    def get_image_url(self, obj):
        return obj.image_url


class AdminAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True, default='system')

    class Meta:
        model = AdminAuditLog
        fields = ['id', 'actor_username', 'action', 'target_type', 'target_id', 'summary', 'metadata', 'created_at']
        read_only_fields = fields
