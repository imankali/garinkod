"""Admin for the logistics context - operator ergonomics over decoration.

Same house rules as machinery: raw-id pickers for the heavy relations (no
thousand-row <select> on the change page), select_related'd changelists (the
perf phase's N+1 lockdown), and the append-only event log editable inline
right on the shipment change page where staff actually works.
"""

from django.contrib import admin

from .models import Shipment, ShipmentEvent


class ShipmentEventInline(admin.TabularInline):
    """Append tracking hops without leaving the shipment change page."""

    model = ShipmentEvent
    extra = 0
    fields = ("status", "description", "location", "timestamp")
    readonly_fields = ("timestamp",)


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    raw_id_fields = ("order",)
    list_select_related = ("order",)
    list_display = (
        "tracking_code",
        "carrier_name",
        "status",
        "order_code",
        "estimated_delivery_date",
        "created_at",
    )
    list_filter = ("status", "carrier_name")
    search_fields = ("tracking_code", "carrier_name", "order__code")
    inlines = (ShipmentEventInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("order")

    @admin.display(description="کد سفارش", ordering="order__code")
    def order_code(self, obj):
        return obj.order.code


@admin.register(ShipmentEvent)
class ShipmentEventAdmin(admin.ModelAdmin):
    raw_id_fields = ("shipment",)
    list_select_related = ("shipment",)
    list_display = ("shipment_tracking_code", "status", "location", "timestamp")
    list_filter = ("status",)
    search_fields = ("shipment__tracking_code", "description")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("shipment")

    @admin.display(description="کد رهگیری", ordering="shipment__tracking_code")
    def shipment_tracking_code(self, obj):
        return obj.shipment.tracking_code
