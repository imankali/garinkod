from django.contrib import admin
from .models import Category, Item  # فقط Item استفاده می‌شه
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


# --- Admin Item (مقاله/محصول) ---
@admin.register(Item)
class AdminItem(admin.ModelAdmin):
    list_filter = ('status', 'publish', 'created', 'author',)
    list_display = ('title', 'author', 'slug', 'status', 'publish',)
    search_fields = ('title', 'body',)
    prepopulated_fields = {'slug': ('title',)}
    raw_id_fields = ('author',)
    date_hierarchy = 'publish'
    ordering = ('-status', '-publish',)
    list_display_links = ('slug',)
    list_editable = ('status',)
    inlines = []

    def get_inline_instances(self, request, obj=None):
        if not obj:
            return super().get_inline_instances(request)

        if obj.category.name == "کود":
            self.inlines = [FertilizerDetailInline]
        elif obj.category.name == "سم":
            self.inlines = [PesticideDetailInline]
        elif obj.category.name == "بذر":
            self.inlines = [SeedDetailInline]
        elif obj.category.name == "ادوات":
            self.inlines = [EquipmentDetailInline]

        return super().get_inline_instances(request, obj)


# --- Admin UserAccount ---
@admin.register(UserAccount)
class AdminUserAccount(admin.ModelAdmin):
    list_display = ('user', 'phone', 'gender')
    list_filter = ('gender',)
    search_fields = ('user__username', 'phone')


# --- Admin Comment ---
@admin.register(Comment)
class AdminComment(admin.ModelAdmin):
    list_display = ('name', 'post', 'created', 'active')  # ✅ 'crated' → 'created'
    list_filter = ('active', 'created')                   # ✅ 'crated' → 'created'
    list_editable = ('active',)
    search_fields = ('name', 'email', 'body')


# --- ثبت دسته‌بندی ---
admin.site.register(Category)