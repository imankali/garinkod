"""Unit tests for the machinery bounded context.

Contracts pinned here:

* a valid tractor profile persists with its mechanical data intact and its
  serializer renders the human-readable condition badge (نو/دست دوم);
* deleting the platform product removes the attached machinery profile
  (CASCADE parity with agri_inputs);
* the read API serves the implement list with product summary honoured plus
  buyer filters (implement_type + partial tractor-compatibility text)."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from shop.models import Category, Product

from .models import Implement, Tractor
from .serializers import TractorSerializer

User = get_user_model()


class MachineryModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="machinery-tester", password="safe-pass-1")
        self.category = Category.objects.create(name="ادوات آزمون", slug="t-machinery")
        self.tractor_product = Product.objects.create(
            title="تراکتور جاندیر ۴۷۵۵", slug="t-tractor-jd", author=self.user,
            category=self.category, description="تست", status="published",
            price=2_850_000_000, stock=3, available=True,
        )

    def test_valid_tractor_persists(self):
        tractor = Tractor.objects.create(
            product=self.tractor_product,
            horsepower=150, manufacture_year=1401,
            working_hours=1250, warranty_months=12, is_second_hand=False,
        )
        tractor.full_clean()
        self.assertEqual(tractor.horsepower, 150)
        self.assertEqual(TractorSerializer(tractor).data["condition_label"], "نو")
        self.assertIn("نو", str(tractor))

    def test_product_delete_cascades_to_tractor(self):
        Tractor.objects.create(
            product=self.tractor_product, horsepower=150, manufacture_year=1401,
        )
        self.tractor_product.delete()
        self.assertEqual(Tractor.objects.count(), 0)


class MachineryApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="machinery-api", password="safe-pass-1")
        self.category = Category.objects.create(name="ادوات API آزمون", slug="t-machinery-api")
        self.product = Product.objects.create(
            title="سم‌پاش زنبه‌ای ۱۲ نازله", slug="t-sprayer", author=self.user,
            category=self.category, description="تست", status="published",
            price=95_000_000, stock=7, available=True,
        )
        self.implement = Implement.objects.create(
            product=self.product,
            implement_type="sprayer",
            working_width=Decimal("12.00"),
            compatible_tractors="جاندیر ۳۸۵، فرگوسن ۲۳۵",
            warranty_months=6,
        )

    def test_implement_api_filters(self):
        response = self.client.get("/api/machinery/implements/")
        self.assertEqual(response.status_code, 200)
        row = response.json()["results"][0]
        self.assertEqual(row["implement_type_label"], "سم‌پاش")
        self.assertEqual(row["product"]["slug"], "t-sprayer")
        self.assertEqual(row["compatible_tractors"], "جاندیر ۳۸۵، فرگوسن ۲۳۵")

        by_type = self.client.get("/api/machinery/implements/?implement_type=sprayer")
        self.assertEqual(by_type.json()["count"], 1)

        by_compat = self.client.get("/api/machinery/implements/?compatible_tractors__icontains=فرگوسن")
        self.assertEqual(by_compat.json()["count"], 1)

        by_width = self.client.get("/api/machinery/implements/?working_width__lte=12.00")
        self.assertEqual(by_width.json()["count"], 1)
