"""Public product catalogue filters.

The names in this filter set are part of the frontend API contract.  Keeping
those aliases here prevents UI query parameters from being silently ignored by
Django Filter.
"""

import django_filters
from django.db.models import Q, QuerySet
from django.utils import timezone

from datetime import timedelta

from .models import Product


class ProductFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(field_name="category__slug", lookup_expr="exact")
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    has_discount = django_filters.BooleanFilter(field_name="discount_percent", lookup_expr="gt", label="دارای تخفیف")
    # Facets that a wholesale catalogue is browsed by: the maker and the size of
    # the package. Both are exact matches on indexed text columns.
    brand = django_filters.CharFilter(field_name="brand", lookup_expr="iexact")
    package_weight = django_filters.CharFilter(field_name="package_weight", lookup_expr="iexact")
    price_on_request = django_filters.BooleanFilter(field_name="price_on_request")
    # The axes a landing/category page filters on. ``brand_slug`` is the one the
    # brand pages use, since a brand page has to survive a supplier renaming its
    # display text.
    brand_slug = django_filters.CharFilter(field_name="brand_slug", lookup_expr="exact")
    subcategory = django_filters.CharFilter(field_name="subcategory__slug", lookup_expr="exact")
    tag = django_filters.CharFilter(field_name="tags__slug", lookup_expr="exact")
    # Star ratings and review counts are annotated by the viewset's queryset, so
    # these two filters read the same numbers the cards show — a chip can never
    # promise a result set the UI then rates differently.
    min_rating = django_filters.NumberFilter(field_name="avg_rating", lookup_expr="gte")
    has_reviews = django_filters.BooleanFilter(method="filter_has_reviews", label="فقط دارای بازخورد")
    expiring_soon = django_filters.BooleanFilter(method="filter_expiring_soon")

    class Meta:
        model = Product
        fields = [
            "category", "is_featured", "available", "in_stock", "has_discount",
            "min_price", "max_price", "brand", "package_weight", "price_on_request",
            "brand_slug", "subcategory", "tag", "min_rating", "has_reviews",
            "expiring_soon",
        ]

    @staticmethod
    def filter_has_reviews(queryset: QuerySet, _name: str, value: bool | None) -> QuerySet:
        """Only the products a buyer has actually reviewed — one review counts.

        Written against the relation rather than the ``reviews_count`` annotation
        because the same filter object is reused by queryset paths that do not
        annotate, and ``true`` must not quietly mean ``more than one``. The row
        definition matches the one the cards aggregate: approved, top-level and
        scored — a question is not a review.
        """
        if value is None:
            return queryset
        reviewed = Q(comments__active=True, comments__parent__isnull=True, comments__rating__isnull=False)
        if value:
            return queryset.filter(reviewed).distinct()
        return queryset.exclude(reviewed)

    @staticmethod
    def filter_expiring_soon(queryset: QuerySet, _name: str, value: bool | None) -> QuerySet:
        """Stock whose declared expiry is within the 90-day warning window.

        An undeclared date is unknown rather than old, so those products are only
        ever returned by the inverse filter.
        """
        if value is None:
            return queryset
        horizon = timezone.localdate() + timedelta(days=90)
        if value:
            return queryset.filter(expiry_date__isnull=False, expiry_date__lte=horizon)
        return queryset.filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=horizon))

    @staticmethod
    def filter_in_stock(queryset: QuerySet, _name: str, value: bool | None) -> QuerySet:
        if value is None:
            return queryset
        if value:
            return queryset.filter(available=True, stock__gt=0)
        return queryset.filter(Q(available=False) | Q(stock__lte=0))
