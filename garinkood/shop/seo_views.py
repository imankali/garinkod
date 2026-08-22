"""Small, database-backed SEO endpoints for the public catalogue."""

from xml.sax.saxutils import escape

from django.conf import settings
from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET

from .models import Category, Product


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
            "",
        ]
    )
    return HttpResponse(content, content_type="text/plain; charset=utf-8")


@require_GET
def sitemap_xml(_request):
    """Expose only indexable, published catalogue URLs in the sitemap."""
    entries: list[tuple[str, str, str]] = [
        (_absolute("/"), timezone.now().date().isoformat(), "daily"),
    ]

    for category in Category.objects.all().only("slug"):
        entries.append((_absolute(f"/products?category={category.slug}"), "", "weekly"))

    for product in Product.objects.filter(status="published").only("slug", "updated"):
        entries.append(
            (_absolute(f"/products/{product.slug}"), product.updated.date().isoformat(), "weekly")
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
