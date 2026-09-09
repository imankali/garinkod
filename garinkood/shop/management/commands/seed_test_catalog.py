# -*- coding: utf-8 -*-
"""Seed a full test catalogue so every storefront section has products.

Development/QA only — never run in production. Idempotent: every row is
matched on its slug/code and updated in place, so rerunning after a data
edit fixes the existing records instead of duplicating them.

Usage (from ``garinkood/``)::

    python manage.py seed_test_catalog            # build everything
    python manage.py seed_test_catalog --clear    # remove the test fixture
    python manage.py seed_test_catalog --skip-marketplace   # catalogue only

What gets built (see ``shop/data/test_catalog.py``):

* 8 categories + 21 subcategories + 6 tags
* 35 products covering every section: fertilizer, pesticide, seed,
  seedling, tractors, implements, irrigation, tools, greenhouse — with
  featured / discounted / out-of-stock / unavailable / price-on-request /
  expiring-soon / multi-package variants
* domain profiles: shop detail tables + agri_inputs (Fertilizer, Pesticide,
  Seed, Seedling) + machinery (Tractor, Implement)
* reviews, a Q&A thread, a featured testimonial, one pending-moderation row
* coupons TEST10 / TESTFIX50 / TESTOLD + demo buyer ``test-buyer``
* the demo marketplace (storefronts + listings) via seed_demo_marketplace,
  unless --skip-marketplace is passed
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from shop.data.test_catalog import (
    TEST_BUYER_LOYALTY_POINTS,
    TEST_BUYER_PASSWORD,
    TEST_BUYER_USERNAME,
    TEST_CATEGORIES,
    TEST_COMMENTS,
    TEST_COUPONS,
    TEST_PRODUCTS,
    TEST_TAGS,
)
from shop.models import (
    Category,
    Comment,
    Coupon,
    EquipmentDetail,
    FertilizerDetail,
    PesticideDetail,
    Product,
    ProductAttribute,
    ProductPackage,
    SeedDetail,
    SubCategory,
    Tag,
    Wallet,
)

User = get_user_model()

SHOP_DETAIL_MODELS = {
    "fertilizer": FertilizerDetail,
    "pesticide": PesticideDetail,
    "seed": SeedDetail,
    "equipment": EquipmentDetail,
}


class Command(BaseCommand):
    help = "Seed the full test catalogue (dev/QA only, idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="حذف محصولات و کوپن‌های تستی (slug با test- و کد با TEST).",
        )
        parser.add_argument(
            "--skip-marketplace",
            action="store_true",
            help="نصب بازار غرفه‌داران (seed_demo_marketplace) انجام نشود.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["clear"]:
            self._clear()
            return

        today = timezone.localdate()
        author = self._get_author()
        categories = self._seed_categories()
        subcategories = self._seed_subcategories(categories)
        tags = self._seed_tags()

        created_products = 0
        for index, entry in enumerate(TEST_PRODUCTS):
            created_products += int(self._seed_product(
                entry, author, categories, subcategories, tags, today, index,
            ))

        reviews = self._seed_comments()
        coupons = self._seed_coupons()
        self._seed_buyer()

        if options["skip_marketplace"]:
            self.stdout.write("بازار غرفه‌داران رد شد (--skip-marketplace).")
        else:
            call_command("seed_demo_marketplace", verbosity=0)
            self.stdout.write("بازار نمونه (غرفه‌ها و آگهی‌ها) نصب/به‌روزرسانی شد.")

        published = Product.objects.filter(status="published").count()
        self.stdout.write(self.style.SUCCESS(
            f"کاتالوگ تستی آماده شد: {created_products} محصول جدید، "
            f"{reviews} نظر، {coupons} کوپن. "
            f"مجموع محصولات منتشرشده: {published}."
        ))

    # -- clear ------------------------------------------------------------
    def _clear(self):
        products = Product.objects.filter(slug__startswith="test-")
        product_count = products.count()
        products.delete()  # cascades: profiles, attributes, packages, comments
        coupons_deleted, _details = Coupon.objects.filter(code__startswith="TEST").delete()
        self.stdout.write(self.style.SUCCESS(
            f"{product_count} محصول تستی و {coupons_deleted} کوپن تستی حذف شد."
        ))

    # -- lookups ----------------------------------------------------------
    @staticmethod
    def _get_author():
        author, _ = User.objects.get_or_create(
            username="test-shop",
            defaults={"email": "test-shop@example.com", "first_name": "فروشگاه", "last_name": "تستی"},
        )
        return author

    def _seed_categories(self):
        categories = {}
        for entry in TEST_CATEGORIES:
            category, _ = Category.objects.update_or_create(
                slug=entry["slug"],
                defaults={
                    "name": entry["name"],
                    "description": entry.get("description", ""),
                },
            )
            categories[entry["slug"]] = category
        self.stdout.write(f"{len(categories)} دسته ساخته/به‌روزرسانی شد.")
        return categories

    @staticmethod
    def _seed_subcategories(categories):
        subcategories = {}
        for entry in TEST_CATEGORIES:
            for sub in entry.get("subcategories", []):
                subcategory, _ = SubCategory.objects.update_or_create(
                    slug=sub["slug"],
                    defaults={"name": sub["name"], "category": categories[entry["slug"]]},
                )
                subcategories[sub["slug"]] = subcategory
        return subcategories

    @staticmethod
    def _seed_tags():
        tags = {}
        for name in TEST_TAGS:
            tag, _ = Tag.objects.get_or_create(name=name)
            tags[name] = tag
        return tags

    # -- products ---------------------------------------------------------
    def _seed_product(self, entry, author, categories, subcategories, tags, today, index):
        expiry = entry.get("expiry_in_days")
        product, created = Product.objects.update_or_create(
            slug=entry["slug"],
            defaults={
                "author": author,
                "category": categories[entry["category"]],
                "subcategory": subcategories.get(entry.get("subcategory")),
                "title": entry["title"],
                "description": entry["description"],
                # Staggered publish dates keep the «جدیدترین» sort meaningful.
                "publish": timezone.now() - timedelta(days=index),
                "status": "published",
                "price": entry.get("price", 0),
                "stock": entry.get("stock", 0),
                "available": entry.get("available", True),
                "is_featured": entry.get("is_featured", False),
                "discount_percent": entry.get("discount_percent", 0),
                "sales_count": entry.get("sales_count", 0),
                "views": entry.get("views", 0),
                "brand": entry.get("brand", ""),
                "package_weight": entry.get("package_weight", ""),
                "price_on_request": entry.get("price_on_request", False),
                "sku": entry.get("sku", ""),
                "expiry_date": (today + timedelta(days=expiry)) if expiry is not None else None,
                "min_order_quantity": entry.get("min_order_quantity", 1),
                "bulk_note": entry.get("bulk_note", ""),
            },
        )
        product.tags.set(tags[name] for name in entry.get("tags", []) if name in tags)
        self._seed_attributes(product, entry.get("attributes", []))
        self._seed_packages(product, entry.get("packages", []))
        if "detail" in entry:
            kind, fields = entry["detail"]
            SHOP_DETAIL_MODELS[kind].objects.update_or_create(product=product, defaults=fields)
        if "agri" in entry:
            self._seed_agri_profile(product, entry["agri"], today)
        if "machine" in entry:
            self._seed_machine_profile(product, entry["machine"])
        return created

    @staticmethod
    def _seed_attributes(product, attributes):
        product.attributes.all().delete()
        for order, (label, value) in enumerate(attributes):
            ProductAttribute.objects.create(
                product=product, label=label, value=value, order=order,
            )

    @staticmethod
    def _seed_packages(product, packages):
        for order, package in enumerate(packages):
            ProductPackage.objects.update_or_create(
                product=product,
                label=package["label"],
                defaults={
                    "weight_kg": package.get("weight_kg"),
                    "price": package.get("price"),
                    "stock": package.get("stock"),
                    "is_default": package.get("is_default", False),
                    "order": order,
                },
            )

    @staticmethod
    def _seed_agri_profile(product, spec, today):
        # Local imports: the holding modules are optional neighbours of shop;
        # importing at call time keeps this command loadable even if one of
        # them is temporarily uninstalled.
        kind, fields = spec
        fields = dict(fields)
        expiry = fields.pop("expiry_in_days", None)
        if kind == "fertilizer":
            from agri_inputs.models import Fertilizer
            if expiry is not None:
                fields["expiry_date"] = today + timedelta(days=expiry)
            Fertilizer.objects.update_or_create(product=product, defaults=fields)
        elif kind == "pesticide":
            from agri_inputs.models import Pesticide
            if expiry is not None:
                fields["expiry_date"] = today + timedelta(days=expiry)
            Pesticide.objects.update_or_create(product=product, defaults=fields)
        elif kind == "seed":
            from agri_inputs.models import Seed
            Seed.objects.update_or_create(product=product, defaults=fields)
        elif kind == "seedling":
            from agri_inputs.models import Seedling
            Seedling.objects.update_or_create(product=product, defaults=fields)

    @staticmethod
    def _seed_machine_profile(product, spec):
        kind, fields = spec
        if kind == "tractor":
            from machinery.models import Tractor
            Tractor.objects.update_or_create(product=product, defaults=dict(fields))
        elif kind == "implement":
            from machinery.models import Implement
            Implement.objects.update_or_create(product=product, defaults=dict(fields))

    # -- comments ---------------------------------------------------------
    def _seed_comments(self):
        count = 0
        for entry in TEST_COMMENTS:
            try:
                product = Product.objects.get(slug=entry["product"])
            except Product.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f"محصول {entry['product']} یافت نشد؛ نظر رد شد."
                ))
                continue
            parent, parent_created = self._ensure_comment(product, entry, parent=None)
            count += int(parent_created)
            for reply in entry.get("replies", []):
                _, reply_created = self._ensure_comment(product, reply, parent=parent)
                count += int(reply_created)
        return count

    @staticmethod
    def _ensure_comment(product, entry, parent):
        """Return (comment, created). The row itself is always returned so a
        second run still finds the real parent for nested replies."""
        comment = Comment.objects.filter(
            product=product, parent=parent, name=entry["name"], body=entry["body"],
        ).first()
        if comment is not None:
            return comment, False
        comment = Comment.objects.create(
            product=product,
            parent=parent,
            name=entry["name"],
            body=entry["body"],
            rating=entry.get("rating"),
            helpful_count=entry.get("helpful_count", 0),
            is_featured=entry.get("is_featured", False),
            active=entry.get("active", True),
        )
        return comment, True

    # -- coupons + buyer --------------------------------------------------
    def _seed_coupons(self):
        now = timezone.now()
        count = 0
        for entry in TEST_COUPONS:
            _, created = Coupon.objects.update_or_create(
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
                    "valid_until": now + timedelta(days=entry.get("valid_days", 30)),
                },
            )
            count += int(created)
        # The expired coupon must stay expired: update_or_create above already
        # stamps valid_until in the past via valid_days=-1. Nothing else needed.
        return count

    def _seed_buyer(self):
        buyer, _ = User.objects.get_or_create(
            username=TEST_BUYER_USERNAME,
            defaults={"email": f"{TEST_BUYER_USERNAME}@example.com", "first_name": "خریدار", "last_name": "تستی"},
        )
        if not buyer.check_password(TEST_BUYER_PASSWORD):
            buyer.set_password(TEST_BUYER_PASSWORD)
            buyer.save(update_fields=["password"])
        wallet, _ = Wallet.objects.get_or_create(user=buyer)
        if wallet.loyalty_points < TEST_BUYER_LOYALTY_POINTS:
            wallet.loyalty_points = TEST_BUYER_LOYALTY_POINTS
            wallet.save(update_fields=["loyalty_points"])
        self.stdout.write(
            f"کاربر خریدار تستی «{TEST_BUYER_USERNAME}» با "
            f"{TEST_BUYER_LOYALTY_POINTS} امتیاز وفاداری آماده است."
        )
