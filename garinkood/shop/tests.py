from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import AffiliateProfile, Category, Coupon, Product, Storefront, StorefrontPost, Wallet
from .rewards import mark_order_paid_and_reward


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

    def test_profile_can_update_user_and_always_exposes_an_account(self):
        # Every user now has a level-1 profile row from the moment the account
        # is created, so a name-only update returns the profile rather than
        # null.
        self.client.force_authenticate(self.user)
        response = self.client.patch("/api/profile/", {"first_name": "علی"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["first_name"], "علی")
        self.assertIsNotNone(response.data["account"])
        self.assertEqual(response.data["account"]["level"], 1)

    def test_robots_and_sitemap_are_available(self):
        robots = self.client.get("/robots.txt")
        sitemap = self.client.get("/sitemap.xml")

        self.assertEqual(robots.status_code, 200)
        self.assertIn("Sitemap:", robots.content.decode())
        self.assertEqual(sitemap.status_code, 200)
        self.assertIn("<urlset", sitemap.content.decode())

    def test_browser_auth_uses_httponly_cookie_and_session_probe(self):
        response = self.client.post('/api/auth/login/', {'username': 'farmer', 'password': 'safe-password-123'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('token', response.data)
        self.assertIn('garinkood_auth', response.cookies)
        self.assertTrue(response.cookies['garinkood_auth']['httponly'])

        session = self.client.get('/api/auth/session/')
        self.assertEqual(session.status_code, 200)
        self.assertEqual(session.data['user']['username'], 'farmer')

        logout = self.client.post('/api/auth/logout/')
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(self.client.get('/api/auth/session/').status_code, 401)


@override_settings(SECURE_SSL_REDIRECT=False)
class OrderAndPlatformTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="platform-user", password="safe-password-123")
        self.seller = User.objects.create_user(username="seller-user", password="safe-password-123")
        self.category = Category.objects.create(name="کود", slug="fertilizer")
        self.product = Product.objects.create(
            title="کود آزمایشی", slug="checkout-fertilizer", author=self.user,
            category=self.category, description="محصول برای تست سفارش", status="published",
            price=500000, stock=6, available=True,
        )

    def _add_to_guest_cart(self):
        response = self.client.post(
            "/api/cart/add/", {"product_id": self.product.id, "quantity": 2}, format="json"
        )
        self.assertEqual(response.status_code, 201)

    def test_checkout_creates_order_reserves_stock_and_clears_cart(self):
        self._add_to_guest_cart()
        response = self.client.post(
            "/api/orders/checkout/",
            {
                "customer_name": "کشاورز نمونه",
                "phone": "09123456789",
                "province": "فارس",
                "city": "شیراز",
                "address": "خیابان نمونه، پلاک ۱",
                "payment_method": "coordination",
                "terms_accepted": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        order = response.data["order"]
        self.assertEqual(order["status"], "awaiting_review")
        self.assertEqual(order["payment_status"], "unpaid")
        self.assertEqual(order["subtotal"], 1000000)
        self.assertEqual(order["shipping_price"], 45000)
        self.assertEqual(len(order["items"]), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 4)
        self.assertEqual(self.client.get("/api/cart/").data["items"], [])

        lookup = self.client.get("/api/orders/lookup/", {"code": order["code"], "phone": "09123456789"})
        self.assertEqual(lookup.status_code, 200)
        self.assertEqual(lookup.data["code"], order["code"])

        cancelled = self.client.post('/api/orders/cancel/', {"code": order["code"], "phone": "09123456789"}, format='json')
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(cancelled.data['order']['status'], 'cancelled')
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 6)

    def test_checkout_requires_terms_acceptance(self):
        self._add_to_guest_cart()
        response = self.client.post(
            "/api/orders/checkout/",
            {
                "customer_name": "کشاورز نمونه", "phone": "09123456789", "province": "فارس",
                "city": "شیراز", "address": "خیابان نمونه", "terms_accepted": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 6)

    def test_service_and_procurement_requests_are_recorded(self):
        service = self.client.post(
            "/api/services/requests/",
            {
                "service_type": "irrigation", "customer_name": "علی", "phone": "09123456789",
                "province": "کرمان", "city": "رفسنجان", "crop": "پسته", "description": "نیاز به طراحی آبیاری قطره‌ای",
            },
            format="json",
        )
        procurement = self.client.post(
            "/api/procurement/requests/",
            {
                "farmer_name": "زهرا", "phone": "09121234567", "crop_name": "گندم",
                "quantity": "2500", "unit": "کیلوگرم", "province": "همدان", "city": "ملایر",
            },
            format="json",
        )
        self.assertEqual(service.status_code, 201)
        self.assertTrue(service.data["request"]["code"].startswith("SV-"))
        self.assertEqual(procurement.status_code, 201)
        self.assertTrue(procurement.data["request"]["code"].startswith("PR-"))

    def test_seller_can_create_storefront_and_submit_listing_for_review(self):
        self.client.force_authenticate(self.seller)
        storefront = self.client.post(
            "/api/marketplace/storefront/",
            {"name": "غرفه نمونه", "slug": "sample-stall", "seller_type": "farmer", "province": "فارس", "city": "شیراز"},
            format="json",
        )
        self.assertEqual(storefront.status_code, 201)

        listing = self.client.post(
            "/api/marketplace/listings/",
            {
                "title": "گندم ممتاز", "slug": "premium-wheat", "crop_name": "گندم",
                "description": "گندم برداشت امسال", "price": 45000, "unit": "کیلوگرم",
                "quantity_available": "1000", "min_order_quantity": "100",
            },
            format="json",
        )
        self.assertEqual(listing.status_code, 201)
        self.assertEqual(listing.data["status"], "pending_review")

        public_list = self.client.get("/api/marketplace/listings/")
        self.assertEqual(public_list.data["count"], 0)

    def test_payment_registry_only_exposes_verified_manual_flow(self):
        response = self.client.get('/api/payments/options/')
        self.assertEqual(response.status_code, 200)
        providers = {provider['code']: provider for provider in response.data['providers']}
        self.assertTrue(providers['coordination']['enabled'])
        self.assertFalse(providers['zarinpal']['enabled'])
        self.assertFalse(providers['paypal']['enabled'])
        self.assertFalse(providers['crypto']['enabled'])

    def test_active_affiliate_creates_pending_conversion_and_ledger_entry(self):
        self.client.force_authenticate(self.user)
        affiliate_response = self.client.post('/api/affiliate/me/', {}, format='json')
        self.assertEqual(affiliate_response.status_code, 201)
        code = affiliate_response.data['profile']['code']
        AffiliateProfile.objects.filter(code=code).update(status='active', commission_rate=10)

        self._add_to_guest_cart()
        response = self.client.post(
            '/api/orders/checkout/',
            {
                'customer_name': 'کشاورز نمونه', 'phone': '09123456789', 'province': 'فارس',
                'city': 'شیراز', 'address': 'خیابان نمونه', 'payment_method': 'coordination',
                'affiliate_code': code, 'terms_accepted': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['order']['affiliate_code'], code)

        dashboard = self.client.get('/api/affiliate/me/')
        self.assertEqual(len(dashboard.data['conversions']), 1)
        self.assertEqual(dashboard.data['conversions'][0]['status'], 'pending')
        self.assertEqual(len(dashboard.data['ledger']), 1)
        self.assertEqual(dashboard.data['ledger'][0]['amount'], 100000)

    def test_feedback_and_authenticated_storefront_complaint_are_recorded(self):
        feedback = self.client.post(
            '/api/feedback/',
            {'kind': 'suggestion', 'subject': 'جستجوی بهتر', 'message': 'فیلتر شهر اضافه شود.'},
            format='json',
        )
        self.assertEqual(feedback.status_code, 201)

        storefront = Storefront.objects.create(user=self.seller, name='غرفه فروشنده', slug='seller-stall')
        self.client.force_authenticate(self.user)
        complaint = self.client.post(
            '/api/complaints/storefront/',
            {'storefront': storefront.id, 'subject': 'کیفیت نامشخص', 'description': 'لطفاً مشخصات گرید تکمیل شود.'},
            format='json',
        )
        self.assertEqual(complaint.status_code, 201)
        self.assertEqual(complaint.data['complaint']['status'], 'new')

    def test_coupon_applies_once_and_paid_order_issues_wallet_reward(self):
        coupon = Coupon.objects.create(
            code='TEST-NEXT', description='تخفیف آزمایشی', discount_type='percentage',
            discount_value=10, max_discount_amount=200000, usage_limit=1,
            issued_to_phone='09123456789',
        )
        self._add_to_guest_cart()
        response = self.client.post(
            '/api/orders/checkout/',
            {
                'customer_name': 'کشاورز نمونه', 'phone': '09123456789', 'province': 'فارس',
                'city': 'شیراز', 'address': 'خیابان نمونه', 'payment_method': 'coordination',
                'coupon_code': coupon.code, 'terms_accepted': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['order']['discount_amount'], 100000)
        self.assertEqual(response.data['order']['total_price'], 945000)
        coupon.refresh_from_db()
        self.assertEqual(coupon.usage_count, 1)

        order_id = response.data['order']['id']
        from .models import Order
        order = Order.objects.get(id=order_id)
        order.user = self.user
        order.save(update_fields=['user'])
        paid_order, next_coupon = mark_order_paid_and_reward(order)
        self.assertEqual(paid_order.payment_status, 'paid')
        self.assertIsNotNone(next_coupon)
        wallet = Wallet.objects.get(user=self.user)
        self.assertGreater(wallet.balance, 0)

    def test_storefront_post_is_queued_for_review(self):
        storefront = Storefront.objects.create(user=self.seller, name='غرفه محتوا', slug='content-stall')
        self.client.force_authenticate(self.seller)
        response = self.client.post(
            '/api/marketplace/posts/',
            {'post_type': 'story', 'caption': 'معرفی محصول تازه برداشت شده'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'pending_review')
        self.assertIsNotNone(response.data['expires_at'])
        self.assertEqual(StorefrontPost.objects.get(storefront=storefront).post_type, 'story')


@override_settings(SECURE_SSL_REDIRECT=False)
class ManagementDashboardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_superuser(username='owner', email='owner@example.test', password='safe-password-123')
        self.staff = User.objects.create_user(username='ops', password='safe-password-123', is_staff=True)
        self.category = Category.objects.create(name='کود', slug='management-fertilizer')
        self.product = Product.objects.create(
            title='کود داشبورد', slug='management-product', author=self.owner,
            category=self.category, description='محصول تست داشبورد', status='published',
            price=100000, stock=3, available=True,
        )

    def test_owner_can_view_dashboard_and_manage_staff_roles(self):
        self.client.force_authenticate(self.owner)
        dashboard = self.client.get('/api/management/dashboard/')
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data['viewer']['username'], 'owner')
        self.assertEqual(dashboard.data['metrics']['low_stock_products'], 1)

        call_command('bootstrap_management_roles')
        response = self.client.patch(
            '/api/management/staff/',
            {'username': 'ops', 'groups': ['عملیات'], 'is_active': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('عملیات', response.data['groups'])
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.groups.filter(name='عملیات').exists())

    def test_non_staff_cannot_view_management_dashboard(self):
        regular = User.objects.create_user(username='regular', password='safe-password-123')
        self.client.force_authenticate(regular)
        response = self.client.get('/api/management/dashboard/')
        self.assertEqual(response.status_code, 403)
