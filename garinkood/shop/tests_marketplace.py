"""Tests for the storefront marketplace: cart, checkout, money and moderation.

These cover the behaviour that is expensive to get wrong — stock reservation
under concurrency, the commission split, refund reversal and who is allowed to
moderate — rather than restating the serializers' field lists.
"""

import threading

from django.contrib.auth.models import User
from django.db import OperationalError, connections
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    AdminAuditLog, AgriInput, AgriInputDose, Cart, CartItem, Category,
    FinancialLedgerEntry, Location,
    MarketplaceListing, Order, OrderItem, Product, Storefront, StorefrontFollow,
    StorefrontHighlight, StorefrontPost, UserAccount, Wallet, WalletTransaction,
    account_level,
)
from .rewards import mark_order_paid_and_reward

CHECKOUT_PAYLOAD = {
    'customer_name': 'کشاورز نمونه',
    'phone': '09120000000',
    'province': 'فارس',
    'city': 'شیراز',
    'address': 'خیابان نمونه، پلاک ۱',
    'payment_method': 'coordination',
    'terms_accepted': True,
}


def make_seller(username='seller', *, commission=10):
    user = User.objects.create_user(username=username, password='safe-password-123')
    storefront = Storefront.objects.create(
        user=user, name=f'غرفه {username}', slug=f'ghorfe-{username}',
        province='فارس', city='شیراز', commission_rate=commission,
    )
    return user, storefront


def make_listing(storefront, *, price=100_000, quantity=50, minimum=1, status='published', title='گندم درجه یک'):
    return MarketplaceListing.objects.create(
        storefront=storefront, title=title, slug=f'listing-{title}-{storefront.id}',
        crop_name='گندم', description='محصول سالم و تازه', price=price, unit='کیلوگرم',
        quantity_available=quantity, min_order_quantity=minimum, status=status,
    )


@override_settings(SECURE_SSL_REDIRECT=False)
class ListingCartTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller, self.storefront = make_seller()
        self.listing = make_listing(self.storefront, minimum=5, quantity=20)

    def test_listing_can_be_added_to_cart(self):
        response = self.client.post(
            '/api/cart/add-listing/', {'listing_id': self.listing.id, 'quantity': 5}, format='json'
        )

        self.assertEqual(response.status_code, 201)
        item = response.data['items'][0]
        self.assertEqual(item['kind'], 'listing')
        self.assertEqual(item['quantity'], 5)
        self.assertEqual(item['unit_price'], self.listing.price)
        self.assertEqual(item['listing']['storefront_name'], self.storefront.name)

    def test_quantity_below_minimum_order_is_rejected(self):
        response = self.client.post(
            '/api/cart/add-listing/', {'listing_id': self.listing.id, 'quantity': 2}, format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('quantity', response.data['fields'])

    def test_quantity_above_available_stock_is_rejected(self):
        response = self.client.post(
            '/api/cart/add-listing/', {'listing_id': self.listing.id, 'quantity': 100}, format='json'
        )

        self.assertEqual(response.status_code, 409)

    def test_omitting_quantity_defaults_to_the_minimum_order(self):
        response = self.client.post(
            '/api/cart/add-listing/', {'listing_id': self.listing.id}, format='json'
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['items'][0]['quantity'], 5)

    def test_unpublished_listing_cannot_be_purchased(self):
        draft = make_listing(self.storefront, status='draft', title='پیش‌نویس')

        response = self.client.post(
            '/api/cart/add-listing/', {'listing_id': draft.id, 'quantity': 5}, format='json'
        )

        self.assertEqual(response.status_code, 409)

    def test_updating_quantity_enforces_the_minimum(self):
        self.client.post('/api/cart/add-listing/', {'listing_id': self.listing.id, 'quantity': 5}, format='json')
        cart = self.client.get('/api/cart/').data
        item_id = cart['items'][0]['id']

        response = self.client.post(
            '/api/cart/update_quantity/', {'item_id': item_id, 'quantity': 1}, format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('quantity', response.data['fields'])

    def test_cart_totals_mix_products_and_listings(self):
        author = User.objects.create_user(username='catalogue-author', password='safe-password-123')
        category = Category.objects.create(name='کود', slug='fertilizer-mix')
        product = Product.objects.create(
            title='کود اوره', slug='urea-mix', author=author, category=category,
            description='کود', status='published', price=50_000, stock=10, available=True,
        )
        self.client.post('/api/cart/add/', {'product_id': product.id, 'quantity': 2}, format='json')
        self.client.post('/api/cart/add-listing/', {'listing_id': self.listing.id, 'quantity': 5}, format='json')

        cart = self.client.get('/api/cart/').data

        self.assertEqual(cart['total_items'], 7)
        self.assertEqual(cart['total_price'], 2 * 50_000 + 5 * self.listing.price)


@override_settings(SECURE_SSL_REDIRECT=False)
class MarketplaceCheckoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller, self.storefront = make_seller(commission=10)
        self.listing = make_listing(self.storefront, price=200_000, quantity=30)

    def _checkout_with_listing(self, quantity=4):
        self.client.post(
            '/api/cart/add-listing/', {'listing_id': self.listing.id, 'quantity': quantity}, format='json'
        )
        return self.client.post('/api/orders/checkout/', CHECKOUT_PAYLOAD, format='json')

    def test_checkout_records_seller_storefront_and_commission(self):
        response = self._checkout_with_listing(quantity=4)

        self.assertEqual(response.status_code, 201)
        item = OrderItem.objects.get(kind='listing')
        self.assertEqual(item.listing_id, self.listing.id)
        self.assertEqual(item.storefront_id, self.storefront.id)
        self.assertEqual(item.seller_id, self.seller.id)
        self.assertEqual(item.storefront_name, self.storefront.name)
        self.assertEqual(item.unit, 'کیلوگرم')
        # 4 × 200,000 = 800,000, of which 10% is the platform's commission.
        self.assertEqual(item.total_price, 800_000)
        self.assertEqual(item.commission_amount, 80_000)
        self.assertEqual(item.seller_net_amount, 720_000)

    def test_order_detail_exposes_the_storefront_name(self):
        response = self._checkout_with_listing(quantity=2)

        item = response.data['order']['items'][0]
        self.assertEqual(item['storefront_name'], self.storefront.name)
        self.assertEqual(item['kind'], 'listing')
        self.assertEqual(item['kind_label'], 'آگهی غرفه')

    def test_checkout_decrements_listing_quantity(self):
        self._checkout_with_listing(quantity=4)

        self.listing.refresh_from_db()
        self.assertEqual(int(self.listing.quantity_available), 26)

    def test_listing_is_marked_sold_out_when_depleted(self):
        self._checkout_with_listing(quantity=30)

        self.listing.refresh_from_db()
        self.assertEqual(int(self.listing.quantity_available), 0)
        self.assertEqual(self.listing.status, 'sold_out')

    def test_checkout_creates_pending_seller_and_platform_ledger_entries(self):
        self._checkout_with_listing(quantity=4)

        seller_entry = FinancialLedgerEntry.objects.get(owner_type='seller')
        platform_entry = FinancialLedgerEntry.objects.get(owner_type='platform')
        self.assertEqual(seller_entry.amount, 720_000)
        self.assertEqual(seller_entry.status, 'pending')
        self.assertEqual(seller_entry.storefront_id, self.storefront.id)
        self.assertEqual(platform_entry.amount, 80_000)
        self.assertEqual(platform_entry.entry_type, 'commission')

    def test_payment_releases_seller_earnings_into_the_wallet(self):
        self._checkout_with_listing(quantity=4)
        order = Order.objects.get()

        mark_order_paid_and_reward(order)

        seller_entry = FinancialLedgerEntry.objects.get(owner_type='seller')
        self.assertEqual(seller_entry.status, 'available')
        transaction = WalletTransaction.objects.get(
            wallet__user=self.seller, transaction_type='seller_payout'
        )
        self.assertEqual(transaction.amount, 720_000)

    def test_releasing_twice_does_not_pay_the_seller_twice(self):
        self._checkout_with_listing(quantity=4)
        order = Order.objects.get()

        mark_order_paid_and_reward(order)
        mark_order_paid_and_reward(order)

        self.assertEqual(
            WalletTransaction.objects.filter(transaction_type='seller_payout').count(), 1
        )

    def test_cancelling_restores_quantity_and_reverses_the_ledger(self):
        self._checkout_with_listing(quantity=4)
        order = Order.objects.get()

        response = self.client.post(
            '/api/orders/cancel/', {'code': order.code, 'phone': order.phone}, format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.listing.refresh_from_db()
        self.assertEqual(int(self.listing.quantity_available), 30)
        self.assertEqual(self.listing.status, 'published')
        self.assertFalse(
            FinancialLedgerEntry.objects
            .filter(order=order, owner_type='seller')
            .exclude(status='reversed')
            .exists()
        )

    def test_mixed_cart_checkout_splits_product_and_listing_items(self):
        author = User.objects.create_user(username='catalogue-author', password='safe-password-123')
        category = Category.objects.create(name='کود', slug='fertilizer-checkout')
        product = Product.objects.create(
            title='کود اوره', slug='urea-checkout', author=author, category=category,
            description='کود', status='published', price=50_000, stock=10, available=True,
        )
        self.client.post('/api/cart/add/', {'product_id': product.id, 'quantity': 2}, format='json')
        self.client.post('/api/cart/add-listing/', {'listing_id': self.listing.id, 'quantity': 3}, format='json')

        response = self.client.post('/api/orders/checkout/', CHECKOUT_PAYLOAD, format='json')

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get()
        self.assertEqual(order.items.filter(kind='product').count(), 1)
        self.assertEqual(order.items.filter(kind='listing').count(), 1)
        self.assertEqual(order.subtotal, 2 * 50_000 + 3 * 200_000)
        product.refresh_from_db()
        self.listing.refresh_from_db()
        self.assertEqual(product.stock, 8)
        self.assertEqual(int(self.listing.quantity_available), 27)
        # Only the marketplace line generates a commission.
        self.assertEqual(FinancialLedgerEntry.objects.filter(owner_type='seller').count(), 1)

    def test_checkout_rejects_a_quantity_below_the_listing_minimum(self):
        listing = make_listing(self.storefront, minimum=10, quantity=50, title='حداقل بالا')
        self.client.post('/api/cart/add-listing/', {'listing_id': listing.id, 'quantity': 10}, format='json')
        # Lower the cart row underneath the minimum directly, simulating a stale
        # client that bypasses the cart endpoint's own validation.
        listing.min_order_quantity = 20
        listing.save(update_fields=['min_order_quantity'])

        response = self.client.post('/api/orders/checkout/', CHECKOUT_PAYLOAD, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('حداقل سفارش', response.data['error'])


class ListingConcurrencyTests(TransactionTestCase):
    """Real concurrent checkouts must never oversell a listing.

    Each buyer is authenticated and has their cart prepared *before* the
    threads start, so the only thing racing is the checkout transaction — which
    is exactly the code path under test. Building guest sessions concurrently
    would instead exercise SQLite's session-table locking and tell us nothing
    about stock reservation.
    """

    reset_sequences = True

    def test_two_simultaneous_checkouts_cannot_oversell(self):
        seller, storefront = make_seller()
        listing = make_listing(storefront, price=100_000, quantity=10)

        buyers = []
        for index in range(2):
            buyer = User.objects.create_user(
                username=f'racer-{index}', password='safe-password-123'
            )
            cart = Cart.objects.create(user=buyer)
            # Six units each: only one of the two can be satisfied from ten.
            CartItem.objects.create(cart=cart, listing=listing, quantity=6)
            buyers.append(buyer)

        results = []
        barrier = threading.Barrier(len(buyers))

        def buy(buyer):
            try:
                client = APIClient()
                client.force_authenticate(user=buyer)
                barrier.wait(timeout=15)
                response = client.post('/api/orders/checkout/', CHECKOUT_PAYLOAD, format='json')
                results.append(response.status_code)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=buy, args=(buyer,)) for buyer in buyers]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        listing.refresh_from_db()
        self.assertEqual(results.count(201), 1, f'unexpected results: {results}')
        self.assertEqual(results.count(409), 1, f'unexpected results: {results}')
        # Exactly one reservation of six was applied, never two.
        self.assertEqual(int(listing.quantity_available), 4)
        self.assertEqual(OrderItem.objects.filter(kind='listing').count(), 1)

    def test_concurrent_cart_additions_do_not_exceed_available_stock(self):
        seller, storefront = make_seller('stock-seller')
        listing = make_listing(storefront, quantity=10, minimum=1)
        buyer = User.objects.create_user(username='clicker', password='safe-password-123')
        Cart.objects.create(user=buyer)

        barrier = threading.Barrier(4)

        def add():
            try:
                client = APIClient()
                client.force_authenticate(user=buyer)
                barrier.wait(timeout=15)
                client.post(
                    '/api/cart/add-listing/', {'listing_id': listing.id, 'quantity': 4}, format='json'
                )
            except OperationalError:
                # SQLite allows a single writer, so a losing thread may be
                # refused outright. That is an acceptable outcome here: what
                # matters is that no thread manages to exceed the stock.
                pass
            finally:
                connections.close_all()

        threads = [threading.Thread(target=add) for _ in range(4)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        # Four concurrent clicks of four units must clamp at the ten available,
        # never accumulate to sixteen.
        item = CartItem.objects.get(cart__user=buyer, listing=listing)
        self.assertLessEqual(item.quantity, 10)


@override_settings(SECURE_SSL_REDIRECT=False)
class UserLevelTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_new_registration_starts_at_level_one(self):
        response = self.client.post('/api/auth/register/', {
            'username': 'newbuyer', 'password': 'safe-password-123',
            'password2': 'safe-password-123', 'email': 'a@b.com',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username='newbuyer')
        self.assertEqual(account_level(user), UserAccount.LEVEL_BUYER)

    def test_creating_a_storefront_promotes_the_owner_to_level_two(self):
        user = User.objects.create_user(username='farmer', password='safe-password-123')
        self.assertEqual(account_level(user), UserAccount.LEVEL_BUYER)

        Storefront.objects.create(user=user, name='غرفه من', slug='ghorfe-man')

        user.refresh_from_db()
        self.assertEqual(account_level(user), UserAccount.LEVEL_SELLER)

    def test_promotion_never_lowers_an_existing_level(self):
        user = User.objects.create_user(username='moderator', password='safe-password-123')
        account = user.account
        account.level = UserAccount.LEVEL_MODERATOR
        account.save(update_fields=['level'])

        Storefront.objects.create(user=user, name='غرفه ناظر', slug='ghorfe-nazer')

        account.refresh_from_db()
        self.assertEqual(account.level, UserAccount.LEVEL_MODERATOR)

    def test_superuser_is_owner_level(self):
        admin = User.objects.create_superuser(username='root', password='safe-password-123', email='r@x.com')

        self.assertEqual(account_level(admin), UserAccount.LEVEL_OWNER)

    def test_level_one_user_cannot_reach_the_management_console(self):
        user = User.objects.create_user(username='buyer', password='safe-password-123')
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/management/dashboard/')

        self.assertEqual(response.status_code, 403)

    def test_level_three_user_can_reach_the_management_console(self):
        user = User.objects.create_user(username='mod', password='safe-password-123', is_staff=True)
        user.account.level = UserAccount.LEVEL_MODERATOR
        user.account.save(update_fields=['level'])
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/management/dashboard/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['viewer_level'], UserAccount.LEVEL_MODERATOR)

    def test_owner_cannot_be_demoted_through_the_users_endpoint(self):
        owner = User.objects.create_superuser(username='owner', password='safe-password-123', email='o@x.com')
        target = User.objects.create_superuser(username='other-owner', password='safe-password-123', email='o2@x.com')
        self.client.force_authenticate(user=owner)

        response = self.client.patch(
            '/api/management/users/', {'username': target.username, 'level': 1}, format='json'
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(account_level(target), UserAccount.LEVEL_OWNER)

    def test_admin_cannot_grant_a_level_at_or_above_their_own(self):
        admin = User.objects.create_user(username='admin4', password='safe-password-123', is_staff=True)
        admin.account.level = UserAccount.LEVEL_ADMIN
        admin.account.save(update_fields=['level'])
        target = User.objects.create_user(username='target', password='safe-password-123')
        self.client.force_authenticate(user=admin)

        response = self.client.patch(
            '/api/management/users/', {'username': target.username, 'level': UserAccount.LEVEL_ADMIN}, format='json'
        )

        self.assertEqual(response.status_code, 403)

    def test_owner_can_promote_a_user_to_moderator(self):
        owner = User.objects.create_superuser(username='owner2', password='safe-password-123', email='o3@x.com')
        target = User.objects.create_user(username='promoteme', password='safe-password-123')
        self.client.force_authenticate(user=owner)

        response = self.client.patch(
            '/api/management/users/', {'username': target.username, 'level': UserAccount.LEVEL_MODERATOR}, format='json'
        )

        self.assertEqual(response.status_code, 200)
        target.refresh_from_db()
        self.assertEqual(account_level(target), UserAccount.LEVEL_MODERATOR)
        self.assertTrue(target.is_staff)


@override_settings(SECURE_SSL_REDIRECT=False)
class ModerationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.moderator = User.objects.create_superuser(
            username='mod-owner', password='safe-password-123', email='m@x.com'
        )
        self.seller, self.storefront = make_seller()
        self.listing = make_listing(self.storefront, status='pending_review')
        self.client.force_authenticate(user=self.moderator)

    def test_rejecting_a_listing_requires_a_reason(self):
        response = self.client.post(
            f'/api/management/moderate/listing/{self.listing.id}/', {'status': 'rejected'}, format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('reason', response.data['fields'])

    def test_rejection_reason_is_stored_and_visible_to_the_seller(self):
        self.client.post(
            f'/api/management/moderate/listing/{self.listing.id}/',
            {'status': 'rejected', 'reason': 'تصویر آگهی نامناسب است.'},
            format='json',
        )

        self.listing.refresh_from_db()
        self.assertEqual(self.listing.status, 'rejected')
        self.assertEqual(self.listing.rejection_reason, 'تصویر آگهی نامناسب است.')
        self.assertEqual(self.listing.reviewed_by_id, self.moderator.id)

        seller_client = APIClient()
        seller_client.force_authenticate(user=self.seller)
        response = seller_client.get('/api/marketplace/listings/mine/')
        self.assertEqual(response.data[0]['rejection_reason'], 'تصویر آگهی نامناسب است.')

    def test_moderation_writes_an_audit_log_entry(self):
        self.client.post(
            f'/api/management/moderate/listing/{self.listing.id}/',
            {'status': 'rejected', 'reason': 'اطلاعات ناقص است.'},
            format='json',
        )

        audit = self.client.get('/api/management/audit/')
        actions = [row['action'] for row in audit.data]
        self.assertIn('content_rejected', actions)

    def test_bulk_moderation_updates_every_selected_listing(self):
        second = make_listing(self.storefront, status='pending_review', title='آگهی دوم')

        response = self.client.post('/api/management/moderation/bulk/', {
            'content_type': 'listing',
            'ids': [self.listing.id, second.id],
            'status': 'published',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['updated'], 2)
        self.assertEqual(MarketplaceListing.objects.filter(status='published').count(), 2)

    def test_bulk_rejection_requires_a_reason(self):
        response = self.client.post('/api/management/moderation/bulk/', {
            'content_type': 'listing', 'ids': [self.listing.id], 'status': 'rejected',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_moderation_queue_is_paginated_and_filterable(self):
        for index in range(5):
            make_listing(self.storefront, status='pending_review', title=f'آگهی {index}')

        response = self.client.get('/api/management/moderation/queue/', {
            'type': 'listing', 'status': 'pending', 'page_size': 2,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 6)
        self.assertEqual(len(response.data['results']), 2)
        self.assertEqual(response.data['total_pages'], 3)

    def test_dashboard_surfaces_pending_listings_inline(self):
        response = self.client.get('/api/management/dashboard/')

        self.assertEqual(response.status_code, 200)
        titles = [row['title'] for row in response.data['pending_review']['listings']]
        self.assertIn(self.listing.title, titles)

    def test_a_level_one_user_cannot_moderate(self):
        buyer = User.objects.create_user(username='plainbuyer', password='safe-password-123')
        client = APIClient()
        client.force_authenticate(user=buyer)

        response = client.post(
            f'/api/management/moderate/listing/{self.listing.id}/', {'status': 'published'}, format='json'
        )

        self.assertEqual(response.status_code, 403)


@override_settings(SECURE_SSL_REDIRECT=False)
class StorefrontProfileTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.seller, self.storefront = make_seller()
        self.listing = make_listing(self.storefront)
        self.buyer = User.objects.create_user(username='buyer', password='safe-password-123')

    def test_public_profile_returns_listings_posts_and_counts(self):
        StorefrontPost.objects.create(
            storefront=self.storefront, post_type='post', caption='محصول تازه', status='published'
        )

        response = self.client.get(f'/api/marketplace/storefronts/{self.storefront.slug}/profile/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['storefront']['name'], self.storefront.name)
        self.assertEqual(response.data['counts']['listings'], 1)
        self.assertEqual(response.data['counts']['posts'], 1)

    def test_following_and_unfollowing_updates_the_counter(self):
        self.client.force_authenticate(user=self.buyer)
        url = f'/api/marketplace/storefronts/{self.storefront.slug}/follow/'

        follow = self.client.post(url)
        self.assertEqual(follow.status_code, 200)
        self.assertTrue(follow.data['is_following'])
        self.assertEqual(follow.data['followers_count'], 1)

        unfollow = self.client.delete(url)
        self.assertFalse(unfollow.data['is_following'])
        self.assertEqual(unfollow.data['followers_count'], 0)

    def test_following_twice_is_idempotent(self):
        self.client.force_authenticate(user=self.buyer)
        url = f'/api/marketplace/storefronts/{self.storefront.slug}/follow/'

        self.client.post(url)
        self.client.post(url)

        self.assertEqual(StorefrontFollow.objects.count(), 1)

    def test_a_seller_cannot_follow_their_own_storefront(self):
        self.client.force_authenticate(user=self.seller)

        response = self.client.post(f'/api/marketplace/storefronts/{self.storefront.slug}/follow/')

        self.assertEqual(response.status_code, 400)

    def test_followed_storefronts_are_listed_for_the_buyer(self):
        StorefrontFollow.objects.create(storefront=self.storefront, user=self.buyer)
        self.client.force_authenticate(user=self.buyer)

        response = self.client.get('/api/marketplace/following/')

        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['storefront']['slug'], self.storefront.slug)

    def test_directory_includes_storefronts_without_listings(self):
        _, empty = make_seller('empty-seller')

        response = self.client.get('/api/marketplace/storefronts/')

        slugs = [row['slug'] for row in response.data['results']]
        self.assertIn(empty.slug, slugs)

    def test_directory_filters_by_province_and_seller_type(self):
        other_user, other = make_seller('northern')
        other.province = 'گیلان'
        other.seller_type = 'cooperative'
        other.save(update_fields=['province', 'seller_type'])

        by_province = self.client.get('/api/marketplace/storefronts/', {'province': 'گیلان'})
        by_type = self.client.get('/api/marketplace/storefronts/', {'seller_type': 'cooperative'})

        self.assertEqual([row['slug'] for row in by_province.data['results']], [other.slug])
        self.assertEqual([row['slug'] for row in by_type.data['results']], [other.slug])

    def test_directory_is_paginated(self):
        for index in range(15):
            make_seller(f'bulk-{index}')

        response = self.client.get('/api/marketplace/storefronts/', {'page_size': 5})

        self.assertEqual(len(response.data['results']), 5)
        self.assertEqual(response.data['count'], 16)

    def test_highlights_can_be_created_by_the_owner(self):
        story = StorefrontPost.objects.create(
            storefront=self.storefront, post_type='story', caption='استوری', status='published'
        )
        self.client.force_authenticate(user=self.seller)

        response = self.client.post('/api/marketplace/highlights/', {
            'title': 'برداشت امسال', 'post_ids': [story.id],
        }, format='json')

        self.assertEqual(response.status_code, 201)
        highlight = StorefrontHighlight.objects.get()
        self.assertEqual(highlight.items.count(), 1)

    def test_a_seller_cannot_highlight_another_storefronts_story(self):
        other_user, other = make_seller('rival')
        story = StorefrontPost.objects.create(
            storefront=other, post_type='story', caption='مال دیگری', status='published'
        )
        self.client.force_authenticate(user=self.seller)

        response = self.client.post('/api/marketplace/highlights/', {
            'title': 'دزدی', 'post_ids': [story.id],
        }, format='json')

        self.assertEqual(response.status_code, 400)


@override_settings(SECURE_SSL_REDIRECT=False)
class StorefrontNamingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='namer', password='safe-password-123')

    def test_availability_endpoint_reports_a_free_name(self):
        response = self.client.get('/api/marketplace/storefront/availability/', {'name': 'باغ سبز'})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['name']['available'])
        self.assertTrue(response.data['slug']['available'])

    def test_availability_endpoint_reports_a_taken_name(self):
        make_seller('taken')
        Storefront.objects.filter(user__username='taken').update(name='باغ سبز', slug='bagh-sabz')

        response = self.client.get('/api/marketplace/storefront/availability/', {'name': 'باغ سبز'})

        self.assertFalse(response.data['name']['available'])
        self.assertIn('قبلاً', response.data['name']['reason'])

    def test_availability_suggests_an_alternative_slug(self):
        make_seller('slugowner')
        Storefront.objects.filter(user__username='slugowner').update(slug='بهار')

        response = self.client.get('/api/marketplace/storefront/availability/', {'slug': 'بهار'})

        self.assertFalse(response.data['slug']['available'])
        self.assertEqual(response.data['slug']['suggestion'], 'بهار-2')

    def test_case_insensitive_duplicate_names_are_rejected(self):
        make_seller('first')
        Storefront.objects.filter(user__username='first').update(name='Green Farm')
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/marketplace/storefront/', {
            'name': 'green farm', 'seller_type': 'farmer',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data['fields'])

    def test_storefront_slug_is_generated_from_a_persian_name(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/api/marketplace/storefront/', {
            'name': 'گلخانه بهاران', 'seller_type': 'farmer',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'گلخانه-بهاران')

    def test_listing_slug_is_generated_and_deduplicated(self):
        seller, storefront = make_seller('lister')
        self.client.force_authenticate(user=seller)
        payload = {
            'title': 'گندم تازه', 'crop_name': 'گندم', 'description': 'محصول سالم',
            'price': 100000, 'unit': 'کیلوگرم', 'quantity_available': 10, 'min_order_quantity': 1,
        }

        first = self.client.post('/api/marketplace/listings/', payload, format='json')
        second = self.client.post('/api/marketplace/listings/', payload, format='json')

        self.assertEqual(first.data['slug'], 'گندم-تازه')
        self.assertEqual(second.data['slug'], 'گندم-تازه-2')

    def test_min_order_quantity_cannot_exceed_available_quantity(self):
        seller, storefront = make_seller('badmin')
        self.client.force_authenticate(user=seller)

        response = self.client.post('/api/marketplace/listings/', {
            'title': 'ذرت', 'crop_name': 'ذرت', 'description': 'محصول',
            'price': 50000, 'unit': 'کیلوگرم', 'quantity_available': 5, 'min_order_quantity': 20,
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('min_order_quantity', response.data['fields'])


@override_settings(SECURE_SSL_REDIRECT=False)
class LocationApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        from django.core.management import call_command

        call_command('seed_locations', verbosity=0)

    def test_all_provinces_are_seeded(self):
        response = self.client.get('/api/locations/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 31)

    def test_cities_can_be_listed_for_a_province(self):
        response = self.client.get('/api/locations/', {'province': 'فارس'})

        self.assertEqual(response.status_code, 200)
        names = [row['name'] for row in response.data['results']]
        self.assertIn('شیراز', names)
        self.assertTrue(all(row['kind'] == 'city' for row in response.data['results']))

    def test_unknown_province_returns_404(self):
        response = self.client.get('/api/locations/', {'province': 'ناکجاآباد'})

        self.assertEqual(response.status_code, 404)

    def test_search_matches_both_provinces_and_cities(self):
        response = self.client.get('/api/locations/', {'search': 'اصفهان'})

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['count'], 1)

    def test_every_city_belongs_to_a_province(self):
        orphans = Location.objects.filter(kind='city', parent__isnull=True).count()

        self.assertEqual(orphans, 0)


@override_settings(SECURE_SSL_REDIRECT=False)
class AgriCalculatorTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        from django.core.management import call_command

        call_command('seed_agri_inputs', verbosity=0)

    def test_inputs_can_be_searched_by_name(self):
        response = self.client.get('/api/agri/inputs/', {'search': 'اوره'})

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['name'], 'اوره')

    def test_inputs_can_be_filtered_to_pesticides(self):
        response = self.client.get('/api/agri/inputs/', {'kind': 'pesticide'})

        kinds = {row['kind'] for row in response.data['results']}
        self.assertEqual(kinds, {'pesticide'})

    def test_calculation_uses_the_registered_dose_range(self):
        urea = AgriInput.objects.get(name='اوره')

        response = self.client.post('/api/agri/calculate/', {
            'input_id': urea.id, 'crop': 'گندم', 'area': 5, 'area_unit': 'hectare',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        # The registered range is 150-250 kg/ha, so five hectares needs 750-1250.
        self.assertEqual(response.data['total']['min'], '750.000')
        self.assertEqual(response.data['total']['max'], '1250.000')

    def test_area_units_are_converted_to_hectares(self):
        urea = AgriInput.objects.get(name='اوره')

        response = self.client.post('/api/agri/calculate/', {
            'input_id': urea.id, 'crop': 'گندم', 'area': 10000, 'area_unit': 'square_meter',
        }, format='json')

        # 10,000 m² is exactly one hectare.
        self.assertEqual(response.data['area']['hectares'], '1.0000')
        self.assertEqual(response.data['total']['min'], '150.000')

    def test_unregistered_crop_is_refused_rather_than_guessed(self):
        urea = AgriInput.objects.get(name='اوره')

        response = self.client.post('/api/agri/calculate/', {
            'input_id': urea.id, 'crop': 'کاکتوس فضایی', 'area': 1, 'area_unit': 'hectare',
        }, format='json')

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['code'], 'dose_not_registered')

    def test_pesticide_results_include_safety_warnings(self):
        pesticide = AgriInput.objects.get(name='ایمیداکلوپراید')

        response = self.client.post('/api/agri/calculate/', {
            'input_id': pesticide.id, 'crop': 'گندم', 'area': 2, 'area_unit': 'hectare',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        warnings = ' '.join(response.data['warnings'])
        self.assertIn('ماسک', warnings)
        self.assertIn('کارنس', warnings)

    def test_invalid_area_returns_field_level_errors(self):
        urea = AgriInput.objects.get(name='اوره')

        response = self.client.post('/api/agri/calculate/', {
            'input_id': urea.id, 'crop': 'گندم', 'area': -3, 'area_unit': 'hectare',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('area', response.data['fields'])

    def test_every_seeded_dose_has_a_sane_range(self):
        invalid = AgriInputDose.objects.filter(min_rate__gt=models_max_rate()).count()

        self.assertEqual(invalid, 0)


def models_max_rate():
    from django.db.models import F

    return F('max_rate')


@override_settings(SECURE_SSL_REDIRECT=False)
class AvatarTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='avataruser', password='safe-password-123')
        self.client.force_authenticate(user=self.user)

    def _image(self, name='avatar.png', size=(128, 128), fmt='PNG'):
        from io import BytesIO

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buffer = BytesIO()
        Image.new('RGB', size, 'green').save(buffer, format=fmt)
        buffer.seek(0)
        content_type = 'image/png' if fmt == 'PNG' else 'image/jpeg'
        return SimpleUploadedFile(name, buffer.read(), content_type=content_type)

    def test_avatar_can_be_uploaded_and_returned(self):
        response = self.client.post(
            '/api/profile/avatar/', {'avatar': self._image()}, format='multipart'
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['avatar_url'])
        self.user.account.refresh_from_db()
        self.assertTrue(self.user.account.avatar)

    def test_avatar_can_be_removed(self):
        self.client.post('/api/profile/avatar/', {'avatar': self._image()}, format='multipart')

        response = self.client.delete('/api/profile/avatar/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['avatar_url'], '')

    def test_tiny_images_are_rejected(self):
        response = self.client.post(
            '/api/profile/avatar/', {'avatar': self._image(size=(16, 16))}, format='multipart'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('avatar', response.data['fields'])

    def test_non_image_uploads_are_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        bad = SimpleUploadedFile('payload.txt', b'not-an-image', content_type='text/plain')

        response = self.client.post('/api/profile/avatar/', {'avatar': bad}, format='multipart')

        self.assertEqual(response.status_code, 400)

    def test_missing_file_returns_a_field_error(self):
        response = self.client.post('/api/profile/avatar/', {}, format='multipart')

        self.assertEqual(response.status_code, 400)
        self.assertIn('avatar', response.data['fields'])


@override_settings(SECURE_SSL_REDIRECT=False)
class ErrorEnvelopeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_validation_errors_are_field_level(self):
        response = self.client.post('/api/orders/checkout/', {'customer_name': ''}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'validation_error')
        self.assertIn('fields', response.data)
        self.assertIn('phone', response.data['fields'])

    def test_not_found_uses_the_persian_envelope(self):
        response = self.client.get('/api/products/does-not-exist/')

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['code'], 'not_found')
        self.assertIn('پیدا نشد', response.data['error'])

    def test_permission_denied_uses_the_persian_envelope(self):
        user = User.objects.create_user(username='nobody', password='safe-password-123')
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/management/dashboard/')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'permission_denied')
        self.assertTrue(response.data['error'])

    def test_unauthenticated_access_uses_the_persian_envelope(self):
        response = self.client.get('/api/orders/mine/')

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['code'], 'authentication_required')


@override_settings(
    SECURE_SSL_REDIRECT=False,
    # Throttling needs a real cache; the runner installs a dummy one globally.
    CACHES={'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'throttle-tests',
    }},
    REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': [
            'shop.authentication.CookieTokenAuthentication',
            'rest_framework.authentication.SessionAuthentication',
        ],
        'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
        'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
        'PAGE_SIZE': 12,
        'EXCEPTION_HANDLER': 'shop.exception_handlers.api_exception_handler',
        'DEFAULT_THROTTLE_RATES': {
            'anon': '1000/hour', 'user': '1000/hour', 'login': '3/min',
            'register': '1000/hour', 'search': '1000/min', 'checkout': '1000/hour',
            'upload': '1000/hour', 'feedback': '1000/hour',
        },
    },
)
class ThrottleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        from django.core.cache import cache

        cache.clear()
        # DRF resolves a throttle's rate once, when the class is first
        # instantiated, and memoises it on the class. override_settings alone
        # therefore cannot lower the limit, so the cached values are reset here
        # and restored in tearDown.
        from .throttling import LoginRateThrottle

        self._original_rate = getattr(LoginRateThrottle, 'rate', None)
        LoginRateThrottle.rate = '3/min'

    def tearDown(self):
        from django.core.cache import cache

        from .throttling import LoginRateThrottle

        if self._original_rate is None:
            del LoginRateThrottle.rate
        else:
            LoginRateThrottle.rate = self._original_rate
        cache.clear()

    def test_login_is_throttled_separately_with_a_persian_message(self):
        payload = {'username': 'ghost', 'password': 'wrong-password'}

        statuses = [
            self.client.post('/api/auth/login/', payload, format='json').status_code
            for _ in range(4)
        ]

        self.assertEqual(statuses[:3], [401, 401, 401])
        self.assertEqual(statuses[3], 429)

    def test_throttled_response_carries_retry_after_and_persian_copy(self):
        payload = {'username': 'ghost', 'password': 'wrong-password'}
        for _ in range(3):
            self.client.post('/api/auth/login/', payload, format='json')

        response = self.client.post('/api/auth/login/', payload, format='json')

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data['code'], 'throttled')
        self.assertIn('بیش از حد مجاز', response.data['error'])
        self.assertIn('Retry-After', response)

    def test_exhausting_login_does_not_block_the_catalogue(self):
        payload = {'username': 'ghost', 'password': 'wrong-password'}
        for _ in range(4):
            self.client.post('/api/auth/login/', payload, format='json')

        response = self.client.get('/api/products/')

        self.assertEqual(response.status_code, 200)


@override_settings(SECURE_SSL_REDIRECT=False)
class FinanceLedgerTests(TestCase):
    """The seller-facing ledger: references, filters and CSV export."""

    def setUp(self):
        self.client = APIClient()
        self.seller, self.storefront = make_seller(commission=10)
        self.listing = make_listing(self.storefront, price=200_000, quantity=30)

        buyer = APIClient()
        buyer.post(
            '/api/cart/add-listing/', {'listing_id': self.listing.id, 'quantity': 4}, format='json'
        )
        buyer.post('/api/orders/checkout/', CHECKOUT_PAYLOAD, format='json')
        self.order = Order.objects.get()
        self.client.force_authenticate(user=self.seller)

    def test_ledger_entries_expose_a_stable_reference(self):
        response = self.client.get('/api/marketplace/finance/')

        self.assertEqual(response.status_code, 200)
        entry = response.data['entries'][0]
        self.assertTrue(entry['reference'].startswith('GKF-'))
        self.assertEqual(entry['order_code'], self.order.code)

    def test_ledger_can_be_filtered_by_status(self):
        response = self.client.get('/api/marketplace/finance/', {'status': 'available'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)

        # Balances are deliberately computed over the whole ledger, so a filter
        # that matches nothing must not zero the pending balance.
        self.assertGreater(response.data['balances']['pending'], 0)

    def test_ledger_can_be_filtered_by_entry_type(self):
        response = self.client.get('/api/marketplace/finance/', {'entry_type': 'sale'})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(row['entry_type'] == 'sale' for row in response.data['entries']))

    def test_ledger_search_matches_the_order_code(self):
        response = self.client.get('/api/marketplace/finance/', {'search': self.order.code})

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.data['count'], 1)

    def test_ledger_is_paginated(self):
        response = self.client.get('/api/marketplace/finance/', {'page_size': 1})

        self.assertEqual(len(response.data['entries']), 1)
        self.assertIn('total_pages', response.data)

    def test_csv_export_returns_a_utf8_file_with_a_bom(self):
        response = self.client.get('/api/marketplace/finance/export/')

        self.assertEqual(response.status_code, 200)
        self.assertIn('text/csv', response['Content-Type'])
        self.assertIn('attachment;', response['Content-Disposition'])
        body = response.content.decode('utf-8')
        # Excel on Windows needs the BOM to read Persian text correctly.
        self.assertTrue(body.startswith('\ufeff'))
        self.assertIn('شناسه تراکنش', body)
        self.assertIn(self.order.code, body)

    def test_csv_export_is_written_to_the_audit_log(self):
        self.client.get('/api/marketplace/finance/export/')

        self.assertTrue(AdminAuditLog.objects.filter(action='finance_exported').exists())

    def test_a_seller_cannot_see_another_storefronts_ledger(self):
        other_user, other = make_seller('rival-seller')
        client = APIClient()
        client.force_authenticate(user=other_user)

        response = client.get('/api/marketplace/finance/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)


@override_settings(SECURE_SSL_REDIRECT=False)
class StorefrontImageTests(TestCase):
    """A seller sets their own shop avatar and cover."""

    def setUp(self):
        self.client = APIClient()
        self.seller, self.storefront = make_seller('image-seller')
        self.client.force_authenticate(user=self.seller)

    def _image(self, size=(200, 200)):
        from io import BytesIO

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buffer = BytesIO()
        Image.new('RGB', size, 'green').save(buffer, format='PNG')
        buffer.seek(0)
        return SimpleUploadedFile('shop.png', buffer.read(), content_type='image/png')

    def test_seller_can_upload_a_storefront_avatar(self):
        response = self.client.patch(
            '/api/marketplace/storefront/', {'avatar': self._image()}, format='multipart'
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['avatar_url'])

    def test_undersized_storefront_images_are_rejected(self):
        response = self.client.patch(
            '/api/marketplace/storefront/', {'avatar': self._image(size=(20, 20))}, format='multipart'
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('avatar', response.data['fields'])

    def test_non_image_storefront_upload_is_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        bad = SimpleUploadedFile('x.txt', b'nope', content_type='text/plain')
        response = self.client.patch(
            '/api/marketplace/storefront/', {'avatar': bad}, format='multipart'
        )

        self.assertEqual(response.status_code, 400)


@override_settings(SECURE_SSL_REDIRECT=False)
class SellerRejectionVisibilityTests(TestCase):
    """A rejected listing must tell its owner why."""

    def test_seller_sees_the_reason_and_can_resubmit(self):
        moderator = User.objects.create_superuser(
            username='mod-vis', password='safe-password-123', email='mv@x.com'
        )
        seller, storefront = make_seller('rejected-seller')
        listing = make_listing(storefront, status='pending_review')

        staff = APIClient()
        staff.force_authenticate(user=moderator)
        staff.post(
            f'/api/management/moderate/listing/{listing.id}/',
            {'status': 'rejected', 'reason': 'تصویر محصول واضح نیست.'},
            format='json',
        )

        seller_client = APIClient()
        seller_client.force_authenticate(user=seller)
        mine = seller_client.get('/api/marketplace/listings/mine/')
        self.assertEqual(mine.data[0]['status'], 'rejected')
        self.assertEqual(mine.data[0]['rejection_reason'], 'تصویر محصول واضح نیست.')

        # Editing clears the stale reason and returns the listing to the queue.
        updated = seller_client.patch(
            f'/api/marketplace/listings/{listing.slug}/',
            {'description': 'توضیحات کامل‌تر با تصویر جدید'},
            format='json',
        )
        self.assertEqual(updated.status_code, 200)
        listing.refresh_from_db()
        self.assertEqual(listing.status, 'pending_review')
        self.assertEqual(listing.rejection_reason, '')


@override_settings(SECURE_SSL_REDIRECT=False)
class QueryEfficiencyTests(TestCase):
    """Guard against N+1 regressions on the list endpoints.

    A count assertion is deliberately loose (an upper bound, not an exact
    number) so ordinary refactors do not fail the suite — but it still catches
    the thing that matters: a query count that grows with the number of rows.
    """

    @classmethod
    def setUpTestData(cls):
        for index in range(8):
            _, storefront = make_seller(f'perf-{index}')
            make_listing(storefront, title=f'محصول {index}')

    def test_listing_queries_do_not_grow_with_row_count(self):
        # Two pages of different sizes must cost the same number of queries.
        with self.assertNumQueries(self._count_for('/api/marketplace/listings/?page_size=2')):
            self.client.get('/api/marketplace/listings/?page_size=8')

    def _count_for(self, url):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as captured:
            self.client.get(url)
        return len(captured)

    def test_listing_endpoint_stays_under_a_query_budget(self):
        queries = self._count_for('/api/marketplace/listings/')
        self.assertLess(queries, 10, f'listing endpoint used {queries} queries')

    def test_storefront_directory_stays_under_a_query_budget(self):
        queries = self._count_for('/api/marketplace/storefronts/')
        self.assertLess(queries, 10, f'storefront directory used {queries} queries')

    def test_page_size_is_honoured_and_capped(self):
        small = self.client.get('/api/marketplace/listings/?page_size=3')
        self.assertEqual(len(small.data['results']), 3)

        # An absurd page size must be clamped, never used to dump the table.
        huge = self.client.get('/api/marketplace/listings/?page_size=100000')
        self.assertLessEqual(len(huge.data['results']), 48)
