"""Admin for the export context - the trade desk's workbench.

Same house rules as logistics: raw-id pickers for the heavy relations,
select_related'd changelists (the perf phase's N+1 lockdown), and the papers
of a trade file editable inline on its change page where the specialist
actually works. Destination, currency and status are one glance away.
"""

from django.contrib import admin

from .models import ExportDocument, ExportOrder


class ExportDocumentInline(admin.TabularInline):
    """Upload and verify a trade file's papers without leaving the file."""

    model = ExportDocument
    extra = 0
    fields = ("document_type", "file", "issue_date", "is_verified", "created_at")
    readonly_fields = ("created_at",)


@admin.register(ExportOrder)
class ExportOrderAdmin(admin.ModelAdmin):
    raw_id_fields = ("order",)
    list_select_related = ("order",)
    list_display = (
        "order_code",
        "destination_country",
        "currency",
        "total_value_foreign",
        "status",
        "created_at",
    )
    list_filter = ("status", "destination_country", "currency")
    search_fields = ("order__code",)
    inlines = (ExportDocumentInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("order")

    @admin.display(description="کد سفارش", ordering="order__code")
    def order_code(self, obj):
        return obj.order.code


@admin.register(ExportDocument)
class ExportDocumentAdmin(admin.ModelAdmin):
    raw_id_fields = ("export_order",)
    list_select_related = ("export_order",)
    list_display = ("export_order_code", "document_type", "issue_date", "is_verified", "created_at")
    list_filter = ("document_type", "is_verified")
    search_fields = ("export_order__order__code",)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("export_order", "export_order__order")

    @admin.display(description="سفارش پرونده", ordering="export_order__order__code")
    def export_order_code(self, obj):
        return obj.export_order.order.code
