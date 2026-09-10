"""Filing a marketplace ad under the catalogue's own taxonomy.

A seller types a crop name, not a category id. Before this module existed the
free text was all a filter could see, which is why the category chips on the
«آگهی‌های غرفه‌داران» tab could only ever be a decorative list: there was no
column to filter on. Rather than leave an ad unclassified when its author skips
the picker, the ad is filed by keyword — and an explicit choice from the seller
always wins, because a guess is a fallback, not a policy.

The rules are deliberately small and boring: one tuple of keywords per
department, first hit wins. No embeddings and no fuzzy libraries — a keyword a
support agent can read, test and fix from the admin is worth more than a
classifier nobody can explain.

``shop/migrations/0043_marketplace_departments.py`` carries a snapshot of the
produce rows below. Migrations must not import application code (these rules
will change under a replay), so the copy is intentional: the migration seeds the
departments and files the ads that existed at that moment, while this module
classifies everything from then on.
"""

from __future__ import annotations

import re

# (category slug, category keywords, ((subcategory slug, keywords), …))
#
# Order matters — the first department whose keyword appears wins. The warehouse's
# own departments come first so an input seller's ad is never filed as produce,
# and produce follows in the order the marketplace actually trades.
DEPARTMENT_RULES: tuple[tuple[str, tuple[str, ...], tuple[tuple[str, tuple[str, ...]], ...]], ...] = (
    (
        "pesticide",
        ("سموم", "سمپاشی", "حشره‌کش", "قارچ‌کش", "علف‌کش", "کنه‌کش", "سم", "مالاتیون", "دیازینون", "کنفیدور", "پیریفوس", "روتنون"),
        (
            ("insecticide", ("حشره‌کش", "مالاتیون", "دیازینون", "کنفیدور")),
            ("fungicide", ("قارچ‌کش", "بردوفیکس", "مانکوزب")),
            ("herbicide", ("علف‌کش", "گلایفوسیت")),
            ("miticide", ("کنه‌کش",)),
        ),
    ),
    (
        "fertilizer",
        ("کود", "هیومیک", "اوره", "سولفات", "نیتروجن", "فسفاته"),
        (
            ("npk", ("npk", "۲۰-۲۰-۲۰", "۱۲-۱۲-۳۶")),
            ("urea", ("اوره",)),
            ("humic", ("هیومیک", "هیومیت")),
            ("micronutrient", ("ریزمغذی", "کلات", "آهن", "روی")),
        ),
    ),
    (
        "seed",
        ("بذر", "نهال", "نهاد", "میزبان"),
        (
            ("vegetable-seed", ("صیفی", "گوجه", "خیار")),
            ("field-seed", ("گندم", "جو", "کلزا")),
            ("greenhouse-seed", ("گلخانه", "هیبرید")),
            ("sapling", ("نهال",)),
        ),
    ),
    ("irrigation", ("آبیاری", "قطره‌ای", "بارانی", "پمپ", "شیرآلات", "موتورپمپ", "نوار"), ()),
    ("equipment", ("ماشین", "تیلر", "تراکتور", "نیدوی저", "گاوآهن", "ادوات", "سمپاش"), ()),
    ("tools", ("قیچی", "هرس", "دستکش", "لباس کار", "بیل", "کلنگ", "فرغون"), ()),
    (
        "greenhouse-produce",
        ("گلخانه", "صیفی"),
        (
            ("tomato-cucumber", ("گوجه", "خیار")),
            ("berry", ("توت‌فرنگی", "توت فرنگی")),
            ("pepper-eggplant", ("فلفل", "بادمجان")),
        ),
    ),
    (
        "orchard",
        ("پرتقال", "لیمو", "بوکه‌ای", "نارنگی", "سیب", "گلابی", "هلو", "آلو", "گیلاس", "انگور", "خرما", "موز", "میوه"),
        (
            ("citrus", ("پرتقال", "لیمو", "بوکه‌ای", "نارنگی", "گریپ‌فروت")),
            ("stone-fruit", ("هلو", "آلو", "گیلاس", "آلبالو", "زردآلو", "شلیل", "سیب", "گلابی")),
            ("table-grape-date", ("انگور", "خرما", "موز")),
        ),
    ),
    (
        "nuts-dried",
        ("پسته", "بادام", "گردو", "فندق", "کشمش", "زعفران", "زرشک", "ادویه", "دارچین"),
        (
            ("pistachio-almond", ("پسته", "بادام", "گردو", "فندق")),
            ("saffron-spices", ("زعفران", "زرشک", "دارچین", "هل", "زردچوبه")),
            ("raisin-dried", ("کشمش", "توت خشک", "میوه خشک")),
        ),
    ),
    (
        "grain-pulse",
        ("گندم", "جو", "برنج", "ذرت", "سورگوم", "کلزا", "عدس", "نخود", "لوبیا", "حبوبات", "تریتیکاله"),
        (
            ("wheat-barley", ("گندم", "جو", "تریتیکاله", "چاودار")),
            ("rice-maize", ("برنج", "ذرت", "سورگوم")),
            ("pulses-oilseeds", ("عدس", "نخود", "لوبیا", "کلزا", "کنجد", "حبوبات")),
        ),
    ),
    (
        "livestock-feed",
        ("دامی", "جوجه", "مرغ", "گوساله", "بره", "گوسفند", "بز", "قوچ", "گاو", "کنسانتره", "یونجه", "علوفه", "خوراک دام"),
        (
            ("live-animal", ("گوساله", "بره", "گاو", "گوسفند", "جوجه", "مرغ", "بز")),
            ("concentrate", ("کنسانتره", "سویا", "پولپ", "جو‌دامی")),
            ("fodder", ("یونجه", "علوفه", "کاه")),
        ),
    ),
)

DEPARTMENT_KEYWORDS: dict[str, tuple[str, ...]] = {
    slug: keywords for slug, keywords, _subcategories in DEPARTMENT_RULES
}

SUBCATEGORY_KEYWORDS: dict[str, dict[str, tuple[str, ...]]] = {
    slug: {sub_slug: sub_keywords for sub_slug, sub_keywords in subcategories}
    for slug, _keywords, subcategories in DEPARTMENT_RULES
}

def _haystack(*texts: str) -> str:
    joined = ' '.join((text or '').strip().lower() for text in texts if text)
    return f' {joined} '


def _hits(haystack: str, keywords) -> bool:
    """Whole-word matching.

    `\w` already covers Persian letters, so «سم» never captures «سمبزه» or
    «سموم» — those have to be listed as keywords themselves, which is exactly
    what makes the table readable: a row either matches or it does not, and
    there is no threshold to argue about.
    """
    return any(
        re.search(rf'(?<!\w){re.escape(keyword.lower())}(?!\w)', haystack)
        for keyword in keywords
    )


def guess_category_slug(*texts: str) -> str | None:
    """The catalogue slug this text belongs to, or ``None`` when nothing matched.

    ``None`` is an honest answer: an ad nobody can place stays unfiled for a
    moderator instead of being dumped into the biggest bucket, where it would
    be found by the wrong buyer.
    """
    haystack = _haystack(*texts)
    if not haystack.strip():
        return None
    for slug, keywords in DEPARTMENT_KEYWORDS.items():
        if _hits(haystack, keywords):
            return slug
    return None


def guess_subcategory_slug(category_slug: str, *texts: str) -> str | None:
    haystack = _haystack(*texts)
    for sub_slug, keywords in SUBCATEGORY_KEYWORDS.get(category_slug, {}).items():
        if _hits(haystack, keywords):
            return sub_slug
    return None


def classify(*texts: str):
    """Resolve the guessed department to ``(category, subcategory)`` instances.

    A subcategory is only claimed when it is a genuine child of the category we
    landed on, so a renamed or moved row can never point an ad into another
    department.
    """
    from .models import Category, SubCategory

    slug = guess_category_slug(*texts)
    if not slug:
        return None, None
    category = Category.objects.filter(slug=slug).first()
    if category is None:
        return None, None
    sub_slug = guess_subcategory_slug(slug, *texts)
    subcategory = (
        SubCategory.objects.filter(slug=sub_slug, category=category).first() if sub_slug else None
    )
    return category, subcategory
