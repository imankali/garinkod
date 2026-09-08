"""Read-only tracking API: buyers follow their own parcels, staff see all.

Two locks, both deliberate:

1. ``IsAuthenticated`` - there is no anonymous view. Tracking data discloses
   where a buyer's parcel physically is; that is personal data, not a
   storefront listing.
2. Row-level ownership in ``get_queryset`` - a non-staff user only ever sees
   shipments whose order they own. A foreign shipment id answers 404, not
   403, so the endpoint does not even confirm the parcel exists.

Writes stay in admin/staff flows (same contract as machinery): customers get
no write endpoint here.
"""

from django.db.models import Prefetch
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets

from .models import Shipment, ShipmentEvent
from .serializers import ShipmentSerializer


class ShipmentViewSet(viewsets.ReadOnlyModelViewSet):
    """Shipments visible to their owner; every verb staff sees everything."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ShipmentSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = {
        "tracking_code": ["exact"],
        "order__code": ["exact"],
        "status": ["exact"],
    }
    ordering_fields = ["created_at", "estimated_delivery_date"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # perf lockdown: order travels along for free, and the timeline is
        # prefetched in its display order (newest first) once per request -
        # neither list nor detail may issue a query per event.
        queryset = Shipment.objects.select_related("order").prefetch_related(
            Prefetch(
                "events",
                queryset=ShipmentEvent.objects.order_by("-timestamp", "-id"),
            )
        )
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(order__user=self.request.user)
