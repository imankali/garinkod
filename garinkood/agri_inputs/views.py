"""Read-only public API for the four agri-input profiles.

One base ``AgriInputViewSet`` carries the entire family contract —
``select_related('product')`` on the queryset so no row ever fans out into
an extra product query, exposed through tailored filtersets. Registration
stays one ViewSet per model (cleaner DRF routing + serializers), while the
shared base is what a future HOLDING module pages resolve against.

Architect-review fix: free-text agronomic fields now match partial input
(``icontains``) — a buyer searching «پتاسیم» must also match «سولفات پتاسیم».
"""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets

from .models import Fertilizer, Pesticide, Seed, Seedling
from .serializers import (
    FertilizerSerializer,
    PesticideSerializer,
    SeedSerializer,
    SeedlingSerializer,
)


class AgriInputViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    """Base for every agri-input listing endpoint; no writes for now —
    the holding modules own their own create paths (admin/staff flows)."""

    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    serializer_class = None

    def get_queryset(self):
        # Product summary lives on the same payload; force the join ONCE,
        # not once-per-row (N+1 prevention contract from the perf phase).
        model = self.serializer_class.Meta.model
        return model.objects.select_related("product").all()


class FertilizerViewSet(AgriInputViewSet):
    serializer_class = FertilizerSerializer
    filterset_fields = {
        "registration_number": ["exact"],
        "expiry_date": ["exact", "gte", "lte"],
        "active_ingredient": ["icontains"],
        "npk_ratio": ["icontains"],
    }
    ordering_fields = ["expiry_date"]
    ordering = ["expiry_date"]


class PesticideViewSet(AgriInputViewSet):
    serializer_class = PesticideSerializer
    filterset_fields = {
        "registration_number": ["exact"],
        "toxicity_level": ["exact"],
        "waiting_period": ["exact", "lte"],
        "target_pest": ["icontains"],
        "expiry_date": ["exact", "gte", "lte"],
    }
    ordering_fields = ["waiting_period", "expiry_date"]
    ordering = ["waiting_period"]


class SeedViewSet(AgriInputViewSet):
    serializer_class = SeedSerializer
    filterset_fields = {
        "planting_season": ["exact"],
        "seed_treatment": ["exact"],
        "variety_name": ["icontains"],
    }
    search_fields = ["variety_name", "product__title"]
    ordering = ["variety_name"]


class SeedlingViewSet(AgriInputViewSet):
    serializer_class = SeedlingSerializer
    filterset_fields = {
        "rootstock": ["icontains"],
        "scion_variety": ["icontains"],
        "age_years": ["exact", "gte", "lte"],
    }
    ordering_fields = ["age_years", "height_cm"]
    ordering = ["age_years"]
