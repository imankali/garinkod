"""Backfill the brand slugs that brand pages and brand matching depend on.

Rows saved before ``Product.brand_slug`` / ``BrandPartner.slug`` existed carry an
empty slug, which would leave their brand page unreachable and their product out
of the brand facet. One pass of the same helper that ``save()`` uses keeps the
backfill and future writes in agreement.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    from shop.slugs import slugify_fa

    Product = apps.get_model('shop', 'Product')
    taken = set()
    for product in Product.objects.exclude(brand='').iterator():
        Product.objects.filter(pk=product.pk).update(brand_slug=slugify_fa(product.brand))

    BrandPartner = apps.get_model('shop', 'BrandPartner')
    for partner in BrandPartner.objects.all():
        base = slugify_fa(partner.name) or 'brand'
        slug, attempt = base, 1
        while slug in taken:
            slug = f'{base}-{attempt}'
            attempt += 1
        taken.add(slug)
        BrandPartner.objects.filter(pk=partner.pk).update(slug=slug)


def noop(apps, schema_editor):  # pragma: no cover - reverse of a backfill
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0028_brandpartner_slug_historicalproduct_brand_slug_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, noop, elidable=True),
    ]
