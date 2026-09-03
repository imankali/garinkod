"""Optional Meilisearch ranking with a transparent ORM fallback."""

import logging
import math

from django.conf import settings
from django.core.cache import cache
from django.db.models import Case, IntegerField, When
from rest_framework.filters import SearchFilter
from waffle import flag_is_active

logger = logging.getLogger(__name__)

try:
    from prometheus_client import Counter

    SEARCH_REQUESTS = Counter(
        "garinkood_catalogue_search_total",
        "Catalogue searches by backend outcome.",
        ("backend", "outcome"),
    )
except ImportError:  # pragma: no cover - django-prometheus installs this in production
    SEARCH_REQUESTS = None


def product_document(product) -> dict:
    return {
        "id": product.pk,
        "title": product.title,
        "description": product.description,
        "brand": product.brand,
        "sku": product.sku,
        "category": product.category.slug if product.category_id else "",
        "category_name": product.category.name if product.category_id else "",
        "status": product.status,
        "available": product.available,
        "stock": product.stock,
        "price": product.price,
        "discount_percent": product.discount_percent,
        "publish_timestamp": int(product.publish.timestamp()),
    }


def _metric(backend: str, outcome: str) -> None:
    if SEARCH_REQUESTS is not None:
        SEARCH_REQUESTS.labels(backend=backend, outcome=outcome).inc()


class ResilientProductSearchFilter(SearchFilter):
    """Use external relevance only when enabled/flagged; otherwise use SQL."""

    def filter_queryset(self, request, queryset, view):
        terms = self.get_search_terms(request)
        if not terms:
            return queryset
        if not settings.MEILISEARCH_ENABLED or not flag_is_active(request, "external_search"):
            _metric("database", "disabled")
            return super().filter_queryset(request, queryset, view)

        query = " ".join(terms).strip()
        try:
            import meilisearch

            client = meilisearch.Client(
                settings.MEILISEARCH_URL,
                settings.MEILISEARCH_API_KEY or None,
                timeout=max(1, math.ceil(settings.MEILISEARCH_TIMEOUT_SECONDS)),
            )
            result = client.index(settings.MEILISEARCH_PRODUCTS_INDEX).search(
                query, {"limit": 500, "attributesToRetrieve": ["id"]}
            )
            hits = result.get("hits")
            if not isinstance(hits, list):
                raise ValueError("Meilisearch response has no hits list")
            ids = [int(hit["id"]) for hit in hits if isinstance(hit, dict) and str(hit.get("id", "")).isdigit()]
            _metric("meilisearch", "success")
            if not ids:
                return queryset.none()
            rank = Case(
                *(When(pk=pk, then=position) for position, pk in enumerate(ids)),
                output_field=IntegerField(),
            )
            # The original queryset remains authoritative for publication,
            # permissions and all database filters; stale index rows cannot leak.
            return queryset.filter(pk__in=ids).order_by(rank)
        except Exception as exc:  # provider outage must not break the catalogue
            _metric("meilisearch", "fallback")
            key = "meilisearch-search-fallback-log"
            if not cache.get(key):
                logger.warning("Meilisearch unavailable; using database search", extra={"error": str(exc)[:300]})
                cache.set(key, True, timeout=60)
            return super().filter_queryset(request, queryset, view)
