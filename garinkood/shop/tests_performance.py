"""Query-budget and bounded-search regressions for Sprint 6."""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .api_views import CommentViewSet
from .models import Category, Comment, MarketplaceListing, Product, Storefront
from .serializers import CommentSerializer

User = get_user_model()


@override_settings(SECURE_SSL_REDIRECT=False)
class CommentQueryBudgetTests(TestCase):
    def test_ten_comments_with_replies_serialize_in_two_queries(self):
        user = User.objects.create_user(username="comment-query-user", password="x")
        category = Category.objects.create(name="کود", slug="query-fertilizer")
        product = Product.objects.create(
            category=category,
            author=user,
            title="محصول تست بودجه کوئری",
            slug="comment-query-product",
            price=100,
            stock=20,
            status="published",
        )
        parents = [
            Comment.objects.create(
                product=product,
                user=user,
                name=f"خریدار {index}",
                email=f"buyer{index}@example.com",
                body=f"دیدگاه {index}",
                active=True,
            )
            for index in range(10)
        ]
        for index, parent in enumerate(parents):
            Comment.objects.create(
                product=product,
                user=user,
                parent=parent,
                name="پاسخ‌گو",
                email="reply@example.com",
                body=f"پاسخ {index}",
                active=True,
            )

        view = CommentViewSet()
        # Query one loads all ten parent rows (including the Exists annotation);
        # query two loads every active reply and its user in one prefetch.
        with self.assertNumQueries(2):
            rows = list(view.get_queryset().filter(product=product))
            payload = CommentSerializer(rows, many=True).data

        self.assertEqual(len(payload), 10)
        self.assertTrue(all(len(row["replies"]) == 1 for row in payload))


@override_settings(SECURE_SSL_REDIRECT=False)
class BoundedCatalogueSearchTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        category = Category.objects.create(name="بذر", slug="search-seed")
        author = User.objects.create_user(username="search-author", password="x")
        self.title_product = Product.objects.create(
            category=category,
            author=author,
            title="بذر آفتابگردان ممتاز",
            slug="sunflower-title",
            description="متن معمولی",
            price=100,
            stock=10,
            status="published",
        )
        Product.objects.create(
            category=category,
            author=author,
            title="محصول دیگر",
            slug="description-only-product",
            description="واژه‌مخفی‌کاتالوگ",
            price=120,
            stock=10,
            status="published",
        )

        seller = User.objects.create_user(username="search-seller", password="x")
        storefront = Storefront.objects.create(user=seller, name="غرفه کوتاه", slug="short-store")
        self.title_listing = MarketplaceListing.objects.create(
            storefront=storefront,
            title="زعفران صادراتی",
            slug="saffron-title",
            crop_name="زعفران",
            description="شرح معمولی",
            price=500,
            quantity_available=10,
            status="published",
        )
        MarketplaceListing.objects.create(
            storefront=storefront,
            title="محصول بازار",
            slug="description-only-listing",
            crop_name="گیاه دیگر",
            description="واژه‌مخفی‌بازار",
            price=400,
            quantity_available=10,
            status="published",
        )

    def test_product_search_matches_title_but_not_description_only(self):
        title = self.client.get("/api/products/", {"search": "آفتابگردان"})
        self.assertEqual(title.status_code, 200)
        self.assertEqual([row["slug"] for row in title.data["results"]], [self.title_product.slug])

        description = self.client.get("/api/products/", {"search": "واژه‌مخفی‌کاتالوگ"})
        self.assertEqual(description.status_code, 200)
        self.assertEqual(description.data["results"], [])

    def test_marketplace_search_matches_title_but_not_description_only(self):
        title = self.client.get("/api/marketplace/listings/", {"search": "صادراتی"})
        self.assertEqual(title.status_code, 200)
        self.assertEqual([row["slug"] for row in title.data["results"]], [self.title_listing.slug])

        description = self.client.get(
            "/api/marketplace/listings/", {"search": "واژه‌مخفی‌بازار"}
        )
        self.assertEqual(description.status_code, 200)
        self.assertEqual(description.data["results"], [])
