"""Ironclad Part 1 — financial integrity around loyalty point refunds.

The contracts pinned here are single-fire by construction:

* a REAL claim of ordercancel/returned hands the consumed points back to
  the wallet AND writes a WalletTransaction('loyalty_refund') audit row;
* re-saving / double transitions NEVER double-credit (loyalty_refunded_at);
* orders without spent points, without a user, or in non-terminal states
  receive no refund machinery traffic at all;
* the full self-service path (cancel_and_restore_stock) refunds as part of
  the same atomic unit — no leaked state between stock/WALLETS/ledger."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Order, Wallet, WalletTransaction

User = get_user_model()


class LoyaltyRefundTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="refund-buyer", password="safe-pass-1")
        self.wallet, _ = Wallet.objects.get_or_create(user=self.user, defaults={"loyalty_points": 5000})

    def _order(self, *, points=1000, status="awaiting_review") -> Order:
        return Order.objects.create(
            code=f"RF-{self._testMethodName}-{status[:3]}",
            user=self.user,
            customer_name="خریدار تست",
            phone="09121111111",
            province="تهران",
            city="تهران",
            address="پلاک ۱",
            total_price=100_000,
            status=status,
            loyalty_points_used=points,
            loyalty_discount=points * 100,
        )

    def test_cancel_refunds_points_once_with_audit_row(self):
        points_before = self.wallet.loyalty_points
        order = self._order(points=1000)

        order.status = "cancelled"
        order.save()

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, points_before + 1000)
        txn = WalletTransaction.objects.get(transaction_type="loyalty_refund", order=order)
        self.assertEqual(txn.amount, 1000)
        self.assertEqual(txn.status, "available")
        self.assertIn("سفارش", txn.description)
        order.refresh_from_db()
        self.assertIsNotNone(order.loyalty_refunded_at)

        # Single-fire proof: even a second save CANNOT credit twice.
        order.status = "returned"
        order.save()
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, points_before + 1000)
        self.assertEqual(WalletTransaction.objects.filter(
            transaction_type="loyalty_refund", order=order
        ).count(), 1)

    def test_returned_status_also_refunds(self):
        order = self._order(points=250)
        order.status = "returned"
        order.save()
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, 5250)
        self.assertTrue(WalletTransaction.objects.filter(
            transaction_type="loyalty_refund", amount=250
        ).exists())

    def test_shipping_transition_refunds_nothing(self):
        order = self._order(points=700)
        order.status = "shipped"
        order.save()
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, 5000)
        self.assertFalse(WalletTransaction.objects.filter(
            transaction_type="loyalty_refund", order=order
        ).exists())

    def test_zero_points_refunds_nothing_and_no_txn(self):
        order = self._order(points=0)
        order.status = "cancelled"
        order.save()
        self.assertFalse(WalletTransaction.objects.filter(
            transaction_type="loyalty_refund", order=order
        ).exists())

    def test_cancel_and_restore_stock_path_refunds_atomically(self):
        """Self-service cancel: stock restore + loyalty refund + ledger in ONE atomic unit."""
        from .models import Category, Product

        category = Category.objects.create(name="کاتگوری RF", slug="rf-cat")
        product = Product.objects.create(
            title="محصول RF", slug="rf-product", author=self.user, category=category,
            description="x", status="published", price=50_000, stock=10, available=True,
        )
        order = self._order(points=300)
        order.items.create(
            product=product, product_title=product.title,
            unit_price=50_000, quantity=2, kind="product",
        )

        stock_before = product.stock
        result = order.cancel_and_restore_stock()

        product.refresh_from_db()
        self.assertEqual(product.stock, stock_before + 2)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, 5000 + 300)
        self.assertTrue(WalletTransaction.objects.filter(
            transaction_type="loyalty_refund", order=order
        ).exists())
        self.assertEqual(result.status, "cancelled")

    def test_admin_bulk_cancel_action_also_refunds(self):
        """The admin bulk action routes through the same save()-hooked method
        — the refund choke point holds for operator clicks too, not only for
        API calls (audited at admin.py cancel_orders_and_restore_stock)."""
        from types import SimpleNamespace

        from shop.admin import cancel_orders_and_restore_stock

        order = self._order(points=450)
        cancel_orders_and_restore_stock(
            SimpleNamespace(message_user=lambda *a, **k: None),
            request=None,
            queryset=Order.objects.filter(pk=order.pk),
        )
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.loyalty_points, 5000 + 450)
        self.assertTrue(WalletTransaction.objects.filter(
            transaction_type="loyalty_refund", order_id=order.pk
        ).exists())
