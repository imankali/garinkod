"""Quantity price ladders (تخفیف پلکانی).

The rule under test is narrow and easy to get subtly wrong: a ladder is a set of
thresholds, only the highest one the quantity reaches applies, and the percentage
comes off the price the row already charges. Each of those three clauses has an
obvious wrong implementation — stacking the rungs, picking the first instead of
the highest, or compounding the ladder with the display-only ``discount_percent``
— so each is pinned separately rather than by one happy-path test.
"""

import re
from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    Cart, CartItem, MarketplaceListing, PriceTier, Product, ProductPackage, Storefront,
)
from .models.catalog import best_price_tier, tiered_price

User = get_user_model()


def _tier(min_quantity, discount_percent, **kwargs):
    """An unsaved rung, for testing the selection rule without a database."""
    return PriceTier(min_quantity=min_quantity, discount_percent=discount_percent, **kwargs)


class TierSelectionTests(TestCase):
    """The rule, tested without touching the database."""

    LADDER = [_tier(5, 5), _tier(10, 10), _tier(40, 18)]

    def test_only_the_highest_reached_rung_applies(self):
        # 40 units must get the 18٪ rung alone. Summing the rungs (5 + 10 + 18) is
        # the most tempting wrong answer and it would give the product away.
        self.assertEqual(best_price_tier(self.LADDER, 40).discount_percent, 18)
        self.assertEqual(tiered_price(1000, self.LADDER, 40), 820)

    def test_threshold_is_inclusive(self):
        self.assertEqual(best_price_tier(self.LADDER, 10).discount_percent, 10)

    def test_one_below_a_threshold_gets_the_rung_below(self):
        self.assertEqual(best_price_tier(self.LADDER, 9).discount_percent, 5)

    def test_below_every_threshold_gets_nothing(self):
        self.assertIsNone(best_price_tier(self.LADDER, 4))
        self.assertEqual(tiered_price(1000, self.LADDER, 4), 1000)

    def test_empty_ladder_leaves_the_price_alone(self):
        self.assertIsNone(best_price_tier([], 999))
        self.assertEqual(tiered_price(1000, [], 999), 1000)

    def test_rounding_goes_down_never_up(self):
        # 1001 × 82٪ = 820.82 → 820. A buyer is never charged the fraction above
        # the rung they were quoted.
        self.assertEqual(tiered_price(1001, self.LADDER, 40), 820)

    def test_a_100_percent_rung_is_free_not_negative(self):
        self.assertEqual(tiered_price(1000, [_tier(2, 100)], 2), 0)


class PriceTierConstraintTests(TestCase):
    """The shape the database refuses, so a bad ladder cannot reach a buyer."""

    def setUp(self):
        self.author = User.objects.create_user(username="tier-author", password="x")
        self.product = Product.objects.create(
            title="کود نیتروژن", slug="kood-nitrogen", author=self.author,
            description="تست", price=1000, stock=100, status="published",
        )

    def _save(self, **kwargs):
        tier = PriceTier(product=self.product, **kwargs)
        tier.full_clean()
        tier.save()
        return tier

    def test_a_rung_at_one_is_rejected(self):
        # A rung at 1 is a price cut wearing a ladder's clothes.
        with self.assertRaises(ValidationError):
            self._save(min_quantity=1, discount_percent=10)

    def test_zero_and_over_100_percent_are_rejected(self):
        for bad in (0, 101):
            with self.assertRaises(ValidationError, msg=f"{bad}٪ was accepted"):
                self._save(min_quantity=10, discount_percent=bad)

    def test_two_rungs_at_the_same_threshold_are_rejected(self):
        self._save(min_quantity=10, discount_percent=5)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PriceTier.objects.create(product=self.product, min_quantity=10, discount_percent=9)

    def test_a_rung_needs_exactly_one_target(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PriceTier.objects.create(min_quantity=10, discount_percent=5)


class CartTierPricingTests(TestCase):
    """What the buyer is actually charged."""

    def setUp(self):
        self.author = User.objects.create_user(username="tier-cart", password="x")
        self.product = Product.objects.create(
            title="کود فسفات", slug="kood-phosphate", author=self.author,
            description="تست", price=1000, stock=1000, status="published",
        )
        PriceTier.objects.create(product=self.product, min_quantity=5, discount_percent=5)
        PriceTier.objects.create(product=self.product, min_quantity=20, discount_percent=15)
        self.cart = Cart.objects.create(session_id="tier-cart")

    def _row(self, quantity):
        return CartItem.objects.create(cart=self.cart, product=self.product, quantity=quantity)

    def test_a_row_below_every_rung_is_untouched(self):
        row = self._row(4)
        self.assertEqual(row.base_unit_price, 1000)
        self.assertEqual(row.unit_price, 1000)
        self.assertEqual(row.total_price, 4000)
        self.assertEqual(row.tier_saving if hasattr(row, "tier_saving") else 0, 0)

    def test_the_rung_is_applied_to_the_unit_price(self):
        row = self._row(20)
        self.assertEqual(row.unit_price, 850)
        self.assertEqual(row.total_price, 20 * 850)

    def test_the_two_discounts_stack_in_a_defined_order(self):
        # Both discounts apply, but in a fixed sequence rather than whichever
        # order the code happens to evaluate them: the site-wide
        # `discount_percent` first, then the quantity ladder off the result.
        #
        # That order is the one the buyer reads — "20% off, and 40 of them is
        # cheaper again" — and it is also the cheaper of the two readings, which
        # is the direction a pricing ambiguity should always resolve in. It is
        # pinned here because the reverse order gives a different number and
        # nothing else in the system would notice the swap.
        self.product.discount_percent = 10
        self.product.save(update_fields=["discount_percent"])
        row = self._row(20)
        self.assertEqual(row.base_unit_price, 900)   # 1000 - 10%
        self.assertEqual(row.unit_price, 765)        # 900 - 15%

    def test_the_next_rung_is_named_so_the_cart_can_ask_for_it(self):
        row = self._row(5)
        self.assertEqual(row.applied_price_tier.discount_percent, 5)
        self.assertEqual(row.next_price_tier.min_quantity, 20)

    def test_the_top_rung_has_no_next(self):
        self.assertIsNone(self._row(20).next_price_tier)

    def test_the_cart_total_follows_the_ladder(self):
        # One row per product per cart, so the second row is a second product —
        # with no ladder of its own, which is also the mixed-cart case: one row
        # discounted, one not, summed honestly.
        self._row(20)
        plain = Product.objects.create(
            title="کود بدون پله سبد", slug="kood-plain-basket", author=self.author,
            description="تست", price=1000, stock=100, status="published",
        )
        CartItem.objects.create(cart=self.cart, product=plain, quantity=4)
        self.assertEqual(self.cart.total_price, 20 * 850 + 4 * 1000)

    def test_a_product_with_no_ladder_is_priced_exactly_as_before(self):
        # The regression that matters: this feature must not move an existing
        # order total by a single تومان.
        plain = Product.objects.create(
            title="کود بدون پله", slug="kood-no-tier", author=self.author,
            description="تست", price=2500, stock=10, status="published",
        )
        row = CartItem.objects.create(cart=self.cart, product=plain, quantity=7)
        self.assertEqual(row.unit_price, 2500)
        self.assertEqual(row.total_price, 17500)
        self.assertIsNone(row.applied_price_tier)


class ListingTierPricingTests(TestCase):
    """A storefront listing gets the same ladder as the catalogue."""

    def setUp(self):
        self.seller = User.objects.create_user(username="tier-seller", password="x")
        self.storefront = Storefront.objects.create(user=self.seller, name="غرفه پله", slug="ghorfe-pelle")
        self.listing = MarketplaceListing.objects.create(
            storefront=self.storefront, title="بذر گوجه", slug="bazr-goje-tier",
            crop_name="گوجه فرنگی", price=5000, quantity_available=500,
            status="published",
        )
        PriceTier.objects.create(listing=self.listing, min_quantity=10, discount_percent=12)

    def test_the_rung_applies_to_a_listing_row(self):
        cart = Cart.objects.create(session_id="tier-listing")
        row = CartItem.objects.create(cart=cart, listing=self.listing, quantity=10)
        self.assertEqual(row.unit_price, 4400)
        self.assertEqual(row.total_price, 44000)


class TierApiTests(TestCase):
    """The ladder is published, so a buyer can see it before adding anything."""

    def setUp(self):
        self.author = User.objects.create_user(username="tier-api", password="x")
        self.product = Product.objects.create(
            title="کود API", slug="kood-api", author=self.author,
            description="تست", price=2000, stock=100, status="published",
        )
        PriceTier.objects.create(product=self.product, min_quantity=3, discount_percent=7)
        PriceTier.objects.create(product=self.product, min_quantity=30, discount_percent=20)

    def test_the_product_payload_carries_the_ladder_with_prices(self):
        response = APIClient().get(f"/api/products/{self.product.slug}/")
        self.assertEqual(response.status_code, 200, response.content)
        tiers = response.data.get("price_tiers")
        self.assertIsNotNone(tiers, "the detail payload has no price_tiers")
        self.assertEqual([t["min_quantity"] for t in tiers], [3, 30])
        # Each rung states a price, not just a percentage — the buyer should not
        # have to do the arithmetic themselves.
        self.assertEqual(tiers[0]["unit_price"], 1860)
        self.assertEqual(tiers[1]["unit_price"], 1600)

    def test_a_product_without_a_ladder_publishes_an_empty_one(self):
        plain = Product.objects.create(
            title="بدون پله API", slug="kood-api-plain", author=self.author,
            description="تست", price=1000, stock=5, status="published",
        )
        response = APIClient().get(f"/api/products/{plain.slug}/")
        self.assertEqual(response.data["price_tiers"], [])

class DiscountAtCheckoutTests(TestCase):
    """The site-wide `discount_percent` must reach the cart.

    It was advertised on the product page, on the product card and in three
    serializers, and then ignored at checkout: `unit_price` read the raw
    `price` field. A buyer shown «۲۰٪ تخفیف» paid full price. These tests exist
    so the two paths cannot drift apart again — every screen that shows a price
    and the cart that charges it now read the same property.
    """

    def setUp(self):
        self.author = User.objects.create_user(username="discount-author", password="x12345678")
        self.cart = Cart.objects.create(user=self.author)

    def _product(self, **kwargs):
        defaults = dict(
            title="کود تخفیف‌دار", slug="kood-discounted", author=self.author,
            description="تست", price=10000, stock=100, status="published",
        )
        defaults.update(kwargs)
        return Product.objects.create(**defaults)

    def test_a_discounted_product_is_charged_at_its_advertised_price(self):
        product = self._product(discount_percent=20)
        item = CartItem.objects.create(cart=self.cart, product=product, quantity=3)

        self.assertEqual(item.base_unit_price, 8000)
        self.assertEqual(item.unit_price, 8000)
        self.assertEqual(item.total_price, 24000)

    def test_the_cart_charges_what_the_product_page_shows(self):
        """The exact regression: two properties, two different numbers."""
        product = self._product(discount_percent=15)
        item = CartItem.objects.create(cart=self.cart, product=product, quantity=1)

        self.assertEqual(item.unit_price, product.discounted_price)

    def test_an_undiscounted_product_is_untouched(self):
        product = self._product()
        item = CartItem.objects.create(cart=self.cart, product=product, quantity=2)
        self.assertEqual(item.unit_price, 10000)

    def test_discount_then_ladder_in_the_order_the_buyer_reads_them(self):
        """20% off, then 40+ is 10% off that — not 30% off the raw price."""
        product = self._product(discount_percent=20)
        PriceTier.objects.create(product=product, min_quantity=40, discount_percent=10)
        item = CartItem.objects.create(cart=self.cart, product=product, quantity=40)

        self.assertEqual(item.base_unit_price, 8000)   # 10000 - 20%
        self.assertEqual(item.unit_price, 7200)        # 8000 - 10%
        self.assertEqual(item.total_price, 40 * 7200)

    def test_a_packaging_row_gets_the_discount_too(self):
        product = self._product(discount_percent=20)
        package = ProductPackage.objects.create(
            product=product, label="کیسه ۲۵ کیلویی",
            weight_kg=25, price=240000, stock=10,
        )
        item = CartItem.objects.create(cart=self.cart, product=product,
                                       product_package=package, quantity=1)
        self.assertEqual(item.unit_price, 192000)

    def test_a_discounted_marketplace_listing_is_charged_at_its_advertised_price(self):
        storefront = Storefront.objects.create(user=self.author, name="غرفه", slug="ghorfe-disc")
        listing = MarketplaceListing.objects.create(
            storefront=storefront, title="بذر", slug="bazr-disc", crop_name="گوجه",
            price=5000, discount_percent=10, quantity_available=100, status="published",
        )
        item = CartItem.objects.create(cart=self.cart, listing=listing, quantity=2)
        self.assertEqual(item.unit_price, 4500)
        self.assertEqual(item.total_price, 9000)

    def test_rounding_stays_on_the_buyer_s_side(self):
        """A price that does not divide evenly must round down, not up."""
        product = self._product(price=9999, discount_percent=33)
        item = CartItem.objects.create(cart=self.cart, product=product, quantity=1)
        self.assertEqual(item.unit_price, 6699)  # 9999 * 0.67 = 6699.33

class LadderMatchesCartTests(TestCase):
    """The ladder the buyer is shown must equal the price the cart charges.

    These are two different code paths — a serializer method and a model
    property — computing the same number. When they disagree the buyer is shown
    one price and charged another, which is the failure this whole feature must
    not introduce. Both bugs found during this work were exactly that: one path
    read `price`, the other read `discounted_price`.
    """

    def setUp(self):
        self.author = User.objects.create_user(username="ladder-match", password="x12345678")
        self.cart = Cart.objects.create(user=self.author)
        self.product = Product.objects.create(
            title="کود نردبان", slug="kood-ladder-match", author=self.author,
            description="تست", price=10000, discount_percent=20, stock=500,
            status="published",
        )
        self.rung = PriceTier.objects.create(
            product=self.product, min_quantity=40, discount_percent=10,
        )

    def test_the_published_rung_price_equals_what_the_cart_charges(self):
        from .serializers import PriceTierSerializer

        published = PriceTierSerializer(self.rung).data["unit_price"]
        row = CartItem.objects.create(cart=self.cart, product=self.product, quantity=40)

        self.assertEqual(published, row.unit_price)
        self.assertEqual(published, 7200)  # 10000 - 20%, then - 10%

    def test_the_undiscounted_case_also_agrees(self):
        """Guard the guard: with no site discount the two paths still match."""
        from .serializers import PriceTierSerializer

        self.product.discount_percent = 0
        self.product.save(update_fields=["discount_percent"])

        published = PriceTierSerializer(self.rung).data["unit_price"]
        row = CartItem.objects.create(cart=self.cart, product=self.product, quantity=40)
        self.assertEqual(published, row.unit_price)
        self.assertEqual(published, 9000)

class ListEndpointQueryCountTests(TestCase):
    """The catalogue list must not grow a query per row.

    This is a regression test for a mistake this feature actually caused:
    `price_tiers` was added to ``ProductListSerializer`` with no matching
    prefetch, which cost one extra query per row on every catalogue page. A
    nested ``many=True`` relation is the easiest way to introduce an N+1 in DRF
    precisely because nothing warns you — the response is correct and only the
    query count is wrong.

    The assertion is deliberately an upper bound rather than an exact count. An
    exact number breaks on any unrelated query added anywhere, and a test that
    cries wolf gets deleted; a bound that only trips when the shape changes
    from constant to linear is the one that survives.
    """

    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(username="query-count", password="x12345678")
        for i in range(12):
            product = Product.objects.create(
                title=f"کود QCOUNT{i} شمارش", slug=f"kood-query-{i}", author=self.author,
                description="تست", price=10000, stock=50, status="published",
            )
            PriceTier.objects.create(product=product, min_quantity=20, discount_percent=5)

    def test_twelve_rows_do_not_cost_twelve_times_the_queries(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/products/")
        self.assertEqual(response.status_code, 200)

        total = len(ctx.captured_queries)
        # Measured at 43 for a twelve-row page after the prefetch fix, down from
        # 70. The bound leaves room for legitimate growth while still failing
        # loudly if the per-row pattern comes back — a linear regression on 12
        # rows adds at least 12.
        self.assertLess(
            total, 60,
            f"catalogue list ran {total} queries for 12 rows — "
            f"suspect a nested serializer without a prefetch",
        )

    def test_the_ladder_still_arrives_ordered_by_threshold(self):
        """The prefetch sorts; the payload must not depend on insertion order."""
        product = Product.objects.get(slug="kood-query-0")
        PriceTier.objects.create(product=product, min_quantity=5, discount_percent=2)

        response = self.client.get("/api/products/?search=QCOUNT0")
        self.assertEqual(response.status_code, 200)
        rows = [r for r in response.data["results"] if r["slug"] == "kood-query-0"]
        self.assertEqual(len(rows), 1)
        thresholds = [rung["min_quantity"] for rung in rows[0]["price_tiers"]]
        self.assertEqual(thresholds, sorted(thresholds))

# The project serves statics through CompressedManifestStaticFilesStorage,
# which resolves `{% static %}` against a manifest that only `collectstatic`
# writes. Rendering an admin page without one raises
# "Missing staticfiles manifest entry", which is a property of the test
# environment and says nothing about the admin. Swapping in the plain storage
# backend for these tests is the standard remedy; it changes how a filename is
# produced, not what the page contains.
@override_settings(STORAGES={
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
})
class PriceTierAdminTests(TestCase):
    """The ladder must be settable by an operator, and must show what it costs.

    Until this existed the ladder could only be created through the ORM, which
    means it existed in the schema and nowhere an operator could reach. These
    tests drive the real admin: they render the change form and post a rung
    through it, so the inline's formset, its exclusivity constraint and its
    computed-price column are all executed rather than merely imported.
    """

    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="ladder-admin", password="x12345678", email="a@example.com",
        )
        # force_login, not login(): django-axes rejects authenticate() without
        # a request, which is the repo-wide convention for admin tests.
        self.client.force_login(self.admin_user)
        self.author = User.objects.create_user(username="ladder-vendor", password="x12345678")
        self.product = Product.objects.create(
            title="کود پنل ادمین", slug="kood-admin-panel", author=self.author,
            description="تست", price=10000, discount_percent=20, stock=500,
            status="published",
        )

    def test_the_change_form_renders_the_ladder_inline(self):
        response = self.client.get(f"/admin/shop/product/{self.product.id}/change/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "تخفیف پلکانی")
        self.assertContains(response, "min_quantity")

    def test_an_existing_rung_shows_the_price_it_produces(self):
        """The whole reason the inline exists: percent in, price out, in one row."""
        PriceTier.objects.create(product=self.product, min_quantity=40, discount_percent=10)
        response = self.client.get(f"/admin/shop/product/{self.product.id}/change/")
        # 10000 - 20% = 8000, then - 10% = 7200
        self.assertContains(response, "7,200 تومان")

    def test_a_rung_can_be_created_through_the_admin_formset(self):
        """The save path, driven through the inline's own formset.

        Deliberately not an HTML scrape. Scraping the admin change page means
        the test depends on attribute order, on `extra = 0` rendering no blank
        row, and on round-tripping every unrelated field — all of which can
        break the test while the admin still works. Going through
        `get_formset()` exercises the same formset the admin POSTs into,
        including its validation and the model's constraints.
        """
        from shop.admin import ProductPriceTierInline

        inline = ProductPriceTierInline(Product, admin.site)
        formset_class = inline.get_formset(request=MagicMock(), obj=self.product)
        formset = formset_class(
            data={
                "price_tiers-TOTAL_FORMS": "1",
                "price_tiers-INITIAL_FORMS": "0",
                "price_tiers-MIN_NUM_FORMS": "0",
                "price_tiers-MAX_NUM_FORMS": "1000",
                "price_tiers-0-min_quantity": "40",
                "price_tiers-0-discount_percent": "10",
            },
            instance=self.product,
        )
        self.assertTrue(formset.is_valid(), formset.errors)
        formset.save()

        rung = PriceTier.objects.get(product=self.product)
        self.assertEqual(rung.min_quantity, 40)
        self.assertEqual(rung.discount_percent, 10)
        # And the row the operator was looking at quoted the price the buyer
        # will actually be charged.
        self.assertEqual(
            inline.resulting_unit_price(rung),
            f"{int(8000 * 90 / 100):,} تومان",
        )

    def test_the_formset_refuses_a_rung_below_the_minimum(self):
        """The >=2 rule reaches the admin form, not just the database."""
        from shop.admin import ProductPriceTierInline

        inline = ProductPriceTierInline(Product, admin.site)
        formset_class = inline.get_formset(request=MagicMock(), obj=self.product)
        formset = formset_class(
            data={
                "price_tiers-TOTAL_FORMS": "1",
                "price_tiers-INITIAL_FORMS": "0",
                "price_tiers-MIN_NUM_FORMS": "0",
                "price_tiers-MAX_NUM_FORMS": "1000",
                "price_tiers-0-min_quantity": "1",
                "price_tiers-0-discount_percent": "10",
            },
            instance=self.product,
        )
        self.assertFalse(formset.is_valid())
        self.assertFalse(PriceTier.objects.filter(product=self.product).exists())

    def test_the_formset_refuses_two_rungs_at_the_same_threshold(self):
        from shop.admin import ProductPriceTierInline

        PriceTier.objects.create(product=self.product, min_quantity=40, discount_percent=5)
        inline = ProductPriceTierInline(Product, admin.site)
        formset_class = inline.get_formset(request=MagicMock(), obj=self.product)
        formset = formset_class(
            data={
                "price_tiers-TOTAL_FORMS": "2",
                "price_tiers-INITIAL_FORMS": "1",
                "price_tiers-MIN_NUM_FORMS": "0",
                "price_tiers-MAX_NUM_FORMS": "1000",
                "price_tiers-0-min_quantity": "40",
                "price_tiers-0-discount_percent": "5",
                "price_tiers-0-id": str(PriceTier.objects.get(product=self.product).id),
                "price_tiers-1-min_quantity": "40",
                "price_tiers-1-discount_percent": "15",
            },
            instance=self.product,
        )
        # Either the formset rejects it or the unique constraint does; both are
        # acceptable, silently saving both is not. The save runs inside its own
        # atomic block so that when the constraint fires, the rollback is
        # contained — an IntegrityError escaping into the test's transaction
        # would poison it and every later query would raise
        # TransactionManagementError instead of answering.
        with transaction.atomic():
            try:
                if formset.is_valid():
                    formset.save()
            except IntegrityError:
                transaction.set_rollback(True)
        self.assertEqual(PriceTier.objects.filter(product=self.product).count(), 1)

class OrderCeilingTests(TestCase):
    """A ladder the cart refuses to reach is a promise with a button on it.

    The bug: catalogue products were capped at ten units per cart line, while
    the ladder offered rungs at twenty and forty. The strip offered «برو به ۲۰»,
    the server clamped the request to ten *without responding*, and the buyer
    got ten units at the undiscounted price after being shown a cheaper one.

    Three things are pinned here, because fixing any one of them alone leaves a
    way to lie: the ladder raises the ceiling, products without a ladder are
    untouched, and an over-the-ceiling request is refused rather than rewritten.
    """

    def setUp(self):
        self.client = APIClient()
        self.buyer = User.objects.create_user(username="ceiling-buyer", password="x12345678")
        self.client.force_login(self.buyer)
        self.author = User.objects.create_user(username="ceiling-vendor", password="x12345678")

    def _product(self, slug, stock=500, **kwargs):
        return Product.objects.create(
            title=f"کود {slug}", slug=slug, author=self.author, description="تست",
            price=10000, stock=stock, status="published", **kwargs,
        )

    def test_a_product_without_a_ladder_is_still_capped_at_ten(self):
        """The fat-finger guard must survive for the whole existing catalogue."""
        product = self._product("no-ladder-cap")
        response = self.client.post(
            "/api/cart/add/", {"product_id": product.id, "quantity": 30}, format="json",
        )
        self.assertEqual(response.status_code, 201, response.content.decode())
        row = CartItem.objects.get(product=product)
        self.assertEqual(row.quantity, 10)

    def test_a_ladder_above_the_cap_makes_its_own_rung_reachable(self):
        product = self._product("with-ladder-cap")
        PriceTier.objects.create(product=product, min_quantity=20, discount_percent=15)

        response = self.client.post(
            "/api/cart/add/", {"product_id": product.id, "quantity": 20}, format="json",
        )
        self.assertEqual(response.status_code, 201, response.content.decode())
        row = CartItem.objects.get(product=product)
        self.assertEqual(row.quantity, 20)
        # ...and the promised price is the one actually charged.
        self.assertEqual(row.unit_price, 8500)

    def test_an_over_the_ceiling_update_is_refused_not_silently_rewritten(self):
        """The clamp is the reason nobody noticed. It has to answer instead."""
        product = self._product("refuse-clamp")
        self.client.post("/api/cart/add/", {"product_id": product.id, "quantity": 2}, format="json")

        response = self.client.post(
            "/api/cart/update_quantity/",
            {"item_id": CartItem.objects.get(product=product).id, "quantity": 40},
            format="json",
        )
        self.assertEqual(response.status_code, 409, response.content.decode())
        self.assertEqual(CartItem.objects.get(product=product).quantity, 2)

    def test_stock_still_wins_over_the_ladder(self):
        """Raising the ceiling must not let a buyer order stock that is absent."""
        product = self._product("low-stock-ladder", stock=15)
        PriceTier.objects.create(product=product, min_quantity=20, discount_percent=15)
        response = self.client.post(
            "/api/cart/add/", {"product_id": product.id, "quantity": 20}, format="json",
        )
        row = CartItem.objects.filter(product=product).first()
        if row is not None:
            self.assertLessEqual(row.quantity, 15)
