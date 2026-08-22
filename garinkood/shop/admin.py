from django.contrib import admin
from .models import Category, Product
from .models import FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail
from .models import (
    Comment, UserAccount, Order, OrderItem, ServiceRequest, ProcurementRequest,
    Storefront, MarketplaceListing, PaymentAttempt, AffiliateProfile,
    AffiliateConversion, FinancialLedgerEntry, PlatformFeedback,
    StorefrontComplaint, VisualSearchRequest
)


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
    list_display = ('user', 'phone', 'gender', 'created')
    list_filter = ('gender', 'created')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'phone')
    readonly_fields = ('created', 'updated')
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


@admin.register(Order)
class AdminOrder(admin.ModelAdmin):
    list_display = ('code', 'customer_name', 'phone', 'total_price', 'payment_status', 'status', 'created_at')
    list_filter = ('status', 'payment_status', 'payment_method', 'created_at')
    search_fields = ('code', 'customer_name', 'phone', 'email')
    list_editable = ('status', 'payment_status')
    readonly_fields = ('code', 'user', 'subtotal', 'shipping_price', 'total_price', 'created_at', 'updated_at')
    inlines = [OrderItemInline]
    actions = [cancel_orders_and_restore_stock]
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
