"""Serializers for the logistics bounded context.

DDD local contract (identical rule to machinery): the module exposes its own
state plus the order code as a plain string; it never imports a shop
serializer, so removing this app costs the platform nothing but these files.
"""

from rest_framework import serializers

from .models import Shipment, ShipmentEvent


class ShipmentEventSerializer(serializers.ModelSerializer):
    """One append-only tracking hop, rendered newest-first by the query plan."""

    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ShipmentEvent
        fields = [
            "id",
            "status",
            "status_label",
            "description",
            "location",
            "timestamp",
        ]
        read_only_fields = fields


class ShipmentSerializer(serializers.ModelSerializer):
    """Customer-facing tracking card: parcel state plus the full timeline."""

    order_code = serializers.CharField(source="order.code", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    events = ShipmentEventSerializer(many=True, read_only=True)

    class Meta:
        model = Shipment
        fields = [
            "id",
            "order_code",
            "tracking_code",
            "carrier_name",
            "status",
            "status_label",
            "estimated_delivery_date",
            "shipped_at",
            "delivered_at",
            "events",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
