"""Public product catalogue filters.

The names in this filter set are part of the frontend API contract.  Keeping
those aliases here prevents UI query parameters from being silently ignored by
Django Filter.

The taxonomy axes (``category``, ``subcategory``, ``brand``, ``package_weight``)
accept a comma-separated list, because a farmer shopping for «کود فسفره و اورانی»
reasonably wants both departments at once, and a brand comparison wants two
brands side by side. Everything else — an attribute, a search term — stays
single-valued, since a second value would change the meaning rather than widen it.
"""

import django_filters
from django.db.models import Q, QuerySet
from django.utils import timezone

from datetime import timedelta

from .models import Product

# Cap on how many values one facet may select: enough for a real comparison,
# low enough that a crafted URL cannot turn one filter into a thousand ORs.
MAX_SELECTED_VALUES = 24


def csv_values(raw: str | None) -> list[str]:
    """Split a facet parameter into clean values, order preserved, no repeats."""
    if not raw:
        return []
    seen: list[str] = []
    for part in str(raw).split(','):
        value = part.strip()
        if value and value not in seen:
            seen.append(value)
    return seen[:MAX_SELECTED_VALUES]


class ProductFilter(django_filters.FilterSet):
    category = django_filters.CharFilter(method='filter_category')
    subcategory = django_filters.CharFilter(method='filter_subcategory')
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")
    in_stock = django_filters.BooleanFilter(method="filter_in_stock")
    has_discount = django_filters.BooleanFilter(field_name="discount_percent", lookup_expr="gt", label="دارای تخفیف")
    # Facets a wholesale catalogue is browsed by: the maker and the size of the
    # package. Both accept several values at once, so a comparison survives.
    brand = django_filters.CharFilter(method='filter_brand')
    package_weight = django_filters.CharFilter(method='filter_package_weight')
    price_on_request = django_filters.BooleanFilter(field_name="price_on_request")
    # The axes a landing/category page filters on. ``brand_slug`` is the one the
    # brand pages use, since a brand page has to survive a supplier renaming its
    # display text.
    brand_slug = django_filters.CharFilter(field_name="brand_slug", lookup_expr="exact")
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

    # -- multi-value taxonomy facets ---------------------------------------

    @staticmethod
    def filter_category(queryset: QuerySet, _name: str, value) -> QuerySet:
        slugs = csv_values(value)
        if not slugs:
            return queryset
        # A department includes what the warehouse filed under its own
        # subcategories, so ticking «کود کشاورزی» can never hide a bag that was
        # filed under «کود NPK».
        return queryset.filter(
            Q(category__slug__in=slugs) | Q(subcategory__category__slug__in=slugs)
        ).distinct()

    @staticmethod
    def filter_subcategory(queryset: QuerySet, _name: str, value) -> QuerySet:
        slugs = csv_values(value)
        if not slugs:
            return queryset
        return queryset.filter(subcategory__slug__in=slugs).distinct()

    @staticmethod
    def filter_brand(queryset: QuerySet, _name: str, value) -> QuerySet:
        brands = csv_values(value)
        if not brands:
            return queryset
        from .slugs import slugify_fa

        query = Q()
        for brand in brands:
            query |= Q(brand__iexact=brand) | Q(brand_slug=slugify_fa(brand))
        return queryset.filter(query).distinct()

    @staticmethod
    def filter_package_weight(queryset: QuerySet, _name: str, value) -> QuerySet:
        sizes = csv_values(value)
        if not sizes:
            return queryset
        query = Q()
        for size in sizes:
            query |= Q(package_weight__iexact=size)
        return queryset.filter(query).distinct()

    # -- derived flags -----------------------------------------------------

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
