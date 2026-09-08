"""Admin for machinery profiles — same operator ergonomics as agri_inputs:

raw-id product selection, select_related'd changelists (no N+1), price/stock
travelling with the profile, and the mechanical hot axes (year, second-hand)
one click away in the sidebar.
"""

from django.contrib import admin

from .models import Implement, Tractor


class _MachineryAdmin(admin.ModelAdmin):
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


@admin.register(Tractor)
class TractorAdmin(_MachineryAdmin):
    list_display = (
        "product_title", "product_price", "product_stock",
        "horsepower", "manufacture_year", "working_hours", "is_second_hand", "warranty_months",
    )
    list_filter = ("is_second_hand", "manufacture_year", "warranty_months")


@admin.register(Implement)
class ImplementAdmin(_MachineryAdmin):
    list_display = (
        "product_title", "product_price", "product_stock",
        "implement_type", "working_width", "warranty_months",
    )
    list_filter = ("implement_type",)
    search_fields = ("product__title", "compatible_tractors")
