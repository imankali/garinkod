"""Ironclad Part 2 — the inventory over-sell race, pinned with real threads.

Contract under fire: two fully-loaded guest carts racing for ONE remaining
unit must produce exactly ONE accepted order and end at ``stock == 0`` —
never two orders, never negative stock, never a hang. The race is packet by
``threading.Barrier`` so both checkouts leave the gate on the same tick; the
contended point inside checkout is guarded by row locking (on MySQL/PG — the
same ``of=('self',)`` hardening from Part 1 — and by the sqlite dev write
serializer), so the outcome is deterministic by construction.

Test-path notes (اختیاری به جای Django-غیر‌مستند):
* ``TransactionTestCase`` (real commits — threads need them);
* each thread owns its test Client (session cookie = its own cart);
* every thread hands its DB connections back via ``connections.close_all()``.
"""

import threading

from django.contrib.auth import get_user_model
from django.db import connections
from django.test import Client, TransactionTestCase

from .models import Category, Order, Product

User = get_user_model()

RACE_CHECKOUT_PAYLOAD = {
    "customer_name": "دونده‌ی موجودی",
    "phone": "09121111111",
    "province": "تهران",
    "city": "تهران",
    "address": "پلاک ۱",
    "payment_method": "coordination",
    "terms_accepted": True,
}


class InventoryRaceTests(TransactionTestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="race-author", password="safe-pass-1")
        self.category = Category.objects.create(name="مسابقه", slug="race-cat")
        self.product = Product.objects.create(
            title="آخرین واحد", slug="race-last-unit", author=self.user,
            category=self.category, description="تست مسابقه", status="published",
            price=100_000, stock=1, available=True,
        )

    def test_two_racing_checkouts_produce_exactly_one_order(self):
        # CARTS PRE-STAGED SEQUENTIALLY: the only contended point in this
        # test is the checkout itself — never the cart-add writes (sqlite is
        # a single-writer engine and racing two session opens is not the
        # contract under fire here).
        client_a, client_b = Client(), Client()
        for client in (client_a, client_b):
            added = client.post(
                "/api/cart/add/",
                {"product_id": self.product.id, "quantity": 1},
                content_type="application/json",
            )
            self.assertEqual(added.status_code, 201, added.content)

        barrier = threading.Barrier(2)
        results_lock = threading.Lock()
        results: list[tuple[int, str]] = []
        failures: list[str] = []

        def run_cart(client):
            try:
                barrier.wait(timeout=15)  # both racers leave the gate together
                response = client.post(
                    "/api/orders/checkout/",
                    RACE_CHECKOUT_PAYLOAD,
                    content_type="application/json",
                )
                with results_lock:
                    results.append((response.status_code, response.content.decode()[:300]))
            except Exception as exc:  # a thread dying silently would fake determinism
                with results_lock:
                    failures.append(f"{type(exc).__name__}: {exc}")
            finally:
                connections.close_all()  # hand the thread's DB handles back

        racers = [
            threading.Thread(target=run_cart, args=(client_a,)),
            threading.Thread(target=run_cart, args=(client_b,)),
        ]
        for racer in racers:
            racer.start()
        for racer in racers:
            racer.join(timeout=60)
            self.assertFalse(racer.is_alive(), "یک دونده هرگز به پایان نرسید (اتلاف تست)")

        self.assertEqual(failures, [], f"استثنای نخ‌ها باید صفر باشد: {failures}")
        self.assertEqual(len(results), 2, f"هر دو دونده باید به خط پایان برسند: {results}")
        codes = sorted(code for code, _ in results)
        self.assertEqual(
            codes.count(201), 1,
            f"دقیقاً یک سفارش باید ثبت شود (در غیر این صورت بیش‌فروش رخ داده): {results}",
        )
        for code, body in results:
            if code != 201:
                self.assertIn(code, (400, 409), f"پاسخ بازندهٔ غیرمنتظره: {code} — {body}")

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0, "موجودی هرگز نباید منفی یا کسری شود")
        self.assertEqual(Order.objects.count(), 1)

    def test_sold_out_product_rejects_any_new_checkout(self):
        """Insurance: با stock=0 حتی یک checkout تکی هم نباید جایی که منفی شود برود."""
        Product.objects.filter(pk=self.product.pk).update(stock=0)
        client = Client()
        added = client.post(
            "/api/cart/add/",
            {"product_id": self.product.id, "quantity": 1},
            content_type="application/json",
        )
        self.assertIn(added.status_code, (400, 409, 201))
        if added.status_code == 201:  # cart add accepted → checkout must be the guard
            response = client.post(
                "/api/orders/checkout/",
                RACE_CHECKOUT_PAYLOAD,
                content_type="application/json",
            )
            self.assertIn(response.status_code, (400, 409))
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock, 0)
        self.assertEqual(Order.objects.count(), 0)
