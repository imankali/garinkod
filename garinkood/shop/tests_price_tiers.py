"""Quantity price ladders (تخفیف پلکانی).

The rule under test is narrow and easy to get subtly wrong: a ladder is a set of
thresholds, only the highest one the quantity reaches applies, and the percentage
comes off the price the row already charges. Each of those three clauses has an
obvious wrong implementation — stacking the rungs, picking the first instead of
the highest, or compounding the ladder with the display-only ``discount_percent``
— so each is pinned separately rather than by one happy-path test.
"""

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Cart, CartItem, MarketplaceListing, PriceTier, Product, Storefront
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

    def test_the_ladder_does_not_compound_with_the_display_discount(self):
        # `discount_percent` is a separate, display-only field. A ladder that also
        # swallowed it would silently discount twice and the two would drift
        # apart the moment either was edited.
        self.product.discount_percent = 10
        self.product.save(update_fields=["discount_percent"])
        row = self._row(20)
        self.assertEqual(row.unit_price, 850)

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
