import hashlib

from django.db.models import Count, Exists, OuterRef, Q
from rest_framework import serializers
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    Category, SubCategory, Product, Location, AgriInput, AgriInputDose,
    StorefrontFollow, StorefrontHighlight, StorefrontHighlightItem,
    FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail,
    UserAccount, Comment, Cart, CartItem, Order, OrderItem,
    ServiceRequest, ProcurementRequest, Storefront, MarketplaceListing,
    PaymentAttempt, AffiliateProfile, AffiliateConversion, FinancialLedgerEntry,
    PlatformFeedback, StorefrontComplaint, VisualSearchRequest, Coupon, Wallet,
    WalletTransaction, StorefrontPost, StorefrontConversation, StorefrontMessage,
    StorefrontPostLike, StorefrontPostComment, StorefrontStoryView,
    FarmLand, FarmCalendarEvent, FarmConsultationRequest, AdminAuditLog,
    Shipment, ShipmentTrackingEvent, WebPushSubscription,
    ProductAttribute, ListingAttribute, ProductPackage, ProductImage, Tag, ReturnPolicySettings,
    SiteArticle, Service, SitePage, SitePageBlock,
    TeamMember, BrandPartner, SiteContact, NewsletterSubscriber, PRODUCT_ATTRIBUTE_TEMPLATE,
    DeskAgent, DeskSettings, QuickReply, ConversationRating,
)
from .desk import agent_payload, desk_channel
from .phone_numbers import normalize_iranian_mobile
from .slugs import slugify_fa, unique_storefront_slug


def desk_agent_of(sender, channel: str):
    """The published profile of whoever answered a desk message.

    One message per reply must not mean one query per reply, so this reads the
    ``desk_profiles`` prefetch the thread querysets add and only falls back to a
    lookup when nothing was prefetched.
    """
    return DeskAgent.for_user(sender, desk_channel(channel))


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
        fields = [
            'id', 'name', 'slug', 'image', 'description', 'seo_title', 'seo_description',
            'subcategories', 'product_count',
        ]

    def get_product_count(self, obj) -> int:
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
class FilledRowListSerializer(serializers.ListSerializer):
    """Drop spec rows whose value is still blank.

    The admin action seeds the standard labels before anyone has typed a value.
    Filtering here (rather than with ``.exclude()``) keeps the prefetched cache
    intact, so a list of products pays one query in total instead of one per
    row.
    """

    def to_representation(self, data):
        if hasattr(data, 'all'):
            data = [row for row in data.all() if row.value]
        return super().to_representation(data)


class ProductAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAttribute
        fields = ['id', 'label', 'value', 'order']
        list_serializer_class = FilledRowListSerializer


class ListingAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListingAttribute
        fields = ['id', 'label', 'value', 'order']
        list_serializer_class = FilledRowListSerializer


class TagSerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'description', 'product_count']

    def get_product_count(self, obj) -> int:
        return obj.products.filter(status='published').count()


class ProductPackageSerializer(serializers.ModelSerializer):
    """One packaging of a product, priced and stocked on its own."""

    effective_price = serializers.IntegerField(read_only=True)
    discounted_price = serializers.IntegerField(read_only=True)
    effective_stock = serializers.IntegerField(read_only=True)
    price_per_kg = serializers.IntegerField(read_only=True)
    is_in_stock = serializers.BooleanField(read_only=True)
    expiry_days_left = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductPackage
        fields = [
            'id', 'label', 'weight_kg', 'price', 'effective_price', 'discounted_price',
            'stock', 'effective_stock', 'min_order_quantity', 'bulk_note',
            'production_date', 'expiry_date', 'expiry_days_left', 'is_in_stock',
            'price_per_kg', 'is_default',
        ]


class ProductImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'image_url', 'caption', 'order']

    def get_image_url(self, obj) -> str:
        return obj.image.url if obj.image else ''


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    subcategory = SubCategorySerializer(read_only=True)
    author = serializers.StringRelatedField(read_only=True)
    image_url = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    fertilizer_detail = FertilizerDetailSerializer(read_only=True)
    pesticide_detail = PesticideDetailSerializer(read_only=True)
    seed_detail = SeedDetailSerializer(read_only=True)
    equipment_detail = EquipmentDetailSerializer(read_only=True)
    attributes = ProductAttributeSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    gallery = serializers.SerializerMethodField()
    packages = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)

    discounted_price = serializers.SerializerMethodField()
    rating_summary = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'slug', 'author', 'category', 'subcategory',
            'description', 'publish', 'created', 'updated', 'status',
            'price', 'stock', 'available', 'is_featured', 'image', 'image_url',
            'is_in_stock', 'discount_percent', 'sales_count', 'discounted_price',
            'brand', 'sku', 'gtin', 'package_weight', 'price_on_request',
            'seo_title', 'seo_description',
            'shipping_weight_grams', 'shipping_length_cm', 'shipping_width_cm',
            'shipping_height_cm', 'fertilizer_detail', 'pesticide_detail',
            'seed_detail', 'equipment_detail', 'attributes', 'rating_summary',
            'images', 'gallery', 'packages', 'tags', 'views',
            'production_date', 'expiry_date', 'expiry_days_left', 'is_expiring_soon',
            'min_order_quantity', 'bulk_note', 'video_url',
        ]

    def get_gallery(self, obj) -> list[dict]:
        return obj.gallery

    def get_packages(self, obj) -> list[dict]:
        """Declared packagings, or one implicit entry from the product itself.

        Serving a synthetic row keeps the storefront's price/stock logic in one
        branch instead of duplicating "no package chosen" handling in the UI.
        """
        rows = list(obj.packages.all())
        if rows:
            return ProductPackageSerializer(rows, many=True).data
        return [{
            'id': None,
            'label': obj.package_weight or 'تک بسته',
            'weight_kg': None,
            'price': obj.price,
            'effective_price': obj.price,
            'discounted_price': obj.discounted_price,
            'stock': obj.stock,
            'effective_stock': obj.stock,
            'min_order_quantity': obj.min_order_quantity,
            'bulk_note': obj.bulk_note,
            'production_date': obj.production_date,
            'expiry_date': obj.expiry_date,
            'expiry_days_left': obj.expiry_days_left,
            'is_in_stock': obj.is_in_stock,
            'price_per_kg': None,
            'is_default': True,
        }]

    def get_expiry_days_left(self, obj):
        return obj.expiry_days_left

    def get_is_expiring_soon(self, obj) -> bool:
        return obj.is_expiring_soon
        read_only_fields = ['created', 'updated']

    def get_discounted_price(self, obj) -> int:
        return obj.discounted_price

    def get_image_url(self, obj) -> str:
        return obj.image_url

    def get_is_in_stock(self, obj) -> bool:
        return obj.is_in_stock

    def get_rating_summary(self, obj) -> dict:
        """Average score, review count and star distribution.

        The viewset annotates list/detail querysets; the fallback keeps the
        serializer usable from any other call site (admin exports, tests).
        """
        average = getattr(obj, 'avg_rating', None)
        count = getattr(obj, 'reviews_count', None)
        distribution = getattr(obj, 'rating_distribution', None)
        if average is None or count is None or distribution is None:
            average, count, distribution = rating_breakdown(obj)
        return {
            'average': round(float(average), 2) if average else 0,
            'reviews_count': int(count or 0),
            'distribution': distribution,
        }


def rating_breakdown(product) -> tuple[float | None, int, dict[str, int]]:
    """Average/star histogram over a product's approved top-level reviews."""
    reviews = product.comments.filter(active=True, parent__isnull=True, rating__isnull=False)
    count = reviews.count()
    if not count:
        return None, 0, {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0}
    buckets = reviews.values('rating').annotate(total=Count('rating')).order_by()
    distribution = {str(star): 0 for star in range(1, 6)}
    total = 0
    for row in buckets:
        distribution[str(row['rating'])] = row['total']
        total += row['rating'] * row['total']
    return total / count, count, distribution


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer سبک‌تر برای لیست محصولات"""
    category = serializers.StringRelatedField(read_only=True)
    image_url = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()

    discounted_price = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    image_alt_url = serializers.SerializerMethodField()
    is_expiring_soon = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'slug', 'category', 'price', 'stock',
            'available', 'is_featured', 'image', 'image_url', 'is_in_stock',
            'discount_percent', 'sales_count', 'discounted_price', 'brand', 'sku',
            'package_weight', 'price_on_request', 'avg_rating', 'reviews_count',
            'image_alt_url', 'is_expiring_soon', 'views',
        ]

    def get_image_url(self, obj) -> str:
        return obj.image_url

    def get_is_in_stock(self, obj) -> bool:
        return obj.is_in_stock

    def get_discounted_price(self, obj) -> int:
        return obj.discounted_price

    def get_avg_rating(self, obj) -> float:
        value = getattr(obj, 'avg_rating', None)
        return round(float(value), 2) if value else 0

    def get_reviews_count(self, obj) -> int:
        return int(getattr(obj, 'reviews_count', 0) or 0)

    def get_image_alt_url(self, obj) -> str:
        """Second gallery photo, for the hover swap on a card."""
        shots = obj.gallery
        return shots[1]['url'] if len(shots) > 1 else ''

    def get_is_expiring_soon(self, obj) -> bool:
        return obj.is_expiring_soon


# ========================================
# Comment Serializer
# ========================================
class CommentSerializer(serializers.ModelSerializer):
    replies = serializers.SerializerMethodField()
    is_verified_purchase = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            'id', 'product', 'name', 'email', 'body', 'image', 'sticker', 'rating',
            'parent', 'created', 'updated', 'active', 'replies', 'is_verified_purchase',
            'helpful_count', 'is_featured', 'is_reported',
        ]
        read_only_fields = ['created', 'updated', 'active']

    def validate_image(self, image):
        if image and image.size > settings.VISUAL_SEARCH_MAX_UPLOAD_BYTES:
            raise serializers.ValidationError('حجم تصویر نظر از حد مجاز بیشتر است.')
        return image

    def validate_rating(self, rating):
        # Only a real review may be scored; a reply to a question is not one.
        if rating and self.initial_data.get('parent'):
            raise serializers.ValidationError('پاسخ‌ها امتیاز ندارند؛ امتیاز فقط برای دیدگاه ثبت می‌شود.')
        return rating

    def get_is_verified_purchase(self, obj) -> bool:
        annotated = getattr(obj, 'verified_purchase', None)
        if annotated is not None:
            return bool(annotated)
        if not obj.user_id:
            return False
        return obj.user.orders.filter(
            items__product_id=obj.product_id, payment_status='paid'
        ).exists()

    def get_replies(self, obj) -> list[dict]:
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
            'id', 'username', 'email', 'full_name', 'phone', 'phone_verified_at',
            'gender', 'address', 'avatar', 'avatar_url', 'level', 'level_label',
            'has_storefront', 'created', 'updated'
        ]
        # `level` is derived from what the user owns and may only be changed
        # through the management API, never by the profile endpoint.
        read_only_fields = [
            'created', 'updated', 'level', 'level_label', 'avatar_url',
            'has_storefront', 'phone_verified_at',
        ]

    def get_full_name(self, obj):
        return obj.user.get_full_name()

    def get_avatar_url(self, obj) -> str:
        request = self.context.get('request')
        if not obj.avatar:
            return ''
        return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url

    def get_has_storefront(self, obj):
        return Storefront.objects.filter(user_id=obj.user_id).exists()

    def validate_phone(self, value):
        if not value:
            return ''
        try:
            normalised = normalize_iranian_mobile(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        duplicates = UserAccount.objects.filter(phone=normalised)
        if self.instance and self.instance.pk:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError('این شماره موبایل قبلاً برای حساب دیگری ثبت شده است.')
        return normalised

    def update(self, instance, validated_data):
        # Changing a verified number must require a fresh OTP before it can be
        # trusted for passwordless login again.
        if 'phone' in validated_data and validated_data['phone'] != instance.phone:
            instance.phone_verified_at = None
        return super().update(instance, validated_data)

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

    def get_image_url(self, obj) -> str:
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
    package_label = serializers.CharField(read_only=True)

    class Meta:
        model = CartItem
        fields = [
            'id', 'kind', 'product', 'listing', 'title', 'quantity', 'unit_price',
            'total_price', 'available_quantity', 'min_order_quantity', 'is_in_stock',
            'product_package', 'package_label',
        ]

    def get_min_order_quantity(self, obj) -> int:
        if obj.listing_id:
            return obj.listing.minimum_order
        if obj.product_package_id:
            return obj.product_package.min_order_quantity
        return obj.product.min_order_quantity


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_price', 'total_items', 'created_at', 'updated_at']

    def get_total_price(self, obj) -> int:
        return obj.total_price

    def get_total_items(self, obj) -> int:
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


class OtpRequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    channel = serializers.ChoiceField(
        choices=['auto', 'sms', 'bale'],
        default='auto',
        required=False,
    )

    def validate_phone(self, value):
        try:
            return normalize_iranian_mobile(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class OtpVerifySerializer(serializers.Serializer):
    request_id = serializers.UUIDField()
    phone = serializers.CharField(max_length=32)
    code = serializers.CharField(min_length=4, max_length=8, trim_whitespace=True)
    first_name = serializers.CharField(max_length=150, allow_blank=True, required=False, default='')
    last_name = serializers.CharField(max_length=150, allow_blank=True, required=False, default='')

    def validate_phone(self, value):
        try:
            return normalize_iranian_mobile(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


# ========================================
# Orders, shipping and checkout
# ========================================
class ShipmentTrackingEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ShipmentTrackingEvent
        fields = ['id', 'status', 'status_label', 'description', 'location', 'occurred_at']
        read_only_fields = fields


class ShipmentTrackingEventCreateSerializer(serializers.Serializer):
    """Validated staff input; provider payloads remain server/admin controlled."""

    status = serializers.ChoiceField(choices=Shipment.STATUS_CHOICES)
    description = serializers.CharField(max_length=500, trim_whitespace=True)
    location = serializers.CharField(max_length=160, required=False, allow_blank=True)
    occurred_at = serializers.DateTimeField(required=False, default=timezone.now)
    provider_event_id = serializers.CharField(max_length=160, required=False, allow_blank=True)


class ShipmentSerializer(serializers.ModelSerializer):
    provider_label = serializers.CharField(source='get_provider_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    events = ShipmentTrackingEventSerializer(many=True, read_only=True)

    class Meta:
        model = Shipment
        fields = [
            'id', 'provider', 'provider_label', 'service_name', 'status', 'status_label',
            'tracking_code', 'tracking_url', 'shipping_cost', 'shipped_at', 'delivered_at',
            'last_event_at', 'events', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class OrderItemSerializer(serializers.ModelSerializer):
    total_price = serializers.IntegerField(read_only=True)
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    seller_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'kind', 'kind_label', 'product', 'listing', 'product_title', 'product_slug',
            'storefront', 'storefront_name', 'storefront_slug', 'seller_name',
            'unit', 'unit_price', 'quantity', 'total_price', 'package_label',
        ]
        read_only_fields = fields

    def get_seller_name(self, obj):
        if not obj.seller_id:
            return ''
        return obj.seller.get_full_name() or obj.seller.username


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    shipments = ShipmentSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_label = serializers.CharField(source='get_payment_status_display', read_only=True)
    payment_method_label = serializers.CharField(source='get_payment_method_display', read_only=True)
    total_items = serializers.IntegerField(read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'code', 'customer_name', 'phone', 'email', 'province', 'city',
            'address', 'postal_code', 'latitude', 'longitude', 'notes', 'subtotal', 'discount_amount',
            'coupon_code', 'shipping_price', 'shipping_provider', 'shipping_service', 'total_price',
            'status', 'status_label', 'payment_status', 'payment_status_label', 'payment_method',
            'payment_method_label', 'affiliate_code', 'total_items', 'items', 'shipments',
            'terms_accepted_at', 'legal_version',
            'created_at', 'updated_at'
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
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, min_value=-90, max_value=90, required=False, allow_null=True
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, min_value=-180, max_value=180, required=False, allow_null=True
    )
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
    # These read an annotation when the queryset provides one and fall back to
    # a COUNT only for a single object. Without the fallback a detail view
    # would break; without the annotation a list view would run two extra
    # queries per row.
    followers_count = serializers.SerializerMethodField()
    listing_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Storefront
        fields = [
            'id', 'name', 'slug', 'seller_type', 'seller_type_label', 'bio',
            'avatar', 'avatar_url', 'cover', 'cover_url', 'province', 'city',
            'is_verified', 'is_active', 'commission_rate', 'rating', 'sales_count',
            'followers_count', 'listing_count', 'is_following', 'is_owner',
            'owner_name', 'created_at'
        ]
        read_only_fields = [
            'id', 'is_verified', 'is_active', 'commission_rate', 'rating', 'sales_count',
            'owner_name', 'created_at', 'avatar_url', 'cover_url', 'seller_type_label',
            'followers_count', 'listing_count', 'is_following', 'is_owner',
        ]

    def get_owner_name(self, obj) -> str:
        return obj.user.get_full_name() or obj.user.username

    def get_is_owner(self, obj) -> bool:
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.user_id == request.user.id)

    def get_avatar_url(self, obj) -> str:
        return obj.avatar_url

    def get_cover_url(self, obj) -> str:
        return obj.cover_url

    def get_followers_count(self, obj) -> int:
        annotated = getattr(obj, 'followers_total', None)
        return annotated if annotated is not None else obj.followers_count

    def get_listing_count(self, obj) -> int:
        annotated = getattr(obj, 'listings_total', None)
        return annotated if annotated is not None else obj.published_listing_count

    def get_is_following(self, obj) -> bool:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return StorefrontFollow.objects.filter(storefront=obj, user=request.user).exists()

    def _validate_storefront_image(self, image, label):
        """Same MIME/size/dimension rules the user avatar uses."""
        if not image:
            return image
        max_bytes = settings.AVATAR_MAX_UPLOAD_BYTES
        if image.size > max_bytes:
            raise serializers.ValidationError(
                f'حجم {label} باید کمتر از {max_bytes // (1024 * 1024)} مگابایت باشد.'
            )
        content_type = getattr(image, 'content_type', '')
        if content_type and content_type not in settings.AVATAR_ALLOWED_CONTENT_TYPES:
            raise serializers.ValidationError(f'فرمت {label} باید JPEG، PNG یا WebP باشد.')
        if getattr(image, 'image', None) is not None:
            if image.image.width < 64 or image.image.height < 64:
                raise serializers.ValidationError(f'ابعاد {label} باید حداقل ۶۴×۶۴ پیکسل باشد.')
            if image.image.width > 4096 or image.image.height > 4096:
                raise serializers.ValidationError(f'ابعاد {label} نباید بیشتر از ۴۰۹۶ پیکسل باشد.')
        return image

    def validate_avatar(self, image):
        return self._validate_storefront_image(image, 'تصویر غرفه')

    def validate_cover(self, image):
        return self._validate_storefront_image(image, 'کاور غرفه')

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

    def get_cover_url(self, obj) -> str:
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
    discounted_price = serializers.SerializerMethodField()
    # Sellers may attach the same structured spec table the catalogue uses; it is
    # optional, and writing it replaces the whole set in one call.
    attributes = ListingAttributeSerializer(many=True, required=False)

    class Meta:
        model = MarketplaceListing
        fields = [
            'id', 'storefront', 'title', 'slug', 'crop_name', 'description',
            'price', 'unit', 'quantity_available', 'min_order_quantity', 'minimum_order',
            'harvest_date', 'image', 'image_url', 'status', 'status_label',
            'is_purchasable', 'discount_percent', 'sales_count', 'discounted_price',
            'rejection_reason', 'reviewed_at', 'attributes',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'storefront', 'slug', 'status', 'status_label', 'image_url',
            'is_purchasable', 'minimum_order', 'discount_percent', 'sales_count',
            'discounted_price', 'rejection_reason', 'reviewed_at',
            'created_at', 'updated_at',
        ]

    def get_image_url(self, obj) -> str:
        return obj.image_url

    def get_discounted_price(self, obj) -> int:
        return obj.discounted_price

    def validate_min_order_quantity(self, value):
        if value is None:
            return 1
        if value <= 0:
            raise serializers.ValidationError('حداقل سفارش باید بزرگ‌تر از صفر باشد.')
        return value

    def validate_attributes(self, value):
        if len(value) > 40:
            raise serializers.ValidationError('حداکثر ۴۰ ویژگی برای هر آگهی ثبت می‌شود.')
        return value

    def _write_attributes(self, instance) -> None:
        if 'attributes' not in self.validated_data:
            return
        rows = self.validated_data['attributes']
        instance.attributes.all().delete()
        ListingAttribute.objects.bulk_create(
            [
                ListingAttribute(
                    listing=instance,
                    label=row['label'][:80],
                    value=row['value'][:300],
                    order=index,
                )
                for index, row in enumerate(rows)
            ]
        )

    def create(self, validated_data):
        rows = validated_data.pop('attributes', None)
        instance = super().create(validated_data)
        if rows:
            ListingAttribute.objects.bulk_create(
                [
                    ListingAttribute(
                        listing=instance, label=row['label'][:80], value=row['value'][:300], order=index
                    )
                    for index, row in enumerate(rows)
                ]
            )
        return instance

    def update(self, instance, validated_data):
        validated_data.pop('attributes', None)
        instance = super().update(instance, validated_data)
        self._write_attributes(instance)
        return instance

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
class WebPushSubscriptionSerializer(serializers.ModelSerializer):
    endpoint = serializers.URLField(max_length=1000, write_only=True)
    p256dh = serializers.CharField(max_length=255, write_only=True)
    auth = serializers.CharField(max_length=255, write_only=True)
    endpoint_fingerprint = serializers.SerializerMethodField()

    class Meta:
        model = WebPushSubscription
        fields = [
            'id', 'endpoint', 'endpoint_fingerprint', 'p256dh', 'auth',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'endpoint_fingerprint', 'created_at', 'updated_at']

    def get_endpoint_fingerprint(self, obj) -> str:
        return hashlib.sha256(obj.endpoint.encode('utf-8')).hexdigest()[:24]

    def validate_endpoint(self, value):
        if not value.startswith('https://'):
            raise serializers.ValidationError('نشانی سرویس Push باید HTTPS باشد.')
        return value


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
    # A stable, quotable reference the seller can cite in a support ticket.
    reference = serializers.SerializerMethodField()
    order_code = serializers.CharField(source='order.code', read_only=True, default='')

    class Meta:
        model = FinancialLedgerEntry
        fields = [
            'id', 'reference', 'owner_type', 'entry_type', 'entry_type_label',
            'status', 'status_label', 'amount', 'currency', 'description',
            'order_code', 'created_at', 'available_at',
        ]
        read_only_fields = fields

    def get_reference(self, obj):
        return f'GKF-{obj.id:08d}'


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


class StorefrontPostCommentSerializer(serializers.ModelSerializer):
    """One comment, with its replies nested exactly one level deep."""

    author_name = serializers.SerializerMethodField()
    author_avatar_url = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    can_moderate = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = StorefrontPostComment
        fields = [
            'id', 'post', 'parent', 'body', 'author_name', 'author_avatar_url',
            'is_mine', 'can_moderate', 'replies', 'created_at',
        ]
        read_only_fields = [
            'id', 'post', 'author_name', 'author_avatar_url', 'is_mine',
            'can_moderate', 'replies', 'created_at',
        ]

    def get_author_name(self, obj) -> str:
        return obj.user.get_full_name() or obj.user.username

    def get_author_avatar_url(self, obj) -> str:
        account = getattr(obj.user, 'account', None)
        return account.avatar_url if account else ''

    def get_is_mine(self, obj) -> bool:
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.user_id == request.user.id)

    def get_can_moderate(self, obj) -> bool:
        """The post's owner may remove comments on their own post."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if obj.user_id == request.user.id:
            return True
        return obj.post.storefront.user_id == request.user.id

    def get_replies(self, obj) -> list[dict]:
        # Only root comments carry replies; nesting stops at one level.
        if obj.parent_id is not None:
            return []
        replies = [reply for reply in obj.replies.all() if not reply.is_hidden]
        return StorefrontPostCommentSerializer(replies, many=True, context=self.context).data

    def validate_body(self, body):
        cleaned = body.strip()
        if not cleaned:
            raise serializers.ValidationError('متن دیدگاه را بنویسید.')
        return cleaned


class StorefrontPostSerializer(serializers.ModelSerializer):
    storefront_name = serializers.CharField(source='storefront.name', read_only=True)
    storefront_slug = serializers.CharField(source='storefront.slug', read_only=True)
    storefront_avatar_url = serializers.CharField(source='storefront.avatar_url', read_only=True)
    storefront_is_verified = serializers.BooleanField(source='storefront.is_verified', read_only=True)
    image_url = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    post_type_label = serializers.CharField(source='get_post_type_display', read_only=True)
    # Instagram-style social state.
    like_count = serializers.SerializerMethodField()
    comment_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    is_seen = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = StorefrontPost
        fields = [
            'id', 'storefront', 'storefront_name', 'storefront_slug', 'storefront_avatar_url',
            'storefront_is_verified',
            'listing', 'post_type', 'post_type_label', 'caption', 'image', 'image_url',
            'status', 'status_label', 'expires_at', 'created_at', 'updated_at',
            'like_count', 'comment_count', 'is_liked', 'is_seen', 'is_owner',
        ]
        read_only_fields = [
            'id', 'storefront', 'storefront_name', 'storefront_slug', 'storefront_avatar_url',
            'storefront_is_verified', 'image_url', 'status', 'status_label',
            'created_at', 'updated_at',
            'like_count', 'comment_count', 'is_liked', 'is_seen', 'is_owner',
        ]

    def validate_image(self, image):
        if image and image.size > settings.VISUAL_SEARCH_MAX_UPLOAD_BYTES:
            raise serializers.ValidationError('حجم تصویر پست از حد مجاز بیشتر است.')
        return image

    def get_image_url(self, obj) -> str:
        return obj.image_url

    # The list views annotate these; the fallbacks keep a single-object
    # serialisation (detail, create response) correct without them.
    def get_like_count(self, obj) -> int:
        annotated = getattr(obj, 'likes_total', None)
        return annotated if annotated is not None else obj.likes.count()

    def get_comment_count(self, obj) -> int:
        annotated = getattr(obj, 'comments_total', None)
        return annotated if annotated is not None else obj.comments.filter(is_hidden=False).count()

    def _user(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return user if (user and user.is_authenticated) else None

    def get_is_liked(self, obj) -> bool:
        annotated = getattr(obj, 'liked_by_me', None)
        if annotated is not None:
            return bool(annotated)
        user = self._user()
        return bool(user and obj.likes.filter(user=user).exists())

    def get_is_seen(self, obj) -> bool:
        annotated = getattr(obj, 'seen_by_me', None)
        if annotated is not None:
            return bool(annotated)
        user = self._user()
        return bool(user and obj.views.filter(user=user).exists())

    def get_is_owner(self, obj) -> bool:
        user = self._user()
        return bool(user and obj.storefront.user_id == user.id)


class StorefrontMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_avatar_url = serializers.SerializerMethodField()
    sender_role_label = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()
    listing = serializers.SerializerMethodField()
    land = serializers.SerializerMethodField()
    link = serializers.SerializerMethodField()
    is_system = serializers.BooleanField(read_only=True)
    attachment_url = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()
    is_edited = serializers.BooleanField(read_only=True)
    is_deleted = serializers.BooleanField(read_only=True)
    can_edit = serializers.SerializerMethodField()
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = StorefrontMessage
        fields = [
            'id', 'conversation', 'sender', 'sender_name', 'sender_avatar_url', 'sender_role_label',
            'is_mine', 'is_system', 'body',
            'listing', 'land', 'link',
            'attachment', 'attachment_url', 'attachment_type', 'attachment_duration',
            'reply_to', 'is_edited', 'edited_at', 'is_deleted', 'deleted_at',
            'can_edit', 'can_delete', 'is_read', 'created_at',
        ]
        read_only_fields = [
            'id', 'conversation', 'sender', 'sender_name', 'sender_avatar_url', 'sender_role_label',
            'is_system', 'attachment_url', 'reply_to', 'is_edited', 'edited_at', 'is_deleted',
            'deleted_at', 'can_edit', 'can_delete', 'is_read', 'created_at',
            'link', 'land',
        ]

    def get_reply_to(self, obj):
        """A compact quote of the parent message, enough to render the bubble
        header without a second request. Nested one level only."""
        parent = obj.reply_to
        if parent is None:
            return None
        return {
            'id': parent.id,
            'sender_name': self.get_sender_name(parent),
            'is_mine': self.get_is_mine(parent),
            'body': '' if parent.is_deleted else parent.body,
            'attachment_type': '' if parent.is_deleted else parent.attachment_type,
            'listing_title': (
                parent.listing.title if parent.listing_id and not parent.is_deleted else ''
            ),
            'is_deleted': parent.is_deleted,
        }

    def get_can_edit(self, obj) -> bool:
        # Only the author, only text, and not once it has been deleted.
        return bool(
            self.get_is_mine(obj) and not obj.is_deleted and not obj.attachment
        )

    def get_can_delete(self, obj) -> bool:
        return bool(self.get_is_mine(obj) and not obj.is_deleted)

    def get_sender_name(self, obj):
        """Who is speaking, named as the reader can act on it.

        A platform notice («گفتگو بسته شد») has no author and says so. In a
        storefront thread the answer comes from the shop, so the shop is named.
        In a support or consulting thread the reader asked to know *which*
        operator they are talking to — a desk with several people is only
        trustworthy if the name and photo change when the person changes, and
        the name printed is the one the admin publishes (``DeskAgent``), never a
        private username.
        """
        conversation = obj.conversation
        if obj.sender_id is None:
            return 'گرین کود'
        if obj.sender_id != conversation.customer_id:
            if conversation.channel == StorefrontConversation.CHANNEL_STOREFRONT:
                if conversation.storefront_id:
                    return conversation.storefront.name
            else:
                agent = desk_agent_of(obj.sender, conversation.channel)
                if agent is not None:
                    return agent.display_label
                return conversation.get_channel_display()
        return obj.sender.get_full_name() or obj.sender.username

    def get_sender_avatar_url(self, obj):
        conversation = obj.conversation
        if obj.sender_id is None:
            return ''
        if (
            obj.sender_id != conversation.customer_id
            and conversation.channel == StorefrontConversation.CHANNEL_STOREFRONT
            and conversation.storefront_id
        ):
            return conversation.storefront.avatar_url
        if obj.sender_id != conversation.customer_id and desk_channel(conversation.channel):
            agent = desk_agent_of(obj.sender, conversation.channel)
            if agent is not None:
                return agent.photo_url
        account = getattr(obj.sender, 'account', None)
        return account.avatar_url if account else ''

    def get_sender_role_label(self, obj) -> str:
        """«مشاور کشاورزی» under the name, so the title travels with the reply."""
        if obj.sender_id is None:
            return 'اعلان سیستم'
        conversation = obj.conversation
        if obj.sender_id != conversation.customer_id and desk_channel(conversation.channel):
            agent = desk_agent_of(obj.sender, conversation.channel)
            if agent is not None:
                return agent.title or agent.get_role_display()
            return conversation.get_channel_display()
        return ''

    def get_land(self, obj):
        """The land case file a farmer shared, in the shape a consultant reads.

        Emitted inline rather than as a link because the answer usually needs the
        soil and irrigation facts, and making the operator click away from the
        chat to remember them is how a consultation takes three days.
        """
        if obj.land_id is None:
            return None
        land = obj.land
        return {
            'id': land.id,
            'name': land.name,
            'land_type': land.land_type,
            'land_type_label': land.get_land_type_display(),
            'area_label': land.area_label,
            'crop_type': land.crop_type,
            'crop_variety': land.crop_variety,
            'province': land.province,
            'city': land.city,
            'soil_type_label': land.get_soil_type_display(),
            'irrigation_type_label': land.get_irrigation_type_display(),
            'planting_date': land.planting_date.isoformat() if land.planting_date else '',
            'notes': land.notes,
            'event_count': land.calendar_events.count(),
            'owner_name': land.owner.get_full_name() or land.owner.username,
        }

    def get_link(self, obj):
        """A button inside the bubble: the post, product or desk thread this
        notice is about. Empty for ordinary messages."""
        if not obj.link_url:
            return None
        return {'kind': obj.link_kind, 'label': obj.link_label or 'مشاهده', 'url': obj.link_url}

    def get_attachment_url(self, obj):
        return obj.attachment_url

    def get_is_mine(self, obj) -> bool:
        request = self.context.get('request')
        if obj.sender_id is None:
            return False
        return bool(request and request.user.is_authenticated and obj.sender_id == request.user.id)

    def get_listing(self, obj):
        if not obj.listing:
            return None
        return {
            'id': obj.listing.id,
            'title': obj.listing.title,
            'slug': obj.listing.slug,
            'price': obj.listing.price,
            'discounted_price': obj.listing.discounted_price,
            'unit': obj.listing.unit,
            'image_url': obj.listing.image_url,
            'storefront_name': obj.listing.storefront.name,
            'storefront_slug': obj.listing.storefront.slug,
        }

    def validate_listing(self, value):
        """A listing may only be attached to messages in its own storefront."""
        conversation = getattr(self.instance, 'conversation', None)
        if value is not None and conversation is not None and value.storefront_id != conversation.storefront_id:
            raise serializers.ValidationError('محصول انتخابی متعلق به این غرفه نیست.')
        return value


class StorefrontConversationSerializer(serializers.ModelSerializer):
    storefront = serializers.SerializerMethodField()
    counterpart_name = serializers.SerializerMethodField()
    counterpart_avatar_url = serializers.SerializerMethodField()
    channel_label = serializers.CharField(source='get_channel_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    agent = serializers.SerializerMethodField()
    last_agent = serializers.SerializerMethodField()
    assigned_to_me = serializers.SerializerMethodField()
    survey = serializers.SerializerMethodField()

    class Meta:
        model = StorefrontConversation
        fields = [
            'id', 'channel', 'channel_label', 'subject', 'storefront',
            'counterpart_name', 'counterpart_avatar_url', 'last_message', 'unread_count',
            'status', 'status_label', 'closed_at',
            'agent', 'last_agent', 'assigned_to_me', 'survey',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_storefront(self, obj):
        # Only storefront threads have one; the others report null so the
        # client renders a channel badge instead of a shop card.
        if not obj.storefront_id:
            return None
        return StorefrontSerializer(obj.storefront, context=self.context).data

    def get_counterpart_name(self, obj):
        """The name of whoever is on the *other* side, from the caller's view."""
        request = self.context.get('request')
        user = request.user if request else None
        if obj.channel != StorefrontConversation.CHANNEL_STOREFRONT:
            # Staff see the farmer/customer; the customer sees the department.
            if user and user.id != obj.customer_id:
                return obj.customer.get_full_name() or obj.customer.username
            return obj.get_channel_display()
        if user and obj.storefront_id and obj.storefront.user_id == user.id:
            return obj.customer.get_full_name() or obj.customer.username
        return obj.storefront.name if obj.storefront_id else obj.get_channel_display()

    def get_counterpart_avatar_url(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        viewer_is_customer = bool(user and user.id == obj.customer_id)
        if obj.channel == StorefrontConversation.CHANNEL_STOREFRONT and obj.storefront_id:
            if viewer_is_customer:
                return obj.storefront.avatar_url
            account = getattr(obj.customer, 'account', None)
            return account.avatar_url if account else ''
        if not viewer_is_customer:
            account = getattr(obj.customer, 'account', None)
            return account.avatar_url if account else ''
        return ''

    def get_last_message(self, obj):
        # The queryset prefetches messages newest-first, so the first cached
        # row is the latest — no extra query per conversation.
        message = next(iter(obj.messages.all()), None)
        return StorefrontMessageSerializer(message, context=self.context).data if message else None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        return obj.unread_count_for(request.user) if request else 0

    def _sender_of_last_agent_reply(self, obj):
        """The user who wrote the newest desk-side message, if any.

        The thread carries one ``agent`` for assignment, but a queue is shared:
        when a second operator replies, the reader must see *that* person. The
        inbox querysets prefetch the message list newest-first, so this is free
        there and falls back to one query on a single-thread response.
        """
        prefetched = getattr(obj, '_prefetched_objects_cache', None) or {}
        if 'messages' in prefetched:
            for message in obj.messages.all():
                if message.sender_id and message.sender_id != obj.customer_id:
                    return message.sender
            return None
        latest = obj.latest_agent_message()
        return latest.sender if latest else None

    def get_agent(self, obj):
        if obj.agent_id is None:
            return None
        agent = DeskAgent.for_user(obj.agent, desk_channel(obj.channel))
        if agent is None:
            return None
        return agent_payload(agent, DeskSettings.load(), timezone.localtime())

    def get_last_agent(self, obj):
        sender = self._sender_of_last_agent_reply(obj)
        if sender is None or (obj.agent_id and sender.id == obj.agent_id):
            return None
        agent = DeskAgent.for_user(sender, desk_channel(obj.channel))
        if agent is None:
            return None
        return agent_payload(agent, DeskSettings.load(), timezone.localtime())

    def get_assigned_to_me(self, obj) -> bool:
        request = self.context.get('request')
        return bool(request and obj.agent_id and request.user.id == obj.agent_id)

    def get_survey(self, obj) -> dict:
        """Whether the satisfaction card should appear for this thread.

        ``rating_total`` is annotated on the inbox queryset; single-thread
        responses do the one extra count.
        """
        total = getattr(obj, 'rating_total', None)
        has_rating = bool(total) if total is not None else obj.ratings.exists()
        closed = obj.status == StorefrontConversation.STATUS_CLOSED
        return {
            'closed': closed,
            'closed_at': obj.closed_at.isoformat() if obj.closed_at else None,
            'has_rating': has_rating,
            'can_rate': closed and not has_rating,
        }


class ConversationRatingSerializer(serializers.ModelSerializer):
    """The survey a user answers once a desk thread is closed.

    Deliberately not public: the user's rating of how the desk performed is a
    management signal (it is averaged per operator in the panel), not a star row
    on a stranger's profile.
    """

    rater_name = serializers.SerializerMethodField()
    agent_name = serializers.SerializerMethodField()
    conversation_info = serializers.SerializerMethodField()

    class Meta:
        model = ConversationRating
        fields = [
            'id', 'conversation', 'conversation_info', 'rater', 'rater_name', 'agent', 'agent_name',
            'score', 'solved', 'comment', 'created_at',
        ]
        read_only_fields = ['id', 'conversation', 'rater', 'agent', 'created_at']
        extra_kwargs = {'comment': {'required': False, 'allow_blank': True}}

    def get_rater_name(self, obj) -> str:
        return obj.rater.get_full_name() or obj.rater.username

    def get_agent_name(self, obj) -> str:
        return obj.agent.display_label if obj.agent else ''

    def get_conversation_info(self, obj) -> dict:
        conversation = obj.conversation
        return {
            'id': conversation.id,
            'channel': conversation.channel,
            'channel_label': conversation.channel_label,
            'customer': conversation.customer.get_full_name() or conversation.customer.username,
        }

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        conversation = attrs.get('conversation') or getattr(self.instance, 'conversation', None)
        if conversation is None:
            raise serializers.ValidationError({'conversation': 'گفتگو مشخص نیست.'})
        if user is not None:
            # Only the farmer on the other side of a desk thread rates the desk —
            # an operator scoring themselves would defeat the number entirely.
            if user.id != conversation.customer_id:
                raise serializers.ValidationError(
                    {'detail': 'only the customer of a thread can rate the desk.'}
                )
            if ConversationRating.objects.filter(conversation=conversation, rater=user).exists():
                raise serializers.ValidationError(
                    {'detail': 'شما پیش‌تر به این گفتگو امتیاز داده‌اید.'}
                )
        if conversation.status != StorefrontConversation.STATUS_CLOSED:
            raise serializers.ValidationError(
                {'detail': 'نظرسنجی پس از بسته شدن گفتگو باز می‌شود.'}
            )
        if user is not None and conversation.agent_id:
            attrs['agent'] = DeskAgent.for_user(conversation.agent, desk_channel(conversation.channel))
        return attrs


class FarmLandSerializer(serializers.ModelSerializer):
    land_type_label = serializers.CharField(source='get_land_type_display', read_only=True)
    soil_type_label = serializers.CharField(source='get_soil_type_display', read_only=True)
    irrigation_type_label = serializers.CharField(source='get_irrigation_type_display', read_only=True)
    area_unit_label = serializers.CharField(source='get_area_unit_display', read_only=True)
    owner_name = serializers.CharField(source='owner.get_full_name', read_only=True)
    event_count = serializers.SerializerMethodField()

    class Meta:
        model = FarmLand
        fields = [
            'id', 'owner', 'owner_name', 'name', 'land_type', 'land_type_label',
            'area', 'area_unit', 'area_unit_label', 'area_label',
            'crop_type', 'crop_variety', 'province', 'city',
            'soil_type', 'soil_type_label', 'irrigation_type', 'irrigation_type_label',
            'planting_date', 'notes', 'is_active', 'event_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'owner', 'owner_name', 'event_count', 'created_at', 'updated_at']

    def get_event_count(self, obj):
        return obj.calendar_events.count()


class FarmCalendarEventSerializer(serializers.ModelSerializer):
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    land_name = serializers.CharField(source='land.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    is_consultant_note = serializers.SerializerMethodField()

    class Meta:
        model = FarmCalendarEvent
        fields = [
            'id', 'land', 'land_name', 'kind', 'kind_label', 'title', 'date',
            'notes', 'status', 'status_label', 'created_by', 'created_by_name',
            'is_consultant_note', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'land', 'land_name', 'created_by', 'created_by_name',
            'is_consultant_note', 'created_at', 'updated_at',
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_is_consultant_note(self, obj):
        return obj.created_by_id != obj.land.owner_id

    def validate_date(self, value):
        return value


class FarmConsultationRequestSerializer(serializers.ModelSerializer):
    subject_label = serializers.CharField(source='get_subject_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    land = FarmLandSerializer(read_only=True)
    land_id = serializers.PrimaryKeyRelatedField(
        queryset=FarmLand.objects.all(), source='land', write_only=True
    )
    farmer_name = serializers.SerializerMethodField()
    farmer_username = serializers.CharField(source='farmer.username', read_only=True)

    class Meta:
        model = FarmConsultationRequest
        fields = [
            'id', 'farmer', 'farmer_name', 'farmer_username', 'land', 'land_id',
            'subject', 'subject_label', 'message', 'reply', 'status', 'status_label',
            'replied_by', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'farmer', 'farmer_name', 'farmer_username', 'land', 'reply',
            'status', 'status_label', 'replied_by', 'created_at', 'updated_at',
        ]

    def get_farmer_name(self, obj):
        return obj.farmer.get_full_name() or obj.farmer.username

    def validate_land_id(self, value):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if value.owner_id != request.user.id:
                raise serializers.ValidationError('پرونده انتخابی متعلق به حساب شما نیست.')
        return value


class AdminAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True, default='system')

    class Meta:
        model = AdminAuditLog
        fields = ['id', 'actor_username', 'action', 'target_type', 'target_id', 'summary', 'metadata', 'created_at']
        read_only_fields = fields


# ========================================
# Site content: blog, growing guides, services, landing pages, trust pages
# ========================================
class SiteArticleListSerializer(serializers.ModelSerializer):
    """Card shape for /blog and the home-page magazine block."""

    author_name = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    products_count = serializers.IntegerField(source='products.count', read_only=True)

    class Meta:
        model = SiteArticle
        fields = [
            'id', 'title', 'slug', 'kind', 'kind_label', 'excerpt', 'crop', 'cover', 'cover_url',
            'author_name', 'published_at', 'updated_at', 'reading_minutes', 'views',
            'is_featured', 'products_count', 'seo_title', 'seo_description',
        ]

    def get_author_name(self, obj) -> str:
        if obj.author:
            full = f'{obj.author.first_name} {obj.author.last_name}'.strip()
            return full or obj.author.username
        return 'تیم گرین کود'

    def get_cover_url(self, obj) -> str:
        return obj.cover_url


class SiteArticleSerializer(serializers.ModelSerializer):
    """Detail shape: full body plus the products and listings it recommends."""

    author_name = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    products = ProductListSerializer(many=True, read_only=True)
    listings = serializers.SerializerMethodField()
    related_articles = SiteArticleListSerializer(many=True, read_only=True)
    headings = serializers.SerializerMethodField()

    class Meta:
        model = SiteArticle
        fields = [
            'id', 'title', 'slug', 'kind', 'kind_label', 'excerpt', 'body', 'crop',
            'cover', 'cover_url', 'author', 'author_name', 'published_at', 'updated_at',
            'reading_minutes', 'views', 'products', 'listings', 'related_articles',
            'headings', 'seo_title', 'seo_description',
        ]

    def get_author_name(self, obj) -> str:
        if obj.author:
            full = f'{obj.author.first_name} {obj.author.last_name}'.strip()
            return full or obj.author.username
        return 'تیم گرین کود'

    def get_cover_url(self, obj) -> str:
        return obj.cover_url

    def get_listings(self, obj) -> list[dict]:
        return [
            {
                'id': listing.id,
                'title': listing.title,
                'slug': listing.slug,
                'crop_name': listing.crop_name,
                'price': listing.price,
                'unit': listing.unit,
                'image_url': listing.image_url,
                'storefront_name': listing.storefront.name,
                'storefront_slug': listing.storefront.slug,
            }
            for listing in obj.listings.select_related('storefront').filter(status='published')
        ]

    def get_headings(self, obj) -> list[dict]:
        """Table of contents derived from the article body.

        Headings are marked in the source with a leading "## " so the reader can
        build an index without parsing HTML on the server.
        """
        headings = []
        for line in (obj.body or '').splitlines():
            stripped = line.strip()
            if stripped.startswith('## '):
                text = stripped[3:].strip()
                headings.append({'title': text, 'anchor': article_anchor(text)})
        return headings


def article_anchor(text: str) -> str:
    """A stable, RTL-safe DOM id for a Persian heading."""
    from .slugs import slugify_fa

    slug = slugify_fa(text)
    return slug or f'h{abs(hash(text)) % 100000}'


class ServiceSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    highlights = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            'id', 'title', 'slug', 'code', 'summary', 'body', 'highlights', 'icon',
            'image', 'image_url', 'price_note', 'order', 'seo_title', 'seo_description',
        ]

    def get_image_url(self, obj) -> str:
        return obj.image_url

    def get_highlights(self, obj) -> list[str]:
        return obj.highlight_list


class SitePageBlockSerializer(serializers.ModelSerializer):
    block_type_label = serializers.CharField(source='get_block_type_display', read_only=True)
    image_url = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    rows = serializers.SerializerMethodField()

    class Meta:
        model = SitePageBlock
        fields = [
            'id', 'block_type', 'block_type_label', 'title', 'text', 'rows', 'image',
            'image_url', 'video', 'video_url', 'link', 'data', 'position',
        ]

    def get_image_url(self, obj) -> str:
        return obj.image_url

    def get_video_url(self, obj) -> str:
        return obj.video_url

    def get_rows(self, obj) -> list[list[str]]:
        return obj.table_rows


class SitePageSerializer(serializers.ModelSerializer):
    blocks = SitePageBlockSerializer(many=True, read_only=True)
    hero_image_url = serializers.SerializerMethodField()
    kind_label = serializers.CharField(source='get_kind_display', read_only=True)
    product = serializers.SerializerMethodField()
    updated_by = serializers.SerializerMethodField()

    class Meta:
        model = SitePage
        fields = [
            'id', 'title', 'slug', 'kind', 'kind_label', 'hero_text', 'hero_image',
            'hero_image_url', 'badge', 'product', 'cta_label', 'cta_url', 'blocks',
            'published_at', 'updated_at', 'updated_by', 'seo_title', 'seo_description',
        ]

    def get_hero_image_url(self, obj) -> str:
        return obj.hero_image_url

    def get_updated_by(self, obj) -> str:
        return 'تیم گرین کود'

    def get_product(self, obj) -> dict | None:
        if not obj.product_id:
            return None
        product = obj.product
        return {
            'id': product.id,
            'title': product.title,
            'slug': product.slug,
            'price': product.price,
            'discounted_price': product.discounted_price,
            'image_url': product.image_url,
            'is_in_stock': product.is_in_stock,
            'price_on_request': product.price_on_request,
        }


class TeamMemberSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = TeamMember
        fields = ['id', 'name', 'role', 'bio', 'photo', 'photo_url', 'order']

    def get_photo_url(self, obj) -> str:
        return obj.photo_url


class BrandPartnerSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = BrandPartner
        fields = ['id', 'name', 'logo', 'logo_url', 'website', 'description', 'since_year', 'order']

    def get_logo_url(self, obj) -> str:
        return obj.logo_url


class SiteContactSerializer(serializers.ModelSerializer):
    phones = serializers.SerializerMethodField()
    emails = serializers.SerializerMethodField()
    expert_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = SiteContact
        fields = [
            'address', 'provinces_note', 'phones', 'emails', 'working_hours',
            'whatsapp_number', 'telegram_url', 'instagram_url', 'eitaa_url',
            'map_lat', 'map_lng', 'map_note', 'expert_name', 'expert_role',
            'expert_photo', 'expert_photo_url', 'expert_note', 'updated_at',
        ]

    def get_phones(self, obj) -> list[str]:
        return obj.phone_list

    def get_emails(self, obj) -> list[str]:
        return obj.email_list

    def get_expert_photo_url(self, obj) -> str:
        return obj.expert_photo_url


class NewsletterSubscribeSerializer(serializers.ModelSerializer):
    """Public opt-in. Either channel is enough; a topic list is optional."""

    # Declared explicitly so DRF does not attach its UniqueValidator: a repeat
    # subscription must re-activate the existing row instead of erroring.
    email = serializers.EmailField(required=False, allow_blank=True)
    mobile = serializers.CharField(required=False, allow_blank=True, max_length=15)

    class Meta:
        model = NewsletterSubscriber
        fields = ['id', 'email', 'mobile', 'topics', 'source', 'is_active', 'subscribed_at']
        read_only_fields = ['id', 'is_active', 'subscribed_at']

    def validate_mobile(self, value):
        # An empty field means "no SMS channel", not a malformed number.
        if not value:
            return ''
        try:
            return normalize_iranian_mobile(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def validate(self, attrs):
        email = (attrs.get('email') or '').strip()
        mobile = (attrs.get('mobile') or '').strip()
        if not email and not mobile:
            raise serializers.ValidationError('برای عضویت، ایمیل یا شماره موبایل را وارد کنید.')
        if mobile:
            attrs['mobile'] = mobile
        attrs['email'] = email
        # Re-subscribing an existing address is idempotent, not a duplicate error.
        existing = None
        if email:
            existing = NewsletterSubscriber.objects.filter(email=email).first()
        if existing is None and mobile:
            existing = NewsletterSubscriber.objects.filter(mobile=mobile).first()
        if existing is not None:
            attrs['_existing_id'] = existing.id
        return attrs

    def create(self, validated_data):
        existing_id = validated_data.pop('_existing_id', None)
        if existing_id:
            existing = NewsletterSubscriber.objects.get(pk=existing_id)
            for field, value in validated_data.items():
                if value:
                    setattr(existing, field, value)
            existing.is_active = True
            existing.unsubscribed_at = None
            existing.save()
            return existing
        return super().create(validated_data)
