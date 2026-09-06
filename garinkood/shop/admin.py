from django.conf import settings
from django.contrib import admin, messages
from django.utils.html import format_html
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from import_export.admin import ExportMixin, ImportExportMixin
from simple_history.admin import SimpleHistoryAdmin

from .models import Category, Product
from .models import FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail
from .models import (
    Comment, UserAccount, Order, OrderItem, ServiceRequest, ProcurementRequest,
    Storefront, MarketplaceListing, PaymentAttempt, AffiliateProfile,
    AffiliateConversion, FinancialLedgerEntry, PlatformFeedback,
    StorefrontComplaint, VisualSearchRequest, Coupon, Wallet, WalletTransaction,
    StorefrontPost, FarmLand, FarmCalendarEvent, FarmConsultationRequest,
    AdminAuditLog, OneTimePassword, NotificationTemplate,
    NotificationRecipient, NotificationDelivery, WebPushSubscription,
    Shipment, ShipmentTrackingEvent,
    ProductAttribute, ListingAttribute, SiteArticle, Service, SitePage, SitePageBlock,
    TeamMember, BrandPartner, SiteContact, NewsletterSubscriber, PRODUCT_ATTRIBUTE_TEMPLATE,
    StorefrontConversation, StorefrontMessage, DeskSettings, DeskAgent, QuickReply,
    ConversationRating, ProductImage, ProductPackage, Tag, ReturnPolicySettings,
)
from .resources import OrderResource, ProductResource
from .rewards import mark_order_paid_and_reward


# --- Inline Forms ---
class FertilizerDetailInline(admin.StackedInline):
    model = FertilizerDetail
    extra = 1
    verbose_name = "مشخصات کود"
    verbose_name_plural = "مشخصات کود"


class PesticideDetailInline(admin.StackedInline):
    model = PesticideDetail
    extra = 1
    verbose_name = "مشخصات سم"
    verbose_name_plural = "مشخصات سم"


class SeedDetailInline(admin.StackedInline):
    model = SeedDetail
    extra = 1
    verbose_name = "مشخصات بذر"
    verbose_name_plural = "مشخصات بذر"


class EquipmentDetailInline(admin.StackedInline):
    model = EquipmentDetail
    extra = 1
    verbose_name = "مشخصات ابزار"
    verbose_name_plural = "مشخصات ابزار"


class ProductImageInline(admin.TabularInline):
    """The gallery behind the card's hover photo and the PDP thumbnails."""

    model = ProductImage
    extra = 0
    fields = ('order', 'image', 'caption')
    verbose_name = 'تصویر'
    verbose_name_plural = 'گالری تصاویر محصول'


class ProductPackageInline(admin.TabularInline):
    """Packagings, each priced and stocked on its own.

    Price and stock may be left empty to follow the product row — that is what a
    single-bag product should do rather than repeat itself in two places.
    """

    model = ProductPackage
    extra = 0
    fields = ('order', 'label', 'weight_kg', 'price', 'stock', 'min_order_quantity',
              'production_date', 'expiry_date', 'bulk_note', 'is_default')
    verbose_name = 'بسته‌بندی'
    verbose_name_plural = 'بسته‌بندی‌های فروش'


class ProductAttributeInline(admin.TabularInline):
    """The ordered «ویژگی‌ها» table shown on the product page."""

    model = ProductAttribute
    extra = 0
    min_num = 0
    verbose_name = 'ویژگی'
    verbose_name_plural = 'ویژگی‌های فنی محصول'
    fields = ('order', 'label', 'value')


class ListingAttributeInline(admin.TabularInline):
    """Sellers get the same spec table for an advertisement."""

    model = ListingAttribute
    extra = 0
    verbose_name = 'ویژگی'
    verbose_name_plural = 'ویژگی‌های آگهی'
    fields = ('order', 'label', 'value')


class SitePageBlockInline(admin.StackedInline):
    model = SitePageBlock
    extra = 0
    verbose_name = 'بلوک صفحه'
    verbose_name_plural = 'بلوک‌های صفحه'
    prepopulated_fields = {}


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ('product', 'product_title', 'product_slug', 'unit_price', 'quantity', 'total_price')


class ShipmentTrackingEventInline(admin.TabularInline):
    model = ShipmentTrackingEvent
    extra = 0
    readonly_fields = ('created_at',)
    ordering = ('-occurred_at',)


# --- اکشن‌ها ---
def _set_product_status(queryset, next_status):
    """Use model saves so selective history is not bypassed by a bulk update."""
    with transaction.atomic():
        for product in queryset.select_for_update().iterator():
            if product.status != next_status:
                product.status = next_status
                product.save(update_fields=['status', 'updated'])


def make_published(modeladmin, request, queryset):
    _set_product_status(queryset, 'published')


make_published.short_description = "انتشار انتخاب‌شده‌ها"


def make_draft(modeladmin, request, queryset):
    _set_product_status(queryset, 'draft')


make_draft.short_description = "پیش‌نویس کردن انتخاب‌شده‌ها"


def approve_comments(modeladmin, request, queryset):
    queryset.update(active=True)


approve_comments.short_description = "فعال کردن نظرات انتخاب‌شده"


def disapprove_comments(modeladmin, request, queryset):
    queryset.update(active=False)


disapprove_comments.short_description = "غیرفعال کردن نظرات انتخاب‌شده"


# --- Admin Category ---
@admin.register(Category)
class AdminCategory(SimpleHistoryAdmin):
    list_display = ('name', 'slug', 'get_product_count')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('name',)

    def get_product_count(self, obj):
        return obj.products.filter(status='published').count()

    get_product_count.short_description = 'تعداد محصولات'


# --- Admin Item (محصول) ---
@admin.register(Product)
class AdminProduct(ImportExportMixin, SimpleHistoryAdmin):
    resource_classes = [ProductResource]
    list_filter = ('status', 'publish', 'created', 'author', 'category', 'tags')
    list_display = ('title', 'author', 'category', 'slug', 'status', 'publish', 'price', 'stock', 'expiry_short')
    search_fields = ('title', 'description', 'author__username', 'brand', 'sku', 'tags__name')
    prepopulated_fields = {'slug': ('title',)}
    autocomplete_fields = ('author',)
    date_hierarchy = 'publish'
    ordering = ('-publish',)
    list_display_links = ('slug',)
    list_editable = ('status',)
    list_per_page = 20
    readonly_fields = ('created', 'updated',)
    show_full_result_count = False
    save_as = True
    actions = [make_published, make_draft, 'add_standard_attribute_rows']

    inlines = [ProductAttributeInline, ProductImageInline, ProductPackageInline]
    fieldsets = (
        ('اطلاعات اصلی', {'fields': ('title', 'slug', 'author', 'status')}),
        ('دسته‌بندی و قیمت', {'fields': ('category', 'subcategory', 'price', 'stock', 'available', 'is_featured', 'discount_percent', 'package_weight', 'price_on_request', 'tags')}),
        ('محتوا', {'fields': ('description', 'image', 'brand', 'sku', 'gtin', 'video_url')}),
        ('مصرف و batch', {
            'fields': ('production_date', 'expiry_date', 'min_order_quantity', 'bulk_note'),
            'description': 'اگر بسته‌بندی‌های جدا تعریف شده باشند، تاریخ و حداقل سفارش هر بسته در تب «بسته‌بندی‌های فروش» اولویت دارد.',
        }),
        ('سئو', {'fields': ('seo_title', 'seo_description'), 'classes': ('collapse',)}),
        ('ارسال', {'fields': ('shipping_weight_grams', 'shipping_length_cm', 'shipping_width_cm', 'shipping_height_cm'), 'classes': ('collapse',)}),
        ('تاریخ‌ها', {'fields': ('publish', 'created', 'updated'), 'classes': ('collapse',)}),
    )

    @admin.display(description='انقضا', ordering='expiry_date')
    def expiry_short(self, obj):
        """A short column so an ageing batch is findable without opening rows."""
        days = obj.expiry_days_left
        if days is None:
            return '—'
        return f'{days} روز مانده' if days >= 0 else f'{abs(days)} روز گذشته'

    def save_model(self, request, obj, form, change):
        if not change:
            obj.author = request.user
        super().save_model(request, obj, form, change)

    def get_inline_instances(self, request, obj=None):
        """Category detail tables are mutually exclusive; specs always show.

        ``ProductAdmin`` used to return *only* the category-specific inline,
        which hid the specification rows on every product that had a detail
        table. The attribute inline is therefore appended instead of replaced.
        """
        inlines = list(super().get_inline_instances(request, obj))
        if obj is not None:
            detail_inline = None
            category_slug = obj.category.slug if obj.category else ''
            if category_slug == 'fertilizer':
                detail_inline = FertilizerDetailInline
            elif category_slug == 'pesticide':
                detail_inline = PesticideDetailInline
            elif category_slug == 'seed':
                detail_inline = SeedDetailInline
            elif category_slug == 'equipment':
                detail_inline = EquipmentDetailInline
            if detail_inline is not None:
                inlines = [
                    inline for inline in inlines
                    if not isinstance(inline, (FertilizerDetailInline, PesticideDetailInline, SeedDetailInline, EquipmentDetailInline))
                ]
                inlines.append(detail_inline(self.model, self.admin_site))
        return inlines

    @admin.action(description='افزودن جدول ۱۸ ویژگی استاندارد (فقط عناوین خالی)')
    def add_standard_attribute_rows(self, request, queryset):
        """Seed the spec sheet skeleton so a manager only fills in values.

        Existing labels are skipped, which keeps the action repeatable on a
        product that is already half-filled.
        """
        created = 0
        for product in queryset:
            taken = set(product.attributes.values_list('label', flat=True))
            rows = [
                ProductAttribute(
                    product=product,
                    label=label,
                    value='',
                    order=index,
                )
                for index, label in enumerate(PRODUCT_ATTRIBUTE_TEMPLATE)
                if label not in taken
            ]
            # A value is optional in the admin workflow, so blank rows would be
            # rejected by the field's blank=False default; keep them out of the
            # table until they carry a value.
            ProductAttribute.objects.bulk_create(rows)
            created += len(rows)
        self.message_user(
            request,
            f'{created} ردیف ویژگی اضافه شد. مقدار هر ردیف را وارد و ذخیره کنید.',
        )


# --- Admin UserAccount ---
@admin.register(UserAccount)
class AdminUserAccount(admin.ModelAdmin):
    list_display = ('user', 'phone', 'phone_verified_at', 'gender', 'created')
    list_filter = ('gender', 'phone_verified_at', 'created')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'phone')
    readonly_fields = ('phone_verified_at', 'created', 'updated')
    ordering = ('-created',)


# --- Admin Comment ---
def feature_reviews(modeladmin, request, queryset):
    """Pin reviews onto «تجربه خرید مشتریان».

    The page is curated rather than automatic: an editor decides which real
    review represents the shop, and the count it shows is the count of reviews
    that actually exist.
    """
    updated = queryset.filter(parent__isnull=True).update(is_featured=True)
    modeladmin.message_user(request, f'{updated} دیدگاه برای صفحه تجربه خرید مشتریان انتخاب شد.')


feature_reviews.short_description = 'نمایش در «تجربه خرید مشتریان»'


def unfeature_reviews(modeladmin, request, queryset):
    queryset.update(is_featured=False)
    modeladmin.message_user(request, 'انتخاب این دیدگاه‌ها از صفحه برداشته شد.')


unfeature_reviews.short_description = 'حذف از «تجربه خرید مشتریان»'


@admin.register(Comment)
class AdminComment(admin.ModelAdmin):
    list_display = ('name', 'product', 'rating', 'helpful_count', 'is_featured', 'is_reported', 'created', 'active')
    list_filter = ('active', 'rating', 'is_featured', 'is_reported', 'created')
    list_editable = ('active',)
    list_select_related = ('product',)
    fieldsets = (
        ('دیدگاه', {'fields': ('product', 'user', 'name', 'email', 'body', 'rating')}),
        ('رسانه و پاسخ', {'fields': ('image', 'sticker', 'parent')}),
        ('وضعیت', {'fields': ('active', 'is_featured', 'is_reported', 'helpful_count', 'created', 'updated')}),
    )
    actions = [approve_comments, disapprove_comments, feature_reviews, unfeature_reviews]
    search_fields = ('name', 'email', 'body', 'product__title')
    actions = [approve_comments, disapprove_comments]
    date_hierarchy = 'created'
    ordering = ('-created',)
    readonly_fields = ('created', 'updated')
    list_per_page = 20


# --- Commerce operations ---
def cancel_orders_and_restore_stock(modeladmin, request, queryset):
    cancelled = 0
    for order in queryset:
        try:
            order.cancel_and_restore_stock()
            cancelled += 1
        except ValueError:
            continue
    modeladmin.message_user(request, f'{cancelled} سفارش لغو و موجودی آن‌ها آزاد شد.')


cancel_orders_and_restore_stock.short_description = 'لغو سفارش و بازگرداندن موجودی رزروشده'


def mark_orders_paid_and_issue_rewards(modeladmin, request, queryset):
    completed = 0
    for order in queryset:
        try:
            mark_order_paid_and_reward(order)
            completed += 1
        except ValueError:
            continue
    modeladmin.message_user(request, f'پرداخت {completed} سفارش تأیید و پاداش وفاداری ثبت شد.')


mark_orders_paid_and_issue_rewards.short_description = 'تأیید پرداخت و صدور پاداش خرید بعدی'


@admin.register(Order)
class AdminOrder(ExportMixin, SimpleHistoryAdmin):
    resource_classes = [OrderResource]
    list_display = ('code', 'customer_name', 'phone', 'total_price', 'payment_status', 'status', 'created_at')
    list_filter = ('status', 'payment_status', 'payment_method', 'created_at')
    search_fields = ('code', 'customer_name', 'phone', 'email')
    list_editable = ('status', 'payment_status')
    readonly_fields = (
        'code', 'user', 'subtotal', 'shipping_price', 'total_price',
        'terms_accepted_at', 'legal_version', 'created_at', 'updated_at',
    )
    inlines = [OrderItemInline]
    actions = [cancel_orders_and_restore_stock, mark_orders_paid_and_issue_rewards]
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


@admin.register(Shipment)
class AdminShipment(SimpleHistoryAdmin):
    list_display = ('order', 'provider', 'service_name', 'tracking_code', 'status', 'last_event_at', 'updated_at')
    list_filter = ('provider', 'status', 'created_at')
    search_fields = ('order__code', 'tracking_code', 'external_id')
    readonly_fields = ('id', 'created_at', 'updated_at', 'provider_payload')
    inlines = [ShipmentTrackingEventInline]


@admin.register(ShipmentTrackingEvent)
class AdminShipmentTrackingEvent(admin.ModelAdmin):
    list_display = ('shipment', 'status', 'description', 'location', 'occurred_at')
    list_filter = ('status', 'occurred_at')
    search_fields = ('shipment__order__code', 'shipment__tracking_code', 'description')
    readonly_fields = ('created_at', 'raw_payload')


@admin.register(ServiceRequest)
class AdminServiceRequest(admin.ModelAdmin):
    list_display = ('code', 'service_type', 'customer_name', 'phone', 'city', 'status', 'created_at')
    list_filter = ('service_type', 'status', 'province', 'created_at')
    search_fields = ('code', 'customer_name', 'phone', 'city', 'crop')
    list_editable = ('status',)
    readonly_fields = ('code', 'user', 'created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(ProcurementRequest)
class AdminProcurementRequest(admin.ModelAdmin):
    list_display = ('code', 'crop_name', 'farmer_name', 'quantity', 'unit', 'city', 'status', 'created_at')
    list_filter = ('status', 'province', 'created_at')
    search_fields = ('code', 'farmer_name', 'phone', 'crop_name', 'city')
    list_editable = ('status',)
    readonly_fields = ('code', 'user', 'created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(Storefront)
class AdminStorefront(admin.ModelAdmin):
    list_display = ('name', 'user', 'seller_type', 'city', 'is_verified', 'commission_rate', 'created_at')
    list_filter = ('seller_type', 'is_verified', 'province')
    search_fields = ('name', 'slug', 'user__username', 'user__email')
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ('is_verified', 'commission_rate')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(MarketplaceListing)
class AdminMarketplaceListing(admin.ModelAdmin):
    inlines = [ListingAttributeInline]
    list_display = ('title', 'storefront', 'crop_name', 'price', 'unit', 'quantity_available', 'status', 'created_at')
    list_filter = ('status', 'harvest_date', 'created_at')
    search_fields = ('title', 'slug', 'crop_name', 'storefront__name')
    prepopulated_fields = {'slug': ('title',)}
    list_editable = ('status',)
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(PaymentAttempt)
class AdminPaymentAttempt(SimpleHistoryAdmin):
    list_display = ('order', 'provider', 'amount', 'currency', 'status', 'external_reference', 'created_at')
    list_filter = ('provider', 'status', 'currency', 'created_at')
    search_fields = ('order__code', 'external_reference', 'idempotency_key')
    readonly_fields = ('order', 'provider', 'amount', 'currency', 'idempotency_key', 'external_reference', 'checkout_url', 'provider_payload', 'created_at', 'updated_at', 'verified_at')


@admin.register(AffiliateProfile)
class AdminAffiliateProfile(admin.ModelAdmin):
    list_display = ('code', 'user', 'commission_rate', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('code', 'user__username', 'user__email')
    list_editable = ('commission_rate', 'status')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AffiliateConversion)
class AdminAffiliateConversion(admin.ModelAdmin):
    list_display = ('affiliate', 'order', 'commission_amount', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('affiliate__code', 'order__code')
    list_editable = ('status',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(FinancialLedgerEntry)
class AdminFinancialLedgerEntry(admin.ModelAdmin):
    list_display = ('owner_type', 'user', 'storefront', 'entry_type', 'amount', 'currency', 'status', 'created_at')
    list_filter = ('owner_type', 'entry_type', 'status', 'currency', 'created_at')
    search_fields = ('user__username', 'storefront__name', 'order__code', 'description')
    list_editable = ('status',)
    readonly_fields = ('created_at',)


@admin.register(PlatformFeedback)
class AdminPlatformFeedback(admin.ModelAdmin):
    list_display = ('kind', 'subject', 'name', 'user', 'status', 'created_at')
    list_filter = ('kind', 'status', 'created_at')
    search_fields = ('subject', 'message', 'name', 'email', 'user__username')
    list_editable = ('status',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(StorefrontComplaint)
class AdminStorefrontComplaint(admin.ModelAdmin):
    list_display = ('storefront', 'subject', 'complainant', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('storefront__name', 'subject', 'description', 'complainant__username')
    list_editable = ('status',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(VisualSearchRequest)
class AdminVisualSearchRequest(admin.ModelAdmin):
    list_display = ('target', 'user', 'status', 'created_at')
    list_filter = ('target', 'status', 'created_at')
    search_fields = ('user__username',)
    list_editable = ('status',)
    readonly_fields = ('created_at', 'updated_at', 'result_payload')


@admin.register(Coupon)
class AdminCoupon(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'min_order_amount', 'usage_count', 'usage_limit', 'is_active', 'valid_until')
    list_filter = ('discount_type', 'is_active', 'valid_from', 'valid_until')
    search_fields = ('code', 'description', 'issued_to_phone', 'issued_to_user__username')
    list_editable = ('is_active',)
    readonly_fields = ('usage_count', 'created_at', 'updated_at')


class WalletTransactionInline(admin.TabularInline):
    model = WalletTransaction
    extra = 0
    readonly_fields = ('order', 'amount', 'transaction_type', 'status', 'description', 'created_at', 'available_at')
    can_delete = False


@admin.register(Wallet)
class AdminWallet(admin.ModelAdmin):
    list_display = ('user', 'balance', 'currency', 'updated_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('balance', 'updated_at')
    inlines = [WalletTransactionInline]


@admin.register(StorefrontPost)
class AdminStorefrontPost(admin.ModelAdmin):
    list_display = ('storefront', 'post_type', 'status', 'expires_at', 'created_at')
    list_filter = ('post_type', 'status', 'created_at')
    search_fields = ('storefront__name', 'caption')
    list_editable = ('status',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(AdminAuditLog)
class AdminAdminAuditLog(admin.ModelAdmin):
    list_display = ('created_at', 'actor', 'action', 'target_type', 'target_id', 'summary')
    list_filter = ('action', 'target_type', 'created_at')
    search_fields = ('actor__username', 'summary', 'target_id')
    readonly_fields = ('actor', 'action', 'target_type', 'target_id', 'summary', 'metadata', 'created_at')
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# --- Transactional messaging hub ---
def queue_test_messages(modeladmin, request, queryset):
    from .messaging.outbox import enqueue_test_delivery

    queued = 0
    errors = 0
    for recipient in queryset:
        try:
            enqueue_test_delivery(recipient)
            queued += 1
        except ValueError:
            errors += 1
    modeladmin.message_user(
        request,
        f'{queued} پیام آزمایشی در صف قرار گرفت؛ نتیجه در تاریخچه ارسال نمایش داده می‌شود.',
        level=messages.SUCCESS if not errors else messages.WARNING,
    )
    if errors:
        modeladmin.message_user(
            request,
            f'{errors} گیرنده به‌دلیل غیرفعال بودن کانال در تنظیمات محیطی رد شد.',
            level=messages.WARNING,
        )


queue_test_messages.short_description = 'قرار دادن پیام آزمایشی در صف ارسال'


def retry_failed_messages(modeladmin, request, queryset):
    eligible = queryset.filter(
        status__in=[NotificationDelivery.STATUS_FAILED, NotificationDelivery.STATUS_RETRY]
    )
    updated = eligible.update(
        status=NotificationDelivery.STATUS_PENDING,
        attempt_count=0,
        next_attempt_at=timezone.now(),
        locked_at=None,
        last_error='',
        updated_at=timezone.now(),
    )
    modeladmin.message_user(request, f'{updated} پیام برای تلاش مجدد در صف قرار گرفت.')


retry_failed_messages.short_description = 'تلاش مجدد برای پیام‌های ناموفق انتخاب‌شده'


@admin.register(NotificationTemplate)
class AdminNotificationTemplate(SimpleHistoryAdmin):
    list_display = ('name', 'event', 'audience', 'channel', 'is_active', 'updated_at')
    list_filter = ('event', 'audience', 'channel', 'is_active')
    search_fields = ('name', 'body', 'provider_template_name')
    list_editable = ('is_active',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('مسیر', {'fields': ('name', 'event', 'audience', 'channel', 'is_active')}),
        ('محتوا', {'fields': ('body', 'provider_template_name', 'language_code')}),
        ('تاریخچه', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(WebPushSubscription)
class AdminWebPushSubscription(admin.ModelAdmin):
    list_display = ('user', 'is_active', 'failure_count', 'last_used_at', 'updated_at')
    list_filter = ('is_active', 'created_at', 'updated_at')
    search_fields = ('user__username', 'user__email', 'endpoint')
    readonly_fields = ('id', 'user', 'endpoint', 'p256dh', 'auth', 'user_agent', 'failure_count', 'last_used_at', 'last_error', 'created_at', 'updated_at')


@admin.register(NotificationRecipient)
class AdminNotificationRecipient(admin.ModelAdmin):
    list_display = (
        'name', 'channel', 'destination', 'channel_enabled',
        'receive_order_created', 'receive_order_status_changed', 'is_active',
    )
    list_filter = ('channel', 'receive_order_created', 'receive_order_status_changed', 'is_active')
    search_fields = ('name', 'destination')
    list_editable = ('receive_order_created', 'receive_order_status_changed', 'is_active')
    readonly_fields = ('created_at', 'updated_at')
    actions = [queue_test_messages]

    @admin.display(boolean=True, description='فعال در محیط')
    def channel_enabled(self, obj):
        if settings.MESSAGING_FAKE:
            return True
        return {
            'sms': settings.MESSAGING_ENABLE_SMS,
            'bale': settings.MESSAGING_ENABLE_BALE,
            'telegram': settings.MESSAGING_ENABLE_TELEGRAM,
            'whatsapp': settings.MESSAGING_ENABLE_WHATSAPP,
        }.get(obj.channel, False)


@admin.register(NotificationDelivery)
class AdminNotificationDelivery(admin.ModelAdmin):
    list_display = (
        'created_at', 'event', 'channel', 'audience', 'order', 'status',
        'attempt_count', 'sent_at',
    )
    list_filter = ('status', 'event', 'channel', 'audience', 'created_at')
    search_fields = ('order__code', 'recipient', 'provider_message_id', 'idempotency_key')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)
    actions = [retry_failed_messages]
    readonly_fields = (
        'id', 'order', 'template', 'event', 'audience', 'channel', 'recipient',
        'rendered_content', 'payload', 'idempotency_key', 'status', 'attempt_count',
        'max_attempts', 'next_attempt_at', 'locked_at', 'provider_message_id',
        'provider_response', 'last_error', 'sent_at', 'delivered_at',
        'created_at', 'updated_at',
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(OneTimePassword)
class AdminOneTimePassword(admin.ModelAdmin):
    list_display = (
        'created_at', 'phone', 'purpose', 'delivery_channel', 'status',
        'attempts', 'expires_at', 'consumed_at',
    )
    list_filter = ('status', 'purpose', 'delivery_channel', 'created_at')
    search_fields = ('phone', 'request_id', 'provider_message_id')
    readonly_fields = (
        'request_id', 'phone', 'purpose', 'delivery_channel',
        'provider_message_id', 'last_error', 'status', 'attempts', 'max_attempts',
        'requested_ip', 'expires_at', 'consumed_at', 'created_at',
    )
    fields = readonly_fields

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# --- Farm profile: lands, calendars and consultation ---
@admin.register(FarmLand)
class AdminFarmLand(admin.ModelAdmin):
    list_display = ('name', 'land_type', 'crop_type', 'owner', 'city', 'created_at')
    list_filter = ('land_type', 'soil_type', 'irrigation_type', 'created_at')
    search_fields = ('name', 'crop_type', 'owner__username', 'city')


@admin.register(FarmCalendarEvent)
class AdminFarmCalendarEvent(admin.ModelAdmin):
    list_display = ('date', 'land', 'kind', 'title', 'status', 'created_by')
    list_filter = ('kind', 'status', 'date')
    search_fields = ('title', 'land__name', 'land__owner__username')


@admin.register(FarmConsultationRequest)
class AdminFarmConsultationRequest(admin.ModelAdmin):
    list_display = ('created_at', 'farmer', 'land', 'subject', 'status', 'replied_by')
    list_filter = ('subject', 'status', 'created_at')
    search_fields = ('farmer__username', 'land__name', 'message', 'reply')
    readonly_fields = ('created_at', 'updated_at')


# --- Site content: blog, guides, services, pages, trust and newsletter ---
def publish_articles(modeladmin, request, queryset):
    updated = 0
    for article in queryset:
        article.is_published = True
        article.save(update_fields=['is_published', 'published_at'])
        updated += 1
    modeladmin.message_user(request, f'{updated} مقاله منتشر شد.')


def unpublish_articles(modeladmin, request, queryset):
    updated = queryset.update(is_published=False)
    modeladmin.message_user(request, f'{updated} مقاله از انتشار خارج شد.')


@admin.register(SiteArticle)
class AdminSiteArticle(SimpleHistoryAdmin):
    list_display = ('title', 'kind', 'crop', 'is_published', 'published_at', 'views', 'author')
    list_filter = ('kind', 'is_published', 'is_featured', 'published_at')
    search_fields = ('title', 'excerpt', 'body', 'crop')
    prepopulated_fields = {'slug': ('title',)}
    list_editable = ('is_published',)
    filter_horizontal = ('products', 'listings', 'related_articles')
    readonly_fields = ('views', 'created_at', 'updated_at')
    ordering = ('-published_at',)
    actions = [publish_articles, unpublish_articles]
    fieldsets = (
        ('محتوا', {'fields': ('title', 'slug', 'kind', 'excerpt', 'body', 'cover', 'crop', 'author')}),
        ('اتصالات', {'fields': ('products', 'listings', 'related_articles')}),
        ('انتشار و سئو', {'fields': ('is_published', 'published_at', 'is_featured', 'seo_title', 'seo_description', 'reading_minutes')}),
        ('آمار', {'fields': ('views', 'created_at', 'updated_at')}),
    )

    def save_model(self, request, obj, form, change):
        if not change and not obj.author_id:
            obj.author = request.user
        super().save_model(request, obj, form, change)


@admin.register(Service)
class AdminService(admin.ModelAdmin):
    list_display = ('title', 'code', 'order', 'is_active', 'price_note')
    list_filter = ('is_active', 'code')
    search_fields = ('title', 'summary', 'body')
    prepopulated_fields = {'slug': ('title',)}
    list_editable = ('is_active', 'order')
    ordering = ('order', 'title')


class SitePageBlocksForm(admin.TabularInline):
    """Tabular so a whole landing page can be edited on one screen."""

    model = SitePageBlock
    extra = 0
    verbose_name = 'بلوک'
    verbose_name_plural = 'بلوک‌های صفحه'


@admin.register(SitePage)
class AdminSitePage(SimpleHistoryAdmin):
    list_display = ('title', 'slug', 'kind', 'published', 'product', 'updated_at')
    list_filter = ('kind', 'published')
    search_fields = ('title', 'slug', 'hero_text')
    prepopulated_fields = {'slug': ('title',)}
    list_editable = ('published',)
    inlines = [SitePageBlocksForm]
    readonly_fields = ('published_at', 'updated_at')


@admin.register(TeamMember)
class AdminTeamMember(admin.ModelAdmin):
    list_display = ('name', 'role', 'order', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'role', 'bio')
    list_editable = ('is_active', 'order')
    ordering = ('order', 'name')


@admin.register(BrandPartner)
class AdminBrandPartner(admin.ModelAdmin):
    list_display = ('name', 'since_year', 'order', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
    list_editable = ('is_active', 'order')
    ordering = ('order', 'name')


@admin.register(SiteContact)
class AdminSiteContact(admin.ModelAdmin):
    list_display = ('address', 'working_hours', 'updated_at')

    def has_add_permission(self, request):
        # A singleton row: the admin edits it through the changelist link.
        return not SiteContact.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(NewsletterSubscriber)
class AdminNewsletterSubscriber(ExportMixin, admin.ModelAdmin):
    list_display = ('email', 'mobile', 'topics', 'source', 'is_active', 'subscribed_at')
    list_filter = ('is_active', 'source', 'subscribed_at')
    search_fields = ('email', 'mobile', 'topics')
    list_editable = ('is_active',)
    readonly_fields = ('subscribed_at', 'unsubscribed_at')
    ordering = ('-subscribed_at',)

    def has_add_permission(self, request):
        # Subscribers must opt in through the site form; a manually added row
        # would be an unsubscribed-for contact.
        return False


# --- Service desks: hours, operators, canned replies and the survey ---
@admin.register(DeskSettings)
class AdminDeskSettings(admin.ModelAdmin):
    """The two desks' working hours and canned replies, edited in one place.

    A singleton like ``SiteContact``: there is one support desk and one
    consulting desk per platform, and a second row would mean two answers to
    «ساعت کاری پشتیبانی چند است؟».
    """

    list_display = ('support_hours', 'consulting_hours', 'presence_minutes', 'updated_at')
    readonly_fields = ('support_hours_preview', 'consulting_hours_preview', 'updated_at')
    fieldsets = (
        ('ساعت کاری (به وقت ایران)', {
            'fields': (
                'work_days', 'support_start', 'support_end',
                'consulting_start', 'consulting_end',
                'support_hours_preview', 'consulting_hours_preview',
            ),
            'description': (
                'خارج از این بازه، پیام کاربر در صف می‌ماند و پیام آماده‌ی «الان '
                'ساعت کاری نیست» برایش ارسال می‌شود.'
            ),
        }),
        ('حالت آنلاین و پیام پایان کار', {
            'fields': ('presence_minutes', 'out_of_hours_note'),
            'description': (
                '«آنلاین» از فعالیت واقعی میز حساب می‌شود: هر بازکردن صندوق یا '
                'گفتگو در این پنجره زمانی کارشناس را آنلاین نشان می‌دهد.'
            ),
        }),
    )

    @admin.display(description='ساعت کاری پشتیبانی (پیش‌نمایش)')
    def support_hours_preview(self, obj) -> str:
        return obj.hours_label('support')

    @admin.display(description='ساعت کاری مشاوره (پیش‌نمایش)')
    def consulting_hours_preview(self, obj) -> str:
        return obj.hours_label('consulting')

    @admin.display(description='پشتیبانی')
    def support_hours(self, obj) -> str:
        return obj.hours_label('support')

    @admin.display(description='مشاوره')
    def consulting_hours(self, obj) -> str:
        return obj.hours_label('consulting')

    def has_add_permission(self, request):
        return not DeskSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DeskAgent)
class AdminDeskAgent(admin.ModelAdmin):
    list_display = (
        'display_name', 'user', 'role', 'is_active', 'duty_now', 'last_seen_at',
        'rating_average', 'rating_count', 'open_threads',
    )
    list_filter = ('role', 'is_active')
    search_fields = ('display_name', 'title', 'specialties', 'user__username', 'user__first_name')
    readonly_fields = ('last_seen_at', 'rating_average', 'rating_count', 'created_at', 'updated_at')
    autocomplete_fields = ('user',)
    ordering = ('role', 'order', 'display_name')
    fieldsets = (
        ('هویت نمایشی (همان چیزی که کاربر در چت می‌بیند)', {
            'fields': ('user', 'role', 'display_name', 'title', 'photo', 'bio', 'specialties'),
            'description': (
                'نام و تصویر اینجا در سربرگ گفتگو و زیر هر پیام نمایش داده می‌شود؛ '
                'نام کاربری هرگز به کاربر نشان داده نمی‌شود.'
            ),
        }),
        ('توزیع کار', {
            'fields': ('shift_start', 'shift_end', 'max_open_threads', 'order', 'is_active'),
        }),
        ('وضعیت (فقط‌خواندنی)', {
            'fields': ('last_seen_at', 'rating_average', 'rating_count'),
        }),
    )

    @admin.display(boolean=True, description='آنلاین')
    def duty_now(self, obj) -> bool:
        return obj.is_present()

    @admin.display(description='گفتگوی باز')
    def open_threads(self, obj) -> int:
        # Counted in the queryset so a desk with a dozen operators is one query;
        # the conversation list is what assign_thread() reads when it hands out
        # the next thread, so it has to agree with this number exactly.
        return getattr(obj, '_open', None) if getattr(obj, '_open', None) is not None else obj.open_threads().count()

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .select_related('user')
            .annotate(_open=Count('user__handled_conversations', filter=Q(
                user__handled_conversations__status=StorefrontConversation.STATUS_OPEN,
            )))
        )


@admin.register(QuickReply)
class AdminQuickReply(admin.ModelAdmin):
    list_display = ('label', 'audience', 'channel', 'is_first_message_only', 'order', 'is_active')
    list_filter = ('audience', 'channel', 'is_active', 'is_first_message_only')
    list_editable = ('order', 'is_active')
    search_fields = ('label', 'text')
    ordering = ('audience', 'channel', 'order', 'id')

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not change:
            messages.success(
                request,
                'پیام آماده ذخیره شد؛ در گفتگوهای همان میز بلافاصله قابل انتخاب است.',
            )


@admin.register(ConversationRating)
class AdminConversationRating(admin.ModelAdmin):
    """Satisfaction results, for the desk's managers only.

    Not exposed on any public page: an operator's average is a management
    signal, not a star row next to a stranger's name.
    """

    list_display = ('created_at', 'score', 'solved', 'conversation', 'agent', 'rater')
    list_filter = ('score', 'solved', 'conversation__channel', 'agent')
    search_fields = ('comment', 'rater__username', 'agent__display_name')
    readonly_fields = [field.name for field in ConversationRating._meta.get_fields()]
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        # Ratings are written by the survey form, which also stamps the agent
        # and posts the notice into the thread.
        return False


class StorefrontMessageInline(admin.TabularInline):
    model = StorefrontMessage
    extra = 0
    fields = ('created_at', 'sender', 'body', 'land', 'link_label', 'is_read', 'deleted_at')
    readonly_fields = fields
    can_delete = False

    def has_add_permission(self, request, obj):
        return False


@admin.register(StorefrontConversation)
class AdminStorefrontConversation(admin.ModelAdmin):
    """Read-only view of the inbox, for when a farmer reports a conversation.

    Answers are written in the site's own desk UI; editing a message from the
    admin panel would let a line appear that the other party never saw.
    """

    list_display = ('id', 'customer', 'channel', 'subject', 'status', 'agent', 'updated_at')
    list_filter = ('channel', 'status', 'agent')
    search_fields = ('customer__username', 'customer__first_name', 'subject')
    readonly_fields = (
        'customer', 'channel', 'storefront', 'subject', 'agent', 'status',
        'closed_at', 'closed_by', 'created_at', 'updated_at',
    )
    inlines = [StorefrontMessageInline]
    date_hierarchy = 'updated_at'
    ordering = ('-updated_at',)

    def has_add_permission(self, request):
        return False


@admin.register(Tag)
class AdminTag(SimpleHistoryAdmin):
    """Cross-category labels; the slug is derived from the Persian name."""

    list_display = ('name', 'slug', 'product_count')
    search_fields = ('name', 'description')
    readonly_fields = ('slug',)
    prepopulated_fields = {}

    @admin.display(description='محصولات منتشرشده')
    def product_count(self, obj):
        return obj.products.filter(status='published').count()


@admin.register(ReturnPolicySettings)
class AdminReturnPolicySettings(admin.ModelAdmin):
    """The return window and the express option, decided by whoever runs this.

    Left empty on a fresh deploy on purpose: the footer badge and the legal
    document both read this row, so an unset window means the site makes no
    numeric promise anywhere rather than one nobody approved.
    """

    list_display = ('window_days', 'express_shipping_enabled', 'express_shipping_fee', 'updated_at')
    readonly_fields = ('updated_at', 'preview')
    fieldsets = (
        ('بازگشت کالا', {'fields': ('window_days', 'conditions')}),
        ('ارسال فوری', {'fields': ('express_shipping_enabled', 'express_shipping_fee')}),
        ('هم‌زمان با متن حقوقی', {'fields': ('preview', 'updated_at')}),
    )

    @admin.display(description='پیش‌نمایش آنچه مشتری می‌بیند')
    def preview(self, obj):
        return format_html(
            '<div class="help">بنر پاورقی: <b>{}</b><br>صفحه «خرید و بازگشت کالا»: '
            '<span style="white-space:pre-line">{}</span></div>',
            obj.window_label or 'بدون عدد (فقط «پس از هماهنگی با میز پشتیبانی»)',
            obj.conditions or 'متنی وارد نشده است.',
        )

    def has_add_permission(self, request):
        return not ReturnPolicySettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
