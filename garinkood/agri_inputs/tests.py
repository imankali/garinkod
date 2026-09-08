"""Unit tests for the agri-inputs bounded context.

Contracts pinned here:

* a valid fertilizer profile persists and reads back through its serializer;
* an expiry date in the past is REJECTED (model full_clean AND the admin
  ModelForm path) — regulated lots must never sneak in through admin or API;
* deleting the platform product removes the attached profile (CASCADE);
* germination_rate is clamped 0..100 on both bounds (negative AND >100);
* seedling profiles cascade-delete too (parity with fertilizer);
* ``is_expired`` is true only for a past date, false for a future date, and
  false for a NULL expiry (Pesticide legacy rows without a date);
* the public API honours partial-text search over agronomic fields."""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import Client, TestCase

from shop.models import Category, Product

from .models import Fertilizer, Pesticide, Seed, Seedling
from .serializers import FertilizerSerializer

User = get_user_model()


class AgriInputModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="inputs-tester", password="safe-pass-1")
        self.category = Category.objects.create(name="نهاده آزمون", slug="t-inputs")
        self.product = Product.objects.create(
            title="کود اوره آزمون", slug="t-input-urea", author=self.user,
            category=self.category, description="تست", status="published",
            price=400_000, stock=50, available=True,
        )

    def _fertilizer_kwargs(self, **overrides):
        data = dict(
            product=self.product,
            active_ingredient="اوره ۴۶٪",
            npk_ratio="46-0-0",
            expiry_date=date.today() + timedelta(days=400),
            registration_number="JIR-TEST-11456",
        )
        data.update(overrides)
        return data

    def test_valid_fertilizer_persists_and_serializes(self):
        fertilizer = Fertilizer.objects.create(**self._fertilizer_kwargs())
        fertilizer.full_clean()  # no ValidationError — contract clean
        payload = FertilizerSerializer(fertilizer).data
        self.assertEqual(payload["npk_ratio"], "46-0-0")
        self.assertEqual(payload["registration_number"], "JIR-TEST-11456")
        self.assertEqual(payload["product"]["slug"], "t-input-urea")
        self.assertEqual(payload["product"]["price"], 400_000)

    def test_expiry_in_past_is_rejected_everywhere(self):
        past = date.today() - timedelta(days=10)
        with self.assertRaises(ValidationError):
            Fertilizer(**self._fertilizer_kwargs(expiry_date=past)).full_clean()

        # The production write path is the admin ModelForm — the validator
        # fires there too, wrapping the same field error.
        from django.forms import ModelForm

        class _ProbeForm(ModelForm):
            class Meta:
                model = Fertilizer
                fields = "__all__"

        form = _ProbeForm(data={**self._fertilizer_kwargs(expiry_date=past), "product": self.product.pk})
        self.assertFalse(form.is_valid())
        self.assertIn("expiry_date", form.errors)

    def test_product_delete_cascades_to_profile(self):
        Fertilizer.objects.create(**self._fertilizer_kwargs())
        self.assertTrue(Fertilizer.objects.filter(product=self.product).exists())
        self.product.delete()
        self.assertEqual(Fertilizer.objects.filter(registration_number="JIR-TEST-11456").count(), 0)

    def test_germination_rate_out_of_bounds_is_rejected(self):
        with self.assertRaises(ValidationError):
            Seed(
                product=self.product,
                germination_rate=120,
                planting_season="autumn",
                variety_name="چمران تست",
            ).full_clean()

    def test_germination_rate_negative_rejected(self):
        with self.assertRaises(ValidationError):
            Seed(
                product=self.product,
                germination_rate=-5,
                planting_season="autumn",
                variety_name="چمران تست",
            ).full_clean()

    def test_seedling_cascade_delete(self):
        Seedling.objects.create(
            product=self.product,
            rootstock="بیذر قدومی",
            scion_variety="سیب گلاب",
            age_years=2,
            height_cm=90,
        )
        self.assertEqual(Seedling.objects.count(), 1)
        self.product.delete()
        self.assertEqual(Seedling.objects.count(), 0)

    def test_is_expired_true_for_past_date(self):
        fertilizer = Fertilizer.objects.create(**self._fertilizer_kwargs(
            expiry_date=date.today() - timedelta(days=10)
        ))
        self.assertTrue(fertilizer.is_expired)

    def test_is_expired_false_for_future_date(self):
        fertilizer = Fertilizer.objects.create(**self._fertilizer_kwargs(
            expiry_date=date.today() + timedelta(days=100)
        ))
        self.assertFalse(fertilizer.is_expired)

    def test_is_expired_false_when_null(self):
        # Pesticide can have null expiry_date (backward compatibility)
        pesticide = Pesticide.objects.create(
            product=self.product,
            target_pest="کنه",
            toxicity_level="medium",
            waiting_period=14,
            registration_number="JIR-PEST-99999",
            expiry_date=None,  # null allowed
        )
        self.assertFalse(pesticide.is_expired)

    def test_pesticide_expiry_in_past_is_rejected(self):
        past = date.today() - timedelta(days=10)
        with self.assertRaises(ValidationError):
            Pesticide(
                product=self.product,
                target_pest="کنه",
                toxicity_level="medium",
                waiting_period=14,
                registration_number="JIR-PEST-88888",
                expiry_date=past,
            ).full_clean()


class AgriInputApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="inputs-api", password="safe-pass-1")
        self.category = Category.objects.create(name="نهاده API آزمون", slug="t-inputs-api")
        self.product = Product.objects.create(
            title="کود سولفات آمونیوم", slug="t-input-ammonium", author=self.user,
            category=self.category, description="تست", status="published",
            price=350_000, stock=40, available=True,
        )
        Fertilizer.objects.create(
            product=self.product,
            active_ingredient="سولفات اوره",
            npk_ratio="21-0-0",
            expiry_date=date.today() + timedelta(days=300),
            registration_number="JIR-API-77112",
        )

    def test_fertilizer_api_icontains_filter(self):
        response = self.client.get("/api/inputs/fertilizers/?active_ingredient__icontains=اوره")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["results"][0]["active_ingredient"], "سولفات اوره")
        no_match = self.client.get("/api/inputs/fertilizers/?active_ingredient__icontains=پتاسیم")
        self.assertEqual(no_match.json()["count"], 0)
