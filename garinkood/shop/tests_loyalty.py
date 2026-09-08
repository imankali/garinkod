"""Loyalty Wallet redemption tests (Phase-3 business feature).

The contract locked in here (all numbers observable at the API boundary):

- rate: 100 points = 10,000 toman, whole-unit floors only;
- the discount is clamped to the payable amount and never makes an order
  negative — and only the points actually backing the applied discount are
  deducted from the wallet;
- guests may flip `use_loyalty_points` harmlessly (order succeeds, zero
  discount — there is no wallet);
- an authenticated buyer without a wallet row gets one created on the fly;
- the flat response receipt (original_total / loyalty_discount / final_total)
  agrees with the order row.
"""

from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from .models import Category, Order, Product, Wallet


@override_settings(SECURE_SSL_REDIRECT=False)
class LoyaltyCheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='loyal-buyer', password='safe-password-123')
        self.category = Category.objects.create(name='کود', slug='loyalty-fertilizer')
        self.product = Product.objects.create(
            title='کود وفاداری', slug='loyalty-product', author=self.user,
            category=self.category, description='محصول تست امتیاز', status='published',
            price=250000, stock=20, available=True,
        )
        self.wallet = Wallet.objects.create(user=self.user, loyalty_points=5000)

    def _add_to_cart(self, quantity=2):
        response = self.client.post(
            '/api/cart/add/', {'product_id': self.product.id, 'quantity': quantity}, format='json'
        )
        self.assertEqual(response.status_code, 201)

    def _checkout(self, **extra):
        payload = {
            'customer_name': 'خریدار وفادار',
            'phone': '09123456789',
            'province': 'فارس',
            'city': 'شیراز',
            'address': 'خیابان نمونه، پلاک ۱',
            'payment_method': 'coordination',
            'terms_accepted': True,
        }
        payload.update(extra)
        return self.client.post('/api/orders/checkout/', payload, format='json')

    def test_full_redemption_deducts_points_and_shaves_total(self):
        # 2 × 250,000 = 500,000 subtotal + 45,000 shipping = 545,000 payable.
        # 5,000 pts → 50 units → 500,000 discount → final 45,000, wallet 0.
        self.client.force_authenticate(self.user)
        self._add_to_cart(quantity=2)
        response = self._checkout(use_loyalty_points=True)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['original_total'], 545000)
        self.assertEqual(response.data['loyalty_discount'], 500000)
        self.assertEqual(response.data['final_total'], 45000)
        self.assertEqual(response.data['final_total'], response.data['order']['total_price'])
        self.assertEqual(response.data['order']['loyalty_points_used'], 5000)

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, 0)

    def test_discount_clamps_to_payable_and_deducts_only_what_was_used(self):
        # 1 × 250,000 + 45,000 = 295,000 payable; a 99,999-point wallet
        # nominally covers 9,990,000. The loyalty unit is indivisible, so the
        # discount floors to whole units BELOW the payable: 29 units = 290,000
        # (a 295,000 discount would hand out 5,000 unpaid toman — no points
        # back it). The order never goes negative and the wallet keeps the rest.
        self.wallet.loyalty_points = 99999
        self.wallet.save(update_fields=['loyalty_points'])
        self.client.force_authenticate(self.user)
        self._add_to_cart(quantity=1)
        response = self._checkout(use_loyalty_points=True)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['loyalty_discount'], 290000)
        self.assertEqual(response.data['final_total'], 5000)
        self.assertEqual(response.data['order']['loyalty_points_used'], 2900)

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, 99999 - 2900)

    def test_points_below_one_unit_grant_nothing(self):
        self.wallet.loyalty_points = 80
        self.wallet.save(update_fields=['loyalty_points'])
        self.client.force_authenticate(self.user)
        self._add_to_cart()
        response = self._checkout(use_loyalty_points=True)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['loyalty_discount'], 0)
        self.assertEqual(response.data['final_total'], 545000)

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, 80)

    def test_flag_off_means_no_discount(self):
        self.client.force_authenticate(self.user)
        self._add_to_cart()
        response = self._checkout()  # no flag at all

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['loyalty_discount'], 0)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, 5000)

    def test_guest_flag_is_harmless(self):
        # Anonymous + use_loyalty_points=True → order succeeds untouched.
        self._add_to_cart()
        response = self._checkout(use_loyalty_points=True)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['loyalty_discount'], 0)
        self.assertEqual(response.data['final_total'], 545000)
        order = Order.objects.get(code=response.data['order']['code'])
        self.assertIsNone(order.user)

    def test_authenticated_buyer_without_wallet_gets_one_created(self):
        brand_new = User.objects.create_user(username='walletless', password='safe-password-123')
        self.client.force_authenticate(brand_new)
        self._add_to_cart()
        response = self._checkout(use_loyalty_points=True)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['loyalty_discount'], 0)
        wallet = Wallet.objects.get(user=brand_new)  # created lazily on demand
        self.assertEqual(wallet.loyalty_points, 0)
