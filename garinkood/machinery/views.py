"""Read-only public API for machinery profiles.

Mirrors the agri_inputs contract: one base viewset enforcing
``select_related('product')`` (perf phase N+1 lockdown), with buyer-centric
filters — a farmer browses by horsepower/year/second-hand, an implement by
its type/width/tractor compatibility (partial text).
"""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets

from .models import Implement, Tractor
from .serializers import ImplementSerializer, TractorSerializer


class MachineryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    """Base for machinery listing endpoints; writes stay in admin/staff flows."""

    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    serializer_class = None

    def get_queryset(self):
        model = self.serializer_class.Meta.model
        return model.objects.select_related("product").all()


class TractorViewSet(MachineryViewSet):
    serializer_class = TractorSerializer
    filterset_fields = {
        "is_second_hand": ["exact"],
        "manufacture_year": ["exact", "gte", "lte"],
        "horsepower": ["exact", "gte", "lte"],
        "warranty_months": ["gte"],
        "working_hours": ["lte"],
    }
    ordering_fields = ["manufacture_year", "horsepower", "working_hours"]
    ordering = ["-manufacture_year"]


class ImplementViewSet(MachineryViewSet):
    serializer_class = ImplementSerializer
    filterset_fields = {
        "implement_type": ["exact"],
        "working_width": ["exact", "gte", "lte"],
        "warranty_months": ["gte"],
        "compatible_tractors": ["icontains"],
    }
    search_fields = ["compatible_tractors", "product__title"]
    ordering_fields = ["working_width", "implement_type"]
    ordering = ["implement_type"]
