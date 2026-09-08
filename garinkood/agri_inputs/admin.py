"""Admin for the four agri-input profiles.

Operator ergonomics: product selection stays on raw-ids (catalogue grows to
enterprise scale), the hot regulatory axes (expiry, toxicity, season,
treatment) are one click in the changelist filters, every changelist is
select_related('product') so a page never fans out into N+1s — and the
product's price/stock columns travel WITH the profile so a buying manager
never needs to open the linked product row. `is_expired` is surfaced as a
boolean badge so expired lots are visible at a glance.
"""

from django.contrib import admin

from .models import Fertilizer, Pesticide, Seed, Seedling


class _AgriInputAdmin(admin.ModelAdmin):
    """Shared base: the product FK is heavy — always join it, never autocomplete."""

    raw_id_fields = ("product",)
    search_fields = ("product__title",)
    list_select_related = ("product",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("product")

    @admin.display(description="نام محصول", ordering="product__title")
    def product_title(self, obj):
        return obj.product.title

    @admin.display(description="قیمت (تومان)", ordering="product__price")
    def product_price(self, obj):
        return f"{obj.product.price:,}"

    @admin.display(description="موجودی", ordering="product__stock")
    def product_stock(self, obj):
        return obj.product.stock

    @admin.display(boolean=True, description="منقضی؟", ordering="expiry_date")
    def is_expired(self, obj):
        return obj.is_expired


@admin.register(Fertilizer)
class FertilizerAdmin(_AgriInputAdmin):
    list_display = (
        "product_title", "product_price", "product_stock",
        "npk_ratio", "active_ingredient", "expiry_date", "is_expired", "registration_number",
    )
    list_filter = ("expiry_date",)
    search_fields = ("product__title", "registration_number", "active_ingredient")


@admin.register(Pesticide)
class PesticideAdmin(_AgriInputAdmin):
    list_display = (
        "product_title", "product_price", "product_stock",
        "target_pest", "toxicity_level", "waiting_period", "expiry_date", "is_expired", "registration_number",
    )
    list_filter = ("toxicity_level", "expiry_date", "registration_number")
    search_fields = ("product__title", "target_pest", "registration_number")


@admin.register(Seed)
class SeedAdmin(_AgriInputAdmin):
    list_display = (
        "product_title", "product_price", "product_stock",
        "variety_name", "germination_rate", "planting_season", "seed_treatment",
    )
    list_filter = ("planting_season", "seed_treatment")
    search_fields = ("product__title", "variety_name")


@admin.register(Seedling)
class SeedlingAdmin(_AgriInputAdmin):
    list_display = (
        "product_title", "product_price", "product_stock",
        "scion_variety", "rootstock", "age_years", "height_cm",
    )
    list_filter = ("age_years",)
    search_fields = ("product__title", "scion_variety", "rootstock")
