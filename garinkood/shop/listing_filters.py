"""The filter grammar of a marketplace ad list, in one importable place.

The catalogue (``Product``) and the marketplace (``MarketplaceListing``) used to
be filtered by two completely different mechanisms — a ``django-filter`` set for
products and hand-rolled ``params.get`` calls for ads. That asymmetry is what
made the shop's filter bar useless on the «آگهی‌های غرفه‌داران» tab: the chips
could only ever send parameters the ad endpoint ignored.

This module gives the ad side the same grammar the product side already speaks:

* every taxonomy parameter accepts a **comma-separated list** — two brands, three
  departments — because «همه» and «یکی» are not the only useful answers;
* a department also matches the ads filed under one of its own subcategories, so
  ticking «آبیاری» never hides the drip tape filed under «قطره‌ای»;
* free-text values are matched case-insensitively and with the same
  zero-width-joiner tolerance the search box has, since a seller types
  «گلخانه ای» and the row stores «گلخانه‌ای».

``apply_listing_filters`` is pure (queryset in, queryset out) so the facets
endpoint can reuse it: a facet list has to be narrowed by every filter *except*
the axis it draws, and that is only expressible if narrowing is a function.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db.models import Count, Q

MAX_SELECTED_VALUES = 24

# Parameters understood by the ad list. Anything else in the query string is
# someone else's business (page, ordering, a deep link).
LIST_FILTER_KEYS = (
    'province', 'city', 'seller_type', 'storefront', 'category', 'subcategory',
    'brand', 'package_size', 'crop', 'unit', 'verified', 'in_stock', 'stock',
    'has_discount', 'min_rating', 'min_price', 'max_price', 'min_quantity',
)


def csv_values(raw) -> list[str]:
    """Split a comma-separated filter into clean, de-duplicated values.

    Trailing commas and an accidental double tick must not multiply the same
    condition, so order is preserved while duplicates collapse.
    """
    if raw is None:
        return []
    parts = [part.strip() for part in str(raw).split(',')]
    seen: list[str] = []
    for part in parts:
        if part and part not in seen:
            seen.append(part)
    return seen[:MAX_SELECTED_VALUES]


def is_truthy(raw) -> bool:
    return str(raw or '').strip().lower() in {'1', 'true', 'yes', 'on'}


def _fold_icontains(lookup: str, values) -> Q:
    """OR a set of case-insensitive exact matches onto one Q object."""
    query = Q()
    for value in values:
        query |= Q(**{f'{lookup}__iexact': value})
    return query


def apply_listing_filters(queryset, params):
    """Narrow a ``MarketplaceListing`` queryset by the documented parameters.

    Unparsable values are dropped rather than raising: a hand-edited URL with
    ``min_price=abc`` should show the unfiltered list, not a 500.
    """
    get = params.get if hasattr(params, 'get') else lambda key, default='': default

    provinces = csv_values(get('province'))
    if provinces:
        queryset = queryset.filter(_fold_icontains('storefront__province', provinces))
    cities = csv_values(get('city'))
    if cities:
        queryset = queryset.filter(_fold_icontains('storefront__city', cities))
    seller_types = csv_values(get('seller_type'))
    if seller_types:
        queryset = queryset.filter(storefront__seller_type__in=seller_types)
    storefronts = csv_values(get('storefront'))
    if storefronts:
        queryset = queryset.filter(storefront__slug__in=storefronts)

    categories = csv_values(get('category'))
    if categories:
        queryset = queryset.filter(
            Q(category__slug__in=categories) | Q(subcategory__category__slug__in=categories)
        ).distinct()
    subcategories = csv_values(get('subcategory'))
    if subcategories:
        queryset = queryset.filter(subcategory__slug__in=subcategories).distinct()

    brands = csv_values(get('brand'))
    if brands:
        from .slugs import slugify_fa

        query = Q()
        for brand in brands:
            query |= Q(brand__iexact=brand) | Q(brand_slug=slugify_fa(brand))
        queryset = queryset.filter(query)

    packages = csv_values(get('package_size'))
    if packages:
        queryset = queryset.filter(_fold_icontains('package_size', packages))

    crops = csv_values(get('crop'))
    if crops:
        query = Q()
        for crop in crops:
            query |= Q(crop_name__icontains=crop)
        queryset = queryset.filter(query)

    units = csv_values(get('unit'))
    if units:
        queryset = queryset.filter(_fold_icontains('unit', units))

    if is_truthy(get('verified')):
        queryset = queryset.filter(storefront__is_verified=True)
    if is_truthy(get('in_stock')):
        queryset = queryset.filter(quantity_available__gt=0)
    if is_truthy(get('stock')):
        queryset = queryset.filter(is_stock=True)
    elif get('stock') in ('0', 'false'):
        queryset = queryset.filter(is_stock=False)
    if is_truthy(get('has_discount')):
        queryset = queryset.filter(discount_percent__gt=0)

    min_rating = (get('min_rating') or '').strip()
    if min_rating:
        try:
            queryset = queryset.filter(storefront__rating__gte=Decimal(min_rating))
        except (InvalidOperation, ValueError):
            pass

    for key, lookup in (
        ('min_price', 'price__gte'),
        ('max_price', 'price__lte'),
        ('min_quantity', 'quantity_available__gte'),
    ):
        raw = (get(key) or '').strip()
        if not raw:
            continue
        try:
            queryset = queryset.filter(**{lookup: Decimal(raw)})
        except (InvalidOperation, ValueError):
            continue
    return queryset


def facet_rows(queryset, values, *, limit: int = 60, order_by_count: bool = True):
    """``[{'value', 'label', 'count'}]`` for one facet axis of an ad queryset.

    Counting happens on the already-narrowed queryset, which is what lets the
    caller answer «given this department, which brands are actually here?».
    """
    rows = (
        queryset.exclude(**{f'{values}__isnull': True})
        .exclude(**{values: ''})
        .values(values)
        .annotate(total=Count('id'))
    )
    listed = list(rows.order_by('-total', values) if order_by_count else rows.order_by(values))
    return [
        {'value': row[values], 'label': row[values], 'count': row['total']}
        for row in listed[:limit]
    ]


def category_facet_rows(queryset, *, limit: int = 24):
    """Published-ad counts per department, keyed by slug.

    Grouping on ``category`` alone would split the ads that a seller filed under
    a subcategory of that department, which is exactly the case the parent chip
    has to cover — so the count is the union of both.
    """
    from .models import Category

    totals: dict[str, int] = {}
    direct = (
        queryset.exclude(category__isnull=True)
        .values('category__slug')
        .annotate(total=Count('id'))
    )
    for row in direct:
        totals[row['category__slug']] = totals.get(row['category__slug'], 0) + row['total']
    via_sub = (
        queryset.filter(category__isnull=True)
        .exclude(subcategory__isnull=True)
        .values('subcategory__category__slug')
        .annotate(total=Count('id'))
    )
    for row in via_sub:
        slug = row['subcategory__category__slug']
        if slug:
            totals[slug] = totals.get(slug, 0) + row['total']

    ordered = sorted(totals.items(), key=lambda item: (-item[1], item[0]))[:limit]
    names = dict(
        Category.objects.filter(slug__in=[slug for slug, _count in ordered]).values_list('slug', 'name')
    )
    return [
        {'value': slug, 'label': names.get(slug, slug), 'count': count}
        for slug, count in ordered
    ]
