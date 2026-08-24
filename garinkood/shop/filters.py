"""Public product catalogue filters.

The names in this filter set are part of the frontend API contract.  Keeping
those aliases here prevents UI query parameters from being silently ignored by
Django Filter.
"""

import django_filters
from django.db.models import Q, QuerySet

from .models import Product


class ProductFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(field_name="category__slug", lookup_expr="exact")
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    has_discount = django_filters.BooleanFilter(field_name="discount_percent", lookup_expr="gt", label="دارای تخفیف")

    class Meta:
        model = Product
        fields = [
            "category", "is_featured", "available", "in_stock", "has_discount",
            "min_price", "max_price",
        ]

    @staticmethod
    def filter_in_stock(queryset: QuerySet, _name: str, value: bool | None) -> QuerySet:
        if value is None:
            return queryset
        if value:
            return queryset.filter(available=True, stock__gt=0)
        return queryset.filter(Q(available=False) | Q(stock__lte=0))
