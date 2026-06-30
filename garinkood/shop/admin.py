from django.contrib import admin
from .models import Category, Product
from .models import FertilizerDetail, PesticideDetail, SeedDetail, EquipmentDetail
from .models import Comment, UserAccount


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
        return obj.product_set.filter(status='published').count()

    get_product_count.short_description = 'تعداد محصولات'


# --- Admin Item (محصول) ---
@admin.register(Product)
class AdminProduct(admin.ModelAdmin):
    list_filter = ('status', 'publish', 'created', 'author', 'category')
    list_display = ('title', 'author', 'category', 'slug', 'status', 'publish', 'price', 'stock')
    search_fields = ('title', 'description', 'author__username')
    prepopulated_fields = {'slug': ('title',)}
    raw_id_fields = ('author',)
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
    inlines = []

    fieldsets = (
        ('اطلاعات اصلی', {
            'fields': ('title', 'slug', 'author', 'status')
        }),
        ('دسته‌بندی و قیمت', {
            'fields': ('category', 'price', 'stock')
        }),
        ('محتوا', {
            'fields': ('description', 'image')
        }),
        ('تاریخ‌ها', {
            'fields': ('publish', 'created', 'updated'),
            'classes': ('collapse',)
        }),
    )
    # اضافه کردن متد save_model
    def save_model(self, request, obj, form, change):
        if not change:  # اگر محصول جدید است
            obj.author = request.user  # تنظیم نویسنده به کاربر فعلی
        super().save_model(request, obj, form, change)
    def get_inline_instances(self, request, obj=None):
        if not obj:
            return super().get_inline_instances(request)

        if obj.category and obj.category.name == "کود":
            self.inlines = [FertilizerDetailInline]
        elif obj.category and obj.category.name == "سم":
            self.inlines = [PesticideDetailInline]
        elif obj.category and obj.category.name == "بذر":
            self.inlines = [SeedDetailInline]
        elif obj.category and obj.category.name == "ادوات":
            self.inlines = [EquipmentDetailInline]
        else:
            self.inlines = []

        return super().get_inline_instances(request, obj)


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
    search_fields = ('name', 'email', 'description', 'post__title')
    actions = [approve_comments, disapprove_comments]
    date_hierarchy = 'created'
    ordering = ('-created',)
    readonly_fields = ('created', 'updated')
    list_per_page = 20