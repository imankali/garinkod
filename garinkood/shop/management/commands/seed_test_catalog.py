# -*- coding: utf-8 -*-
"""Seed a full test catalogue: every shop section with realistic products.

Development/testing convenience only — never run on production data without a
backup. Everything is matched on its slug and updated in place, so re-running
after editing ``shop/data/test_catalog.py`` fixes the existing rows instead of
duplicating them.

Usage (from ``garinkood/``)::

    python manage.py seed_test_catalog
    python manage.py seed_test_catalog --skip-images
    python manage.py seed_test_catalog --author myuser

What it creates:
  * 6 categories + 24 subcategories (slugs match the storefront MegaMenu)
  * 8 usage tags
  * 32 products (5 per category, 7 in equipment) with Persian titles, brands,
    prices, discounts, spec tables, packages, detail rows and reviews
  * linked agri_inputs/machinery profiles so /api/inputs/* and /api/machinery/*
    also serve test data
  * placeholder cover + gallery images (generated locally with Pillow, no
    network needed) unless --skip-images is passed
  * 2 test coupons (TEST10, WELCOME50) for checkout testing

After seeding, run the background worker once so the responsive AVIF/WebP
variants are generated for the new images::

    python manage.py process_async_tasks --limit 200
"""

from __future__ import annotations

import io
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from shop.data.test_catalog import TEST_CATEGORIES, TEST_COUPONS, TEST_PRODUCTS, TEST_TAGS
from shop.models import (
    Category,
    Comment,
    Coupon,
    EquipmentDetail,
    FertilizerDetail,
    PesticideDetail,
    Product,
    ProductAttribute,
    ProductImage,
    ProductPackage,
    SeedDetail,
    SubCategory,
    Tag,
)

# One recognisable colour per section, reused for the generated placeholders.
CATEGORY_COLOURS = {
    "pesticide": (15, 138, 95),    # green
    "fertilizer": (16, 185, 129),  # emerald
    "seed": (245, 158, 11),        # amber
    "equipment": (101, 163, 13),   # lime
    "irrigation": (14, 165, 233),  # sky
    "tools": (20, 184, 166),       # teal
}

DETAIL_MODELS = {
    "fertilizer": FertilizerDetail,
    "pesticide": PesticideDetail,
    "seed": SeedDetail,
    "equipment": EquipmentDetail,
}


def make_placeholder_image(slug: str, colour: tuple[int, int, int], shade: int = 0) -> bytes:
    """Render a small branded JPEG placeholder with Pillow (no network).

    Persian text is deliberately *not* drawn: the default bitmap font has no
    Persian glyphs, and shipping a font file for test data is not worth it.
    The ASCII slug keeps every image identifiable in the admin and on disk.
    """
    from PIL import Image, ImageDraw

    width, height = 800, 600
    darken = max(0, min(shade, 2)) * 28
    base = tuple(max(0, c - darken) for c in colour)
    img = Image.new("RGB", (width, height), base)
    draw = ImageDraw.Draw(img)

    # Diagonal stripes for a bit of texture.
    stripe = tuple(max(0, c - 18) for c in base)
    for x in range(-height, width, 56):
        draw.polygon([(x, 0), (x + 26, 0), (x + 26 + height, height), (x + height, height)], fill=stripe)

    # White frame.
    draw.rectangle([14, 14, width - 15, height - 15], outline=(255, 255, 255), width=5)

    # Centered ASCII labels.
    title = "GARINKOOD TEST CATALOG"
    label = slug[:34]
    sub = f"{width}x{height} PLACEHOLDER"
    for i, text in enumerate((title, label, sub)):
        w = draw.textlength(text)
        draw.text(((width - w) / 2, height / 2 - 30 + i * 34), text, fill=(255, 255, 255))

    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=82)
    return buf.getvalue()


class Command(BaseCommand):
    help = "Seed every shop section with realistic Persian test products."

    def add_arguments(self, parser):
        parser.add_argument(
            "--author",
            default="",
            help="نام کاربری نویسنده محصولات (پیش‌فرض: اولین کاربر staff، وگرنه test-seller ساخته می‌شود)",
        )
        parser.add_argument(
            "--skip-images",
            action="store_true",
            help="بدون ساخت تصویر تستی (محصولات با تصویر پیش‌فرض سایت نمایش داده می‌شوند)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        today = timezone.localdate()
        now = timezone.now()
        author = self._resolve_author(options["author"])
        with_images = not options["skip_images"]

        categories = self._seed_categories()
        subcategories = self._seed_subcategories(categories)
        tags = self._seed_tags()

        created = updated = 0
        for index, entry in enumerate(TEST_PRODUCTS):
            was_created = self._seed_product(
                entry, index, author, categories, subcategories, tags,
                today=today, now=now, with_images=with_images,
            )
            created += int(was_created)
            updated += int(not was_created)

        coupons = self._seed_coupons(now)
        self._print_summary(categories, created, updated, coupons, with_images)

    # -- lookups ---------------------------------------------------------
    @staticmethod
    def _resolve_author(username: str) -> User:
        if username:
            user, _ = User.objects.get_or_create(
                username=username, defaults={"email": f"{username}@example.com"}
            )
            return user
        staff = User.objects.filter(is_staff=True).order_by("id").first()
        if staff:
            return staff
        user, _ = User.objects.get_or_create(
            username="test-seller",
            defaults={"email": "test-seller@example.com", "first_name": "فروشنده", "last_name": "تستی"},
        )
        return user

    # -- categories / tags ----------------------------------------------
    def _seed_categories(self) -> dict[str, Category]:
        categories: dict[str, Category] = {}
        for entry in TEST_CATEGORIES:
            category, _ = Category.objects.update_or_create(
                slug=entry["slug"],
                defaults={
                    "name": entry["name"],
                    "description": entry.get("description", ""),
                    "seo_title": f'خرید {entry["name"]} | قیمت و مشخصات',
                    "seo_description": entry.get("description", "")[:160],
                },
            )
            categories[entry["slug"]] = category
        return categories

    @staticmethod
    def _seed_subcategories(categories: dict[str, Category]) -> dict[str, SubCategory]:
        subcategories: dict[str, SubCategory] = {}
        for entry in TEST_CATEGORIES:
            for sub in entry["subcategories"]:
                obj, _ = SubCategory.objects.update_or_create(
                    slug=sub["slug"],
                    defaults={"name": sub["name"], "category": categories[entry["slug"]]},
                )
                subcategories[sub["slug"]] = obj
        return subcategories

    @staticmethod
    def _seed_tags() -> dict[str, Tag]:
        tags: dict[str, Tag] = {}
        for entry in TEST_TAGS:
            tag, _ = Tag.objects.update_or_create(
                slug=entry["slug"],
                defaults={"name": entry["name"], "description": entry.get("description", "")},
            )
            tags[entry["slug"]] = tag
        return tags

    # -- products --------------------------------------------------------
    def _seed_product(self, entry, index, author, categories, subcategories, tags,
                      *, today, now, with_images: bool) -> bool:
        category = categories[entry["category"]]
        subcategory = subcategories.get(entry.get("subcategory", ""))

        production_date = None
        if entry.get("production_days_ago") is not None:
            production_date = today - timedelta(days=entry["production_days_ago"])
        expiry_date = None
        if entry.get("expiry_in_days") is not None:
            expiry_date = today + timedelta(days=entry["expiry_in_days"])

        # Stagger publish dates so «جدیدترین» ordering is deterministic.
        publish = now - timedelta(hours=index * 6)

        defaults = {
            "category": category,
            "subcategory": subcategory,
            "author": author,
            "title": entry["title"],
            "description": entry["description"],
            "publish": publish,
            "status": "published",
            "price": entry["price"],
            "stock": entry.get("stock", 0),
            "available": entry.get("available", True),
            "is_featured": entry.get("is_featured", False),
            "discount_percent": entry.get("discount_percent", 0),
            "sales_count": entry.get("sales_count", 0),
            "brand": entry.get("brand", ""),
            "package_weight": entry.get("package_weight", ""),
            "price_on_request": entry.get("price_on_request", False),
            "sku": entry.get("sku", ""),
            "views": entry.get("views", 0),
            "min_order_quantity": entry.get("min_order_quantity", 1),
            "bulk_note": entry.get("bulk_note", ""),
            "video_url": entry.get("video_url", ""),
            "production_date": production_date,
            "expiry_date": expiry_date,
            "seo_title": f'خرید {entry["title"]} | قیمت روز',
            "seo_description": entry["description"][:160],
        }
        product, created = Product.objects.update_or_create(slug=entry["slug"], defaults=defaults)

        # Tags (M2M): the seed owns the full set.
        product.tags.set(tags[slug] for slug in entry.get("tags", []) if slug in tags)

        # Category-specific detail row.
        detail = entry.get("detail")
        if detail:
            kind = detail["kind"]
            model = DETAIL_MODELS[kind]
            fields = {key: value for key, value in detail.items() if key != "kind"}
            model.objects.update_or_create(product=product, defaults=fields)

        # Holding-module profiles (optional one-to-one rows).
        agri = entry.get("agri")
        if agri:
            self._seed_agri_profile(product, agri, today)
        machine = entry.get("machine")
        if machine:
            self._seed_machine_profile(product, machine)

        # Spec table: rewrite so removed rows disappear on re-seed.
        product.attributes.all().delete()
        attributes = [
            ProductAttribute(product=product, label=label, value=value, order=order)
            for order, (label, value) in enumerate(entry.get("attributes", []))
        ]
        if attributes:
            ProductAttribute.objects.bulk_create(attributes)

        # Packages: matched on (product, label) — the model's own constraint.
        for order, package in enumerate(entry.get("packages", [])):
            ProductPackage.objects.update_or_create(
                product=product,
                label=package["label"],
                defaults={
                    "weight_kg": package.get("weight_kg"),
                    "price": package.get("price"),
                    "stock": package.get("stock"),
                    "is_default": package.get("is_default", False),
                    "min_order_quantity": package.get("min_order_quantity", 1),
                    "order": order,
                },
            )

        # Reviews: matched on (product, name, body) so re-seeds never duplicate.
        for review in entry.get("reviews", []):
            Comment.objects.update_or_create(
                product=product,
                name=review["name"],
                body=review["body"],
                defaults={
                    "rating": review.get("rating"),
                    "helpful_count": review.get("helpful_count", 0),
                    "is_featured": review.get("is_featured", False),
                    "active": True,
                },
            )

        # Cover + gallery placeholders (only when missing — never churn files).
        if with_images:
            self._ensure_images(product, entry)

        return created

    @staticmethod
    def _ensure_images(product: Product, entry: dict) -> None:
        colour = CATEGORY_COLOURS.get(entry["category"], (15, 138, 95))
        if not product.image:
            blob = make_placeholder_image(product.slug, colour)
            product.image.save(f"test/{product.slug}.jpg", ContentFile(blob), save=True)
        for order, caption in enumerate(entry.get("gallery", []), start=1):
            exists = ProductImage.objects.filter(product=product, caption=caption).exists()
            if not exists:
                blob = make_placeholder_image(f"{product.slug}-g{order}", colour, shade=order)
                shot = ProductImage(product=product, caption=caption, order=order)
                shot.image.save(f"test/{product.slug}-g{order}.jpg", ContentFile(blob), save=True)

    # -- holding-module profiles -------------------------------------------
    @staticmethod
    def _seed_agri_profile(product: Product, spec: dict, today) -> None:
        """One-to-one agri_inputs row so /api/inputs/* has test data.

        Fertiliser/pesticide expiry falls back to the product's own expiry
        when the spec does not declare its own relative date.
        """
        kind = spec["kind"]
        if spec.get("expiry_in_days") is not None:
            expiry = today + timedelta(days=spec["expiry_in_days"])
        else:
            expiry = product.expiry_date
        if kind == "fertilizer":
            from agri_inputs.models import Fertilizer

            Fertilizer.objects.update_or_create(
                product=product,
                defaults={
                    "registration_number": spec["registration_number"],
                    "active_ingredient": spec["active_ingredient"],
                    "npk_ratio": spec["npk_ratio"],
                    "expiry_date": expiry,
                },
            )
        elif kind == "pesticide":
            from agri_inputs.models import Pesticide

            Pesticide.objects.update_or_create(
                product=product,
                defaults={
                    "registration_number": spec["registration_number"],
                    "target_pest": spec["target_pest"],
                    "toxicity_level": spec.get("toxicity_level", "medium"),
                    "waiting_period": spec["waiting_period"],
                    "expiry_date": expiry,
                },
            )
        elif kind == "seed":
            from agri_inputs.models import Seed

            Seed.objects.update_or_create(
                product=product,
                defaults={
                    "germination_rate": spec["germination_rate"],
                    "planting_season": spec.get("planting_season", "spring"),
                    "seed_treatment": spec.get("seed_treatment", False),
                    "variety_name": spec["variety_name"],
                },
            )
        elif kind == "seedling":
            from agri_inputs.models import Seedling

            Seedling.objects.update_or_create(
                product=product,
                defaults={
                    "rootstock": spec["rootstock"],
                    "scion_variety": spec["scion_variety"],
                    "age_years": spec["age_years"],
                    "height_cm": spec["height_cm"],
                },
            )

    @staticmethod
    def _seed_machine_profile(product: Product, spec: dict) -> None:
        """One-to-one machinery row so /api/machinery/* has test data."""
        kind = spec["kind"]
        if kind == "tractor":
            from machinery.models import Tractor

            Tractor.objects.update_or_create(
                product=product,
                defaults={
                    "horsepower": spec["horsepower"],
                    "manufacture_year": spec["manufacture_year"],
                    "working_hours": spec.get("working_hours", 0),
                    "warranty_months": spec.get("warranty_months", 0),
                    "is_second_hand": spec.get("is_second_hand", False),
                },
            )
        elif kind == "implement":
            from machinery.models import Implement

            Implement.objects.update_or_create(
                product=product,
                defaults={
                    "implement_type": spec["implement_type"],
                    "working_width": spec["working_width"],
                    "compatible_tractors": spec.get("compatible_tractors", ""),
                    "warranty_months": spec.get("warranty_months", 0),
                },
            )

    # -- coupons ---------------------------------------------------------
    @staticmethod
    def _seed_coupons(now) -> list[Coupon]:
        coupons = []
        for entry in TEST_COUPONS:
            coupon, _ = Coupon.objects.update_or_create(
                code=entry["code"],
                defaults={
                    "description": entry["description"],
                    "discount_type": entry["discount_type"],
                    "discount_value": entry["discount_value"],
                    "max_discount_amount": entry.get("max_discount_amount"),
                    "min_order_amount": entry.get("min_order_amount", 0),
                    "usage_limit": entry.get("usage_limit"),
                    "is_active": True,
                    "valid_from": now - timedelta(days=1),
                    "valid_until": now + timedelta(days=90),
                },
            )
            coupons.append(coupon)
        return coupons

    # -- report ----------------------------------------------------------
    def _print_summary(self, categories, created, updated, coupons, with_images: bool) -> None:
        self.stdout.write(self.style.SUCCESS(
            f'کاتالوگ تستی آماده شد: {created} محصول جدید، {updated} محصول به‌روزرسانی شد '
            f'(مجموع منتشرشده: {Product.objects.filter(status="published").count()}).'
        ))
        for slug, category in categories.items():
            count = category.get_product_count()
            self.stdout.write(f'  • {category.name} ({slug}): {count} محصول')
        self.stdout.write('کدهای تخفیف تستی: ' + '، '.join(coupon.code for coupon in coupons))
        if with_images:
            self.stdout.write(self.style.WARNING(
                'برای ساخت نسخه‌های بهینه تصاویر (AVIF/WebP) یک‌بار ورکر را اجرا کنید:\n'
                '  python manage.py process_async_tasks --limit 200'
            ))
