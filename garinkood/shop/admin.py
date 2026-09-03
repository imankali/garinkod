from django.conf import settings
from django.contrib import admin, messages
from django.utils import timezone

from .models import Category, Product
from .models import FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail
from .models import (
    Comment, UserAccount, Order, OrderItem, ServiceRequest, ProcurementRequest,
    Storefront, MarketplaceListing, PaymentAttempt, AffiliateProfile,
    AffiliateConversion, FinancialLedgerEntry, PlatformFeedback,
    StorefrontComplaint, VisualSearchRequest, Coupon, Wallet, WalletTransaction,
    StorefrontPost, FarmLand, FarmCalendarEvent, FarmConsultationRequest,
    AdminAuditLog, OneTimePassword, NotificationTemplate,
    NotificationRecipient, NotificationDelivery,
)
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


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    readonly_fields = ('product', 'product_title', 'product_slug', 'unit_price', 'quantity', 'total_price')


# --- اکشن‌ها ---
def make_published(modeladmin, request, queryset):
    queryset.update(status='published')


make_published.short_description = "انتشار انتخاب‌شده‌ها"


def make_draft(modeladmin, request, queryset):
    queryset.update(status='draft')


make_draft.short_description = "پیش‌نویس کردن انتخاب‌شده‌ها"


def approve_comments(modeladmin, request, queryset):
    queryset.update(active=True)


approve_comments.short_description = "فعال کردن نظرات انتخاب‌شده"


def disapprove_comments(modeladmin, request, queryset):
    queryset.update(active=False)


disapprove_comments.short_description = "غیرفعال کردن نظرات انتخاب‌شده"


# --- Admin Category ---
@admin.register(Category)
class AdminCategory(admin.ModelAdmin):
    list_display = ('name', 'slug', 'get_product_count')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('name',)

    def get_product_count(self, obj):
        return obj.products.filter(status='published').count()

    get_product_count.short_description = 'تعداد محصولات'


# --- Admin Item (محصول) ---
@admin.register(Product)
class AdminProduct(admin.ModelAdmin):
    list_filter = ('status', 'publish', 'created', 'author', 'category')
    list_display = ('title', 'author', 'category', 'slug', 'status', 'publish', 'price', 'stock')
    search_fields = ('title', 'description', 'author__username')
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
    actions = [make_published, make_draft]

    fieldsets = (
        ('اطلاعات اصلی', {'fields': ('title', 'slug', 'author', 'status')}),
        ('دسته‌بندی و قیمت', {'fields': ('category', 'price', 'stock')}),
        ('محتوا', {'fields': ('description', 'image')}),
        ('تاریخ‌ها', {'fields': ('publish', 'created', 'updated'), 'classes': ('collapse',)}),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            obj.author = request.user
        super().save_model(request, obj, form, change)

    def get_inline_instances(self, request, obj=None):
        if not obj:
            return super().get_inline_instances(request)
        if obj.category and obj.category.slug == "fertilizer":
            return [FertilizerDetailInline(self.model, self.admin_site)]
        if obj.category and obj.category.slug == "pesticide":
            return [PesticideDetailInline(self.model, self.admin_site)]
        if obj.category and obj.category.slug == "seed":
            return [SeedDetailInline(self.model, self.admin_site)]
        if obj.category and obj.category.slug == "equipment":
            return [EquipmentDetailInline(self.model, self.admin_site)]
        return []


# --- Admin UserAccount ---
@admin.register(UserAccount)
class AdminUserAccount(admin.ModelAdmin):
    list_display = ('user', 'phone', 'phone_verified_at', 'gender', 'created')
    list_filter = ('gender', 'phone_verified_at', 'created')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'phone')
    readonly_fields = ('phone_verified_at', 'created', 'updated')
    ordering = ('-created',)


# --- Admin Comment ---
@admin.register(Comment)
class AdminComment(admin.ModelAdmin):
    list_display = ('name', 'product', 'created', 'active', 'email')
    list_filter = ('active', 'created', 'updated')
    list_editable = ('active',)
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
class AdminOrder(admin.ModelAdmin):
    list_display = ('code', 'customer_name', 'phone', 'total_price', 'payment_status', 'status', 'created_at')
    list_filter = ('status', 'payment_status', 'payment_method', 'created_at')
    search_fields = ('code', 'customer_name', 'phone', 'email')
    list_editable = ('status', 'payment_status')
    readonly_fields = ('code', 'user', 'subtotal', 'shipping_price', 'total_price', 'created_at', 'updated_at')
    inlines = [OrderItemInline]
    actions = [cancel_orders_and_restore_stock, mark_orders_paid_and_issue_rewards]
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


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
    list_display = ('title', 'storefront', 'crop_name', 'price', 'unit', 'quantity_available', 'status', 'created_at')
    list_filter = ('status', 'harvest_date', 'created_at')
    search_fields = ('title', 'slug', 'crop_name', 'storefront__name')
    prepopulated_fields = {'slug': ('title',)}
    list_editable = ('status',)
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(PaymentAttempt)
class AdminPaymentAttempt(admin.ModelAdmin):
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
class AdminNotificationTemplate(admin.ModelAdmin):
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
