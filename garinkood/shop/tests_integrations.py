"""Regression tests for optional integrations and operational boundaries."""

from datetime import timedelta
import hashlib
from unittest.mock import patch

from django.contrib.auth.models import Permission, User
from django.core import checks
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from tablib import Dataset
from waffle.models import Flag
from axes.models import AccessAttempt
from axes.utils import reset as reset_axes

from .admin import make_published
from .checks import integration_configuration_check
from .models import (
    AdminAuditLog,
    Category,
    Coupon,
    NotificationDelivery,
    Order,
    OrderItem,
    PaymentAttempt,
    Product,
    Shipment,
    ShipmentTrackingEvent,
    WalletTransaction,
    WebPushSubscription,
)
from .payments import start_zarinpal_payment, verify_zarinpal_payment
from .resources import ProductResource
from .shipping import record_tracking_event


class IntegrationFixtureMixin:
    def make_user(self, username='buyer', **kwargs):
        return User.objects.create_user(username=username, password='A-strong-password-123', **kwargs)

    def make_order(self, *, user=None, status='awaiting_review', payment_status='unpaid'):
        return Order.objects.create(
            user=user,
            customer_name='خریدار آزمون',
            phone='09121234567',
            email='buyer@example.com',
            province='تهران',
            city='تهران',
            address='نشانی آزمون',
            subtotal=200_000,
            shipping_price=20_000,
            total_price=220_000,
            payment_method='zarinpal',
            status=status,
            payment_status=payment_status,
        )


class FakeZarinpalClient:
    is_ready = True

    def __init__(self):
        self.request_count = 0
        self.verify_count = 0

    def request_payment(self, attempt, callback_url):
        self.request_count += 1
        self.last_request = {
            'amount': attempt.amount,
            'currency': attempt.currency,
            'callback_url': callback_url,
        }
        return {
            'authority': 'A000000000000000000000000000000001',
            'body': {'data': {'code': 100, 'authority': 'A000000000000000000000000000000001'}},
        }

    def verify_payment(self, attempt):
        self.verify_count += 1
        return {'code': 100, 'data': {'ref_id': 12345}, 'body': {'data': {'code': 100}}}

    def checkout_url(self, authority):
        return f'https://payment.example.invalid/start/{authority}'


class PaymentLifecycleTests(IntegrationFixtureMixin, TestCase):
    def test_start_reuses_pending_authority_and_preserves_history(self):
        order = self.make_order()
        client = FakeZarinpalClient()

        first = start_zarinpal_payment(order, client=client)
        second = start_zarinpal_payment(order, client=client)

        self.assertEqual(first.pk, second.pk)
        self.assertEqual(client.request_count, 1)
        self.assertEqual(client.last_request['amount'], order.total_price)
        self.assertEqual(client.last_request['currency'], 'IRT')
        first.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(first.status, 'pending')
        self.assertEqual(order.payment_status, 'pending')
        self.assertIn('pending', set(first.history.values_list('status', flat=True)))
        self.assertIn('pending', set(order.history.values_list('payment_status', flat=True)))

    def test_verification_is_locally_idempotent(self):
        user = self.make_user()
        order = self.make_order(user=user)
        attempt = PaymentAttempt.objects.create(
            order=order,
            provider='zarinpal',
            status='pending',
            amount=order.total_price,
            currency='IRT',
            idempotency_key='verify-idempotency-key',
            external_reference='A000000000000000000000000000000002',
        )
        client = FakeZarinpalClient()

        paid_attempt, newly_paid = verify_zarinpal_payment(attempt.external_reference, client=client)
        replayed_attempt, replay_was_new = verify_zarinpal_payment(attempt.external_reference, client=client)

        order.refresh_from_db()
        self.assertTrue(newly_paid)
        self.assertFalse(replay_was_new)
        self.assertEqual(paid_attempt.pk, replayed_attempt.pk)
        self.assertEqual(client.verify_count, 1)
        self.assertEqual(order.payment_status, 'paid')
        self.assertEqual(order.status, 'confirmed')
        self.assertEqual(Coupon.objects.filter(issued_to_user=user).count(), 1)
        self.assertEqual(WalletTransaction.objects.filter(order=order).count(), 1)
        self.assertIn('processing', set(attempt.history.values_list('status', flat=True)))
        self.assertIn('paid', set(attempt.history.values_list('status', flat=True)))

    def test_active_payment_prevents_stock_restoration(self):
        author = self.make_user('author')
        product = Product.objects.create(
            title='کود آزمون', slug='payment-cancel-product', author=author,
            description='توضیح', status='published', price=100_000, stock=8,
        )
        order = self.make_order()
        OrderItem.objects.create(
            order=order, product=product, product_title=product.title,
            product_slug=product.slug, unit_price=product.price, quantity=2,
        )
        attempt = PaymentAttempt.objects.create(
            order=order, provider='zarinpal', status='pending', amount=order.total_price,
            currency='IRT', idempotency_key='cancel-active-key',
        )

        with self.assertRaises(ValueError):
            order.cancel_and_restore_stock()
        product.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(product.stock, 8)
        self.assertNotEqual(order.status, 'cancelled')

        attempt.status = 'failed'
        attempt.save(update_fields=['status', 'updated_at'])
        order.cancel_and_restore_stock()
        product.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(product.stock, 10)
        self.assertEqual(order.status, 'cancelled')


class ShipmentSynchronizationTests(IntegrationFixtureMixin, TestCase):
    def test_admin_created_events_sync_and_stale_events_do_not_regress(self):
        order = self.make_order(status='confirmed')
        shipment = Shipment.objects.create(order=order, provider='manual', status='pending')
        now = timezone.now()

        ShipmentTrackingEvent.objects.create(
            shipment=shipment, status='in_transit', description='در مسیر', occurred_at=now,
        )
        shipment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(shipment.status, 'in_transit')
        self.assertEqual(order.status, 'shipped')
        self.assertEqual(shipment.shipped_at, now)

        ShipmentTrackingEvent.objects.create(
            shipment=shipment, status='ready', description='رویداد قدیمی',
            occurred_at=now - timedelta(days=1),
        )
        shipment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(shipment.status, 'in_transit')
        self.assertEqual(order.status, 'shipped')

        ShipmentTrackingEvent.objects.create(
            shipment=shipment, status='delivered', description='تحویل شد',
            occurred_at=now + timedelta(hours=1),
        )
        shipment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(shipment.status, 'delivered')
        self.assertEqual(order.status, 'delivered')
        self.assertIsNotNone(shipment.delivered_at)
        self.assertIn('delivered', set(shipment.history.values_list('status', flat=True)))
        self.assertIn('delivered', set(order.history.values_list('status', flat=True)))

    def test_provider_event_id_is_idempotent(self):
        shipment = Shipment.objects.create(order=self.make_order(), provider='manual')
        first = record_tracking_event(
            shipment, status='ready', description='آماده', provider_event_id='carrier-123',
        )
        second = record_tracking_event(
            shipment, status='ready', description='تکراری', provider_event_id='carrier-123',
        )
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(shipment.events.count(), 1)


@override_settings(
    WEBPUSH_ENABLED=True,
    WEBPUSH_VAPID_PUBLIC_KEY='public-test-key',
    WEBPUSH_VAPID_PRIVATE_KEY='private-test-key',
    WEBPUSH_VAPID_SUBJECT='mailto:ops@example.invalid',
)
class WebPushOwnershipTests(IntegrationFixtureMixin, TestCase):
    def setUp(self):
        self.user = self.make_user()
        self.other = self.make_user('other')
        self.client = APIClient()
        Flag.objects.create(name='web_push', everyone=True)
        self.payload = {
            'subscription': {
                'endpoint': 'https://push.example.invalid/subscription/capability-token',
                'keys': {'p256dh': 'browser-public-key', 'auth': 'browser-auth-secret'},
            }
        }

    def test_response_uses_fingerprint_and_delete_is_owner_scoped(self):
        self.client.force_authenticate(self.user)
        created = self.client.post('/api/notifications/webpush/', self.payload, format='json')
        self.assertEqual(created.status_code, 201)
        subscription_id = created.data['id']
        fingerprint = hashlib.sha256(
            self.payload['subscription']['endpoint'].encode('utf-8')
        ).hexdigest()[:24]
        self.assertEqual(created.data['endpoint_fingerprint'], fingerprint)
        self.assertNotIn('endpoint', created.data)
        self.assertNotIn('p256dh', created.data)
        self.assertNotIn('auth', created.data)

        listed = self.client.get('/api/notifications/webpush/')
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data['subscriptions'][0]['endpoint_fingerprint'], fingerprint)

        self.client.force_authenticate(self.other)
        denied = self.client.delete(
            '/api/notifications/webpush/', {'id': subscription_id}, format='json'
        )
        self.assertEqual(denied.status_code, 404)
        self.assertTrue(WebPushSubscription.objects.filter(pk=subscription_id).exists())

        self.client.force_authenticate(self.user)
        removed = self.client.delete(
            '/api/notifications/webpush/', {'id': subscription_id}, format='json'
        )
        self.assertEqual(removed.status_code, 204)
        self.assertFalse(WebPushSubscription.objects.filter(pk=subscription_id).exists())

    def test_status_transition_enqueues_push_once(self):
        subscription = WebPushSubscription.objects.create(
            user=self.user,
            endpoint=self.payload['subscription']['endpoint'],
            p256dh='browser-public-key',
            auth='browser-auth-secret',
        )
        order = self.make_order(user=self.user)
        order.status = 'confirmed'
        order.save(update_fields=['status', 'updated_at'])
        order.save(update_fields=['status', 'updated_at'])

        deliveries = NotificationDelivery.objects.filter(
            order=order, channel='webpush', event='order_status_changed'
        )
        self.assertEqual(deliveries.count(), 1)
        self.assertEqual(deliveries.get().recipient, str(subscription.pk))


class FeatureAndSearchFallbackTests(IntegrationFixtureMixin, TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_only_allowlisted_request_aware_flags_are_exposed(self):
        Flag.objects.create(name='external_search', everyone=True)
        Flag.objects.create(name='internal_secret_rollout', everyone=True)
        response = self.client.get('/api/features/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data['flags']),
            {'web_push', 'external_search', 'carrier_quotes', 'privacy_analytics'},
        )
        self.assertTrue(response.data['flags']['external_search'])
        self.assertNotIn('internal_secret_rollout', response.data['flags'])

    @override_settings(
        MEILISEARCH_ENABLED=True,
        MEILISEARCH_URL='https://search.example.invalid',
        MEILISEARCH_API_KEY='test-key',
        MEILISEARCH_PRODUCTS_INDEX='products',
        MEILISEARCH_TIMEOUT_SECONDS=1,
    )
    @patch('meilisearch.Client', side_effect=RuntimeError('provider unavailable'))
    def test_external_search_failure_falls_back_to_orm(self, _client):
        Flag.objects.create(name='external_search', everyone=True)
        author = self.make_user('catalog-author')
        Product.objects.create(
            title='کود آهن ویژه', slug='iron-fertilizer-search', author=author,
            description='برای باغ', status='published', price=50_000, stock=3,
        )
        Product.objects.create(
            title='بذر گندم', slug='wheat-seed-search', author=author,
            description='کشت پاییزه', status='published', price=70_000, stock=3,
        )

        response = self.client.get('/api/products/', {'search': 'آهن'})
        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.data['results']]
        self.assertEqual(titles, ['کود آهن ویژه'])


class TrackingIngestionPermissionTests(IntegrationFixtureMixin, TestCase):
    def setUp(self):
        self.user = self.make_user()
        self.operator = self.make_user('warehouse-operator')
        permission = Permission.objects.get(
            content_type__app_label='shop', codename='add_shipmenttrackingevent'
        )
        self.operator.user_permissions.add(permission)
        self.shipment = Shipment.objects.create(order=self.make_order(), provider='manual')
        self.url = reverse(
            'management_shipment_tracking_event', kwargs={'shipment_id': self.shipment.pk}
        )
        self.client = APIClient()
        self.payload = {
            'status': 'in_transit',
            'description': 'تحویل به مسیر توزیع',
            'location': 'تهران',
            'provider_event_id': 'manual-import-1',
        }

    def test_customer_cannot_write_tracking_but_authorized_operator_can(self):
        self.client.force_authenticate(self.user)
        denied = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(ShipmentTrackingEvent.objects.count(), 0)

        self.client.force_authenticate(self.operator)
        created = self.client.post(self.url, self.payload, format='json')
        replayed = self.client.post(self.url, self.payload, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(replayed.status_code, 200)
        self.assertEqual(ShipmentTrackingEvent.objects.count(), 1)
        self.shipment.refresh_from_db()
        self.assertEqual(self.shipment.status, 'in_transit')
        self.assertEqual(
            AdminAuditLog.objects.filter(action='shipment_tracking_recorded').count(), 2
        )


class OperationalEndpointTests(TransactionTestCase):
    def setUp(self):
        self.client = Client()

    def test_liveness_is_public_but_readiness_and_metrics_are_hidden(self):
        live = self.client.get(reverse('health-live'))
        self.assertEqual(live.status_code, 200)
        self.assertEqual(live.json(), {'status': 'ok'})
        self.assertIn('no-cache', live.headers['Cache-Control'])

        ready = self.client.get(reverse('health-ready'))
        metrics = self.client.get(reverse('prometheus-metrics'))
        self.assertEqual(ready.status_code, 404)
        self.assertEqual(metrics.status_code, 404)
        self.assertEqual(ready.headers['Cache-Control'], 'no-store')
        self.assertIn('no-store', metrics.headers['Cache-Control'])

    @override_settings(
        OPERATIONS_TOKEN='a-high-entropy-test-token',
        CACHES={
            'default': {
                'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'readiness-test',
            }
        },
    )
    def test_operations_token_grants_readiness_and_metrics(self):
        headers = {'HTTP_AUTHORIZATION': 'Bearer a-high-entropy-test-token'}
        ready = self.client.get(reverse('health-ready'), **headers)
        metrics = self.client.get(reverse('prometheus-metrics'), **headers)
        self.assertEqual(ready.status_code, 200, ready.content.decode('utf-8', errors='replace'))
        self.assertEqual(metrics.status_code, 200)
        self.assertIn(b'garinkood_catalogue_search_total', metrics.content)
        self.assertEqual(ready.headers['Cache-Control'], 'no-store')

    def test_api_documentation_requires_staff_session(self):
        self.assertIn(self.client.get(reverse('api-schema')).status_code, {401, 403})
        staff = User.objects.create_user('docs-staff', password='strong-password', is_staff=True)
        self.client.force_login(staff)
        response = self.client.get(reverse('api-schema'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('openapi', response.content.decode('utf-8')[:200])


class BruteForceProtectionTests(IntegrationFixtureMixin, TestCase):
    @override_settings(AXES_FAILURE_LIMIT=2)
    def test_password_login_locks_then_can_be_operationally_reset(self):
        user = self.make_user('lockout-user')
        client = APIClient()
        payload = {'username': user.username, 'password': 'incorrect-password'}

        self.assertEqual(client.post('/api/auth/login/', payload, format='json').status_code, 401)
        self.assertEqual(client.post('/api/auth/login/', payload, format='json').status_code, 401)
        blocked = client.post(
            '/api/auth/login/',
            {'username': user.username, 'password': 'A-strong-password-123'},
            format='json',
        )
        self.assertEqual(blocked.status_code, 401)
        self.assertGreaterEqual(
            AccessAttempt.objects.get(username=user.username).failures_since_start, 2
        )

        reset_axes(username=user.username)
        allowed = client.post(
            '/api/auth/login/',
            {'username': user.username, 'password': 'A-strong-password-123'},
            format='json',
        )
        self.assertEqual(allowed.status_code, 200)


class ConfigurationAndImportTests(IntegrationFixtureMixin, TestCase):
    def test_enabled_integrations_fail_checks_when_required_values_are_missing(self):
        broken_storage = {
            'default': {'BACKEND': 'storages.backends.s3.S3Storage', 'OPTIONS': {'bucket_name': ''}},
            'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
        }
        with override_settings(MEDIA_STORAGE_BACKEND='s3', STORAGES=broken_storage):
            messages = integration_configuration_check(None)
        self.assertIn('shop.E110', {message.id for message in messages})
        self.assertTrue(any(isinstance(message, checks.Error) for message in messages))

    def test_product_import_validates_rows_and_records_history(self):
        author = self.make_user('import-author')
        category = Category.objects.create(name='کود', slug='import-fertilizer')
        headers = [
            'slug', 'title', 'author_username', 'category_slug', 'subcategory_slug',
            'description', 'status', 'publish', 'price', 'stock', 'available',
            'is_featured', 'discount_percent', 'brand', 'sku', 'gtin',
            'seo_title', 'seo_description', 'shipping_weight_grams',
            'shipping_length_cm', 'shipping_width_cm', 'shipping_height_cm',
        ]
        base = [
            'imported-product', 'محصول واردشده', author.username, category.slug, '',
            'توضیح واردات', 'published', timezone.now().strftime('%Y-%m-%d %H:%M:%S'), 120_000, 4,
            True, False, 0, 'برند', 'SKU-IMPORT', '', '', '', 500, 10, 10, 20,
        ]
        resource = ProductResource()

        invalid = Dataset(headers=headers)
        invalid.append([*base[:6], 'not-a-real-status', *base[7:]])
        invalid_result = resource.import_data(invalid, dry_run=True, raise_errors=False)
        self.assertTrue(invalid_result.has_errors() or invalid_result.has_validation_errors())
        self.assertFalse(Product.objects.filter(slug='imported-product').exists())

        valid = Dataset(headers=headers)
        valid.append(base)
        result = resource.import_data(valid, dry_run=False, raise_errors=True)
        self.assertFalse(result.has_errors())
        product = Product.objects.get(slug='imported-product')
        self.assertEqual(product.author, author)
        self.assertEqual(product.category, category)
        self.assertGreaterEqual(product.history.count(), 1)

    def test_bulk_publish_uses_model_saves_for_history(self):
        author = self.make_user('history-author')
        product = Product.objects.create(
            title='پیش‌نویس', slug='history-draft', author=author,
            description='توضیح', status='draft', price=1, stock=1,
        )
        initial_history_count = product.history.count()
        make_published(None, None, Product.objects.filter(pk=product.pk))
        product.refresh_from_db()
        self.assertEqual(product.status, 'published')
        self.assertEqual(product.history.count(), initial_history_count + 1)
