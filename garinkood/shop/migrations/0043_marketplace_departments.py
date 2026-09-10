"""Departments for the marketplace, and filing the ads that had none.

``MarketplaceListing`` gained a real ``category``/``subcategory`` pair so the
shop's filter bar can work for storefront ads the same way it works for the
site's own catalogue. Two things follow, and both belong in one migration:

1. the taxonomy has to actually contain the departments a farmer trades in —
   fresh produce, grain, livestock — none of which the warehouse stocks. They are
   created ``storefront_only`` so an empty tile never appears in the shop's own
   category grid;
2. the ads already published have to be filed, or the first person to tap a
   category chip sees an empty result and concludes the feature is broken.
   The keywords below are the migration's own copy of the rules in
   ``shop.catalog_classify`` (which the API applies to a new ad whose author
   skipped the picker): a migration must not import application code, because
   the rules will change under it and the migration has to stay replayable.

The forward seeding is idempotent (``update_or_create``), and the reverse only
removes what this file added — an ad a seller filed by hand survives a rollback.
"""

import re

from django.db import migrations

# slug → (Persian name, SEO description, [(sub-slug, sub-name, sub-keywords), …])
DEPARTMENTS = (
    (
        "greenhouse-produce",
        "صیفی‌جات گلخانه‌ای",
        "گوجه، خیار، فلفل و توت‌فرنگی از گلخانه‌هایی که تمام‌سال برداشت دارند؛ بسته‌بندی سبدی و کارتنی.",
        [
            ("tomato-cucumber", "گوجه و خیار", ("گوجه", "خیار")),
            ("berry", "توت‌فرنگی", ("توت‌فرنگی", "توت فرنگی")),
            ("pepper-eggplant", "فلفل و بادمجان", ("فلفل", "بادمجان")),
        ],
    ),
    (
        "orchard",
        "میوه و تره‌بار",
        "مرکبات، سیب، انگور و خرما با برداشت امسال؛ قیمت درب باغ و بار عمده.",
        [
            ("citrus", "مرکبات", ("پرتقال", "لیمو", "بوکه‌ای", "نارنگی", "گریپ‌فروت")),
            ("stone-fruit", "میوه هسته‌دار", ("هلو", "آلو", "گیلاس", "آلبالو", "زردآلو", "شلیل", "سیب", "گلابی")),
            ("table-grape-date", "انگور و خرما", ("انگور", "خرما", "موز")),
        ],
    ),
    (
        "nuts-dried",
        "خشکبار، زعفران و ادویه",
        "پسته، بادام، کشمش و زعفران سرگل؛ بر اساس گرید و درصد شکوفه تفکیک شده.",
        [
            ("pistachio-almond", "پسته و بادام", ("پسته", "بادام", "گردو", "فندق")),
            ("saffron-spices", "زعفران و ادویه", ("زعفران", "زرشک", "دارچین", "هل", "زردچوبه")),
            ("raisin-dried", "کشمش و میوه خشک", ("کشمش", "توت خشک", "میوه خشک")),
        ],
    ),
    (
        "grain-pulse",
        "غلات، حبوبات و دانه‌های روغنی",
        "گندم، جو، برنج، ذرت و کلزا با تناژ بالا؛ تحویل در انبار یا درب مزرعه.",
        [
            ("wheat-barley", "گندم و جو", ("گندم", "جو", "تریتیکاله", "چاودار")),
            ("rice-maize", "برنج و ذرت", ("برنج", "ذرت", "سورگوم")),
            ("pulses-oilseeds", "حبوبات و روغنی", ("عدس", "نخود", "لوبیا", "کلزا", "کنجد", "حبوبات")),
        ],
    ),
    (
        "livestock-feed",
        "دام، طیور و نهاده‌های دامی",
        "جوجه‌کشی، دام زنده، کنسانتره و یونجه از تولیدکننده؛ بدون واسطه و با بارنامه.",
        [
            ("live-animal", "دام و طیور زنده", ("گوساله", "بره", "گاو", "گوسفند", "جوجه", "مرغ", "بز", "قوچ")),
            ("concentrate", "خوراک و کنسانتره", ("کنسانتره", "سویا", "ذرت‌دامی", "پولپ")),
            ("fodder", "یونجه و علوفه", ("یونجه", "علوفه", "کاه")),
        ],
    ),
)


def _haystack(*texts):
    """Lower-cased, space-padded text so a keyword can be matched at a word start."""
    return f" {' '.join((text or '').strip().lower() for text in texts)} "


def _hits(haystack, keywords):
    """Word-start matching: «جو» must not capture «جوجه»، «سم» not «سمبزه»."""
    return any(
        re.search(rf"(?<![\w\u0600-\u06FF]){re.escape(keyword.lower())}", haystack)
        for keyword in keywords
    )


def create_departments(apps, schema_editor):
    Category = apps.get_model("shop", "Category")
    SubCategory = apps.get_model("shop", "SubCategory")
    for slug, name, description, subcategories in DEPARTMENTS:
        category, _ = Category.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": description,
                "seo_title": f"{name} | بازار گرین کود"[:70],
                "seo_description": description[:170],
                "storefront_only": True,
            },
        )
        for sub_slug, sub_name, _keywords in subcategories:
            SubCategory.objects.update_or_create(
                slug=sub_slug,
                defaults={"name": sub_name, "category": category},
            )


def file_existing_ads(apps, schema_editor):
    """Give every unclassified ad a department, using the rules above."""
    Category = apps.get_model("shop", "Category")
    SubCategory = apps.get_model("shop", "SubCategory")
    MarketplaceListing = apps.get_model("shop", "MarketplaceListing")

    known = set(Category.objects.values_list("slug", flat=True))
    plan = [
        (slug, subcategories)
        for slug, _name, _description, subcategories in DEPARTMENTS
        if slug in known
    ]
    if not plan:
        return

    rows = list(MarketplaceListing.objects.filter(category__isnull=True).values("id", "title", "crop_name"))
    updates = []
    for row in rows:
        haystack = _haystack(row["title"], row["crop_name"])
        for slug, subcategories in plan:
            keywords = tuple(keyword for _sub, _label, sub_keywords in subcategories for keyword in sub_keywords)
            if not _hits(haystack, keywords):
                continue
            category = Category.objects.filter(slug=slug).first()
            subcategory = None
            for sub_slug, _label, sub_keywords in subcategories:
                if _hits(haystack, sub_keywords):
                    subcategory = SubCategory.objects.filter(slug=sub_slug).first()
                    break
            updates.append((row["id"], category.id if category else None, subcategory.id if subcategory else None))
            break

    for listing_id, category_id, subcategory_id in updates:
        if category_id is None:
            continue
        MarketplaceListing.objects.filter(pk=listing_id).update(
            category_id=category_id, subcategory_id=subcategory_id
        )


def unfile_ads(apps, schema_editor):
    Category = apps.get_model("shop", "Category")
    MarketplaceListing = apps.get_model("shop", "MarketplaceListing")
    slugs = [entry[0] for entry in DEPARTMENTS]
    MarketplaceListing.objects.filter(category__slug__in=slugs).update(category=None, subcategory=None)
    Category.objects.filter(slug__in=slugs).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0042_category_storefront_only_and_more"),
    ]

    operations = [
        migrations.RunPython(create_departments, migrations.RunPython.noop),
        migrations.RunPython(file_existing_ads, unfile_ads),
    ]
