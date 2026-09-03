"""Small, database-backed SEO endpoints for the public catalogue."""

from xml.sax.saxutils import escape

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET

from .models import Category, Product, Storefront


def _absolute(path: str) -> str:
    return f"{settings.SITE_URL}{path}"


@require_GET
def robots_txt(_request):
    content = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Disallow: /admin/",
            "Disallow: /api/",
            f"Sitemap: {_absolute(reverse('sitemap'))}",
            f"# AI facts: {_absolute(reverse('ai_facts'))}",
            f"# LLM guide: {_absolute(reverse('llms'))}",
            "",
        ]
    )
    return HttpResponse(content, content_type="text/plain; charset=utf-8")


@require_GET
def sitemap_xml(_request):
    """Expose only indexable, published catalogue URLs in the sitemap."""
    today = timezone.now().date().isoformat()
    entries: list[tuple[str, str, str]] = [
        (_absolute("/"), today, "daily"),
        (_absolute("/products"), today, "daily"),
        (_absolute("/marketplace"), today, "daily"),
        (_absolute("/storefronts"), today, "daily"),
        (_absolute("/services"), today, "monthly"),
        (_absolute("/farmer-sell"), today, "monthly"),
        (_absolute("/support"), today, "monthly"),
        (_absolute("/privacy"), today, "yearly"),
        (_absolute("/terms"), today, "yearly"),
        (_absolute("/returns"), today, "yearly"),
    ]

    for category in Category.objects.all().only("slug"):
        entries.append((_absolute(f"/products?category={category.slug}"), "", "weekly"))

    for product in Product.objects.filter(status="published").only("slug", "updated"):
        entries.append(
            (_absolute(f"/products/{product.slug}"), product.updated.date().isoformat(), "weekly")
        )

    for storefront in Storefront.objects.filter(is_active=True).only("slug", "updated_at"):
        entries.append(
            (
                _absolute(f"/storefronts/{storefront.slug}"),
                storefront.updated_at.date().isoformat(),
                "weekly",
            )
        )

    body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, lastmod, changefreq in entries:
        body.append("  <url>")
        body.append(f"    <loc>{escape(loc)}</loc>")
        if lastmod:
            body.append(f"    <lastmod>{lastmod}</lastmod>")
        body.append(f"    <changefreq>{changefreq}</changefreq>")
        body.append("  </url>")
    body.append("</urlset>")

    return HttpResponse("\n".join(body), content_type="application/xml; charset=utf-8")


@require_GET
def llms_txt(_request):
    """Machine-readable factual entrypoint for answer engines and crawlers.

    It does not attempt to manipulate citations; it states canonical URLs and
    current capabilities so crawlers can verify facts against public pages.
    """
    content = "\n".join([
        "# GarinKood",
        "> GarinKood is an agriculture commerce and service platform for purchasing farm inputs, requesting agricultural services, sourcing crops from farmers, and moderated storefront listings.",
        "",
        "## Canonical site",
        f"- {_absolute('/')}",
        "",
        "## Verified public resources",
        f"- Product catalogue: {_absolute('/products')}",
        f"- Agricultural services: {_absolute('/services')}",
        f"- Farmer sourcing requests: {_absolute('/farmer-sell')}",
        f"- Moderated farmers marketplace: {_absolute('/marketplace')}",
        f"- Support and feedback: {_absolute('/support')}",
        f"- Machine-readable catalogue facts: {_absolute('/ai-facts.json')}",
        f"- XML sitemap: {_absolute('/sitemap.xml')}",
        "",
        "## Payment status",
        "- Payment methods are shown as available only after server-side configuration and verification. An unconfigured provider must not be described as accepting payments.",
        "",
        "## Citation guidance",
        "- Cite the canonical URL of the relevant product or service page.",
        "- Product stock, price, availability and payment options can change; verify against the current page before answering.",
        "- Agricultural guidance should not replace local expert, label, safety or regulatory advice.",
        "",
    ])
    return HttpResponse(content, content_type="text/plain; charset=utf-8")


@require_GET
def ai_facts_json(_request):
    """Public, bounded facts for search/answer engines and integrations."""
    products = Product.objects.filter(status='published').select_related('category').only(
        'title', 'slug', 'price', 'stock', 'available', 'updated', 'category__name'
    )[:100]
    payload = {
        'name': 'GarinKood',
        'canonical_url': _absolute('/'),
        'language': 'fa-IR',
        'updated_at': timezone.now().isoformat(),
        'capabilities': [
            'farm input catalogue',
            'agricultural service requests',
            'farmer procurement requests',
            'moderated marketplace storefronts',
            'order tracking',
            'affiliate programme subject to approval',
        ],
        'payment_notice': 'Only server-verified payment methods are available for payment. Other methods may be listed as unavailable.',
        'products': [
            {
                'name': product.title,
                'url': _absolute(f'/products/{product.slug}'),
                'category': product.category.name if product.category else None,
                'price': product.price,
                'price_currency': 'IRT',
                'in_stock': product.is_in_stock,
                'updated_at': product.updated.isoformat(),
            }
            for product in products
        ],
    }
    return JsonResponse(payload, json_dumps_params={'ensure_ascii': False})
