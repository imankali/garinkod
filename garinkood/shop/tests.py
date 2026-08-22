from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import Category, Product


@override_settings(SECURE_SSL_REDIRECT=False)
class CatalogueApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(username="seller", password="safe-password-123")
        self.fertilizer = Category.objects.create(name="کود", slug="fertilizer")
        self.seed = Category.objects.create(name="بذر", slug="seed")
        self.in_stock = Product.objects.create(
            title="کود کامل", slug="complete-fertilizer", author=self.author,
            category=self.fertilizer, description="کود مناسب گندم", status="published",
            price=120000, stock=4, available=True,
        )
        Product.objects.create(
            title="بذر ناموجود", slug="out-of-stock-seed", author=self.author,
            category=self.seed, description="بذر گوجه", status="published",
            price=80000, stock=0, available=True,
        )
        Product.objects.create(
            title="کود گران", slug="premium-fertilizer", author=self.author,
            category=self.fertilizer, description="کود ویژه", status="published",
            price=420000, stock=1, available=True,
        )

    def test_catalogue_filters_match_frontend_query_parameters(self):
        response = self.client.get(
            "/api/products/",
            {"category": "fertilizer", "max_price": 200000, "in_stock": "true"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["slug"], "complete-fertilizer")

    def test_catalogue_can_order_by_price(self):
        response = self.client.get("/api/products/", {"ordering": "price"})

        self.assertEqual(response.status_code, 200)
        prices = [product["price"] for product in response.data["results"]]
        self.assertEqual(prices, sorted(prices))

    def test_cart_rejects_malformed_quantity_instead_of_raising_500(self):
        response = self.client.post(
            "/api/cart/add/",
            {"product_id": self.in_stock.id, "quantity": "not-a-number"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)

    def test_cart_add_clamps_quantity_to_stock_limit(self):
        response = self.client.post(
            "/api/cart/add/",
            {"product_id": self.in_stock.id, "quantity": 99},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["items"][0]["quantity"], 4)


@override_settings(SECURE_SSL_REDIRECT=False)
class ProfileAndSeoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="farmer", password="safe-password-123")

    def test_profile_can_update_user_without_existing_user_account(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch("/api/profile/", {"first_name": "علی"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["first_name"], "علی")
        self.assertIsNone(response.data["account"])

    def test_robots_and_sitemap_are_available(self):
        robots = self.client.get("/robots.txt")
        sitemap = self.client.get("/sitemap.xml")

        self.assertEqual(robots.status_code, 200)
        self.assertIn("Sitemap:", robots.content.decode())
        self.assertEqual(sitemap.status_code, 200)
        self.assertIn("<urlset", sitemap.content.decode())
