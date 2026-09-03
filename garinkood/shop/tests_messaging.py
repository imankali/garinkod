import hashlib
import hmac
import json
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .messaging.outbox import enqueue_order_event
from .messaging.providers import ProviderError, send_delivery, send_otp
from .messaging.worker import process_delivery
from .models import (
    Category,
    NotificationDelivery,
    NotificationRecipient,
    OneTimePassword,
    Order,
    Product,
)
from .phone_numbers import iranian_mobile_e164, mask_phone, normalize_iranian_mobile

User = get_user_model()


class IranianPhoneNumberTests(SimpleTestCase):
    def test_common_iranian_formats_share_one_canonical_value(self):
        expected = '09123456789'
        for value in ('09123456789', '+98 912-345-6789', '00989123456789', '۹۱۲۳۴۵۶۷۸۹'):
            self.assertEqual(normalize_iranian_mobile(value), expected)
        self.assertEqual(iranian_mobile_e164(expected), '+989123456789')
        self.assertEqual(mask_phone(expected), '0912***6789')

    def test_landline_and_malformed_numbers_are_rejected(self):
        for value in ('02112345678', '09123', '9891234567890', ''):
            with self.assertRaises(ValueError):
                normalize_iranian_mobile(value)


@override_settings(
    MESSAGING_FAKE=False,
    MESSAGING_ENABLE_SMS=True,
    MESSAGING_ENABLE_BALE=True,
    MESSAGING_ENABLE_TELEGRAM=True,
    MESSAGING_ENABLE_WHATSAPP=True,
    SMS_PROVIDER='smsir',
    SMSIR_API_KEY='smsir-secret',
    SMSIR_OTP_TEMPLATE_ID=123,
    SMSIR_OTP_PARAMETER='Code',
    SMSIR_LINE_NUMBER=30001234,
    KAVENEGAR_API_KEY='kavenegar-secret',
    KAVENEGAR_OTP_TEMPLATE='login-template',
    KAVENEGAR_SENDER='10001234',
    BALE_SAFIR_API_KEY='bale-safir-secret',
    BALE_SAFIR_BOT_ID=456,
    BALE_BOT_TOKEN='bale-bot-secret',
    TELEGRAM_BOT_TOKEN='123:telegram-secret',
    WHATSAPP_ACCESS_TOKEN='meta-secret',
    WHATSAPP_PHONE_NUMBER_ID='phone-number-id',
    WHATSAPP_API_VERSION='v23.0',
    WHATSAPP_ALLOW_FREEFORM=False,
)
class ProviderAdapterTests(SimpleTestCase):
    @patch('shop.messaging.providers._http_post')
    def test_smsir_verify_payload(self, post):
        post.return_value = {'status': 1, 'data': {'messageId': 42}}
        result = send_otp('sms', '+989123456789', '123456', 'request-id')
        self.assertEqual(result.message_id, '42')
        self.assertEqual(post.call_args.args[0], 'https://api.sms.ir/v1/send/verify')
        self.assertEqual(post.call_args.kwargs['headers']['X-API-KEY'], 'smsir-secret')
        self.assertEqual(post.call_args.kwargs['payload']['mobile'], '09123456789')
        self.assertEqual(post.call_args.kwargs['payload']['parameters'][0]['value'], '123456')

    @patch('shop.messaging.providers._http_post')
    def test_bale_safir_uses_phone_format_and_request_id(self, post):
        post.return_value = {'message_id': 'bale-message', 'error_data': []}
        result = send_otp('bale', '09123456789', '654321', 'stable-request-id')
        self.assertEqual(result.message_id, 'bale-message')
        payload = post.call_args.kwargs['payload']
        self.assertEqual(payload['request_id'], 'stable-request-id')
        self.assertEqual(payload['phone_number'], '989123456789')
        self.assertEqual(payload['message_data']['otp_message']['otp'], '654321')

    @patch('shop.messaging.providers._http_post')
    def test_telegram_uses_official_bot_endpoint(self, post):
        post.return_value = {'ok': True, 'result': {'message_id': 77}}
        delivery = SimpleNamespace(
            id='delivery-id', channel='telegram', recipient='12345',
            rendered_content='سفارش جدید', payload={},
        )
        result = send_delivery(delivery)
        self.assertEqual(result.message_id, '77')
        self.assertIn('api.telegram.org/bot123:telegram-secret/sendMessage', post.call_args.args[0])
        self.assertEqual(post.call_args.kwargs['payload']['chat_id'], '12345')

    @patch('shop.messaging.providers._http_post')
    def test_whatsapp_uses_approved_cloud_template(self, post):
        post.return_value = {'messages': [{'id': 'wamid.123'}]}
        delivery = SimpleNamespace(
            id='delivery-id',
            channel='whatsapp',
            recipient='09123456789',
            rendered_content='fallback text',
            payload={
                'provider_options': {
                    'template_name': 'order_created_fa',
                    'language_code': 'fa',
                    'template_parameters': ['GK-1', 'مشتری', '100,000', 'جدید'],
                },
            },
        )
        result = send_delivery(delivery)
        self.assertEqual(result.message_id, 'wamid.123')
        payload = post.call_args.kwargs['payload']
        self.assertEqual(payload['messaging_product'], 'whatsapp')
        self.assertEqual(payload['to'], '989123456789')
        self.assertEqual(payload['type'], 'template')
        self.assertEqual(payload['template']['name'], 'order_created_fa')
        self.assertEqual(post.call_args.kwargs['headers']['Authorization'], 'Bearer meta-secret')

    @override_settings(SMS_PROVIDER='kavenegar')
    @patch('shop.messaging.providers._http_post')
    def test_kavenegar_lookup_is_supported_as_alternative(self, post):
        post.return_value = {
            'return': {'status': 200, 'message': 'تأیید شد'},
            'entries': [{'messageid': 88}],
        }
        result = send_otp('sms', '09123456789', '123456', 'request-id')
        self.assertEqual(result.message_id, '88')
        self.assertIn('/verify/lookup.json', post.call_args.args[0])
        self.assertTrue(post.call_args.kwargs['form_encoded'])


@override_settings(
    MESSAGING_FAKE=True,
    DEBUG=True,
    OTP_RETURN_DEBUG_CODE=True,
    OTP_CODE_LENGTH=6,
    OTP_TTL_SECONDS=180,
    OTP_RESEND_COOLDOWN_SECONDS=60,
    OTP_MAX_VERIFY_ATTEMPTS=5,
    OTP_DELIVERY_CHANNELS=['sms', 'bale'],
)
class OtpAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _request_code(self, phone='۰۹۱۲۳۴۵۶۷۸۹'):
        response = self.client.post('/api/auth/otp/request/', {'phone': phone}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response

    def test_code_is_hashed_then_creates_account_and_http_only_session(self):
        requested = self._request_code()
        code = requested.data['debug_code']
        challenge = OneTimePassword.objects.get(request_id=requested.data['request_id'])
        self.assertNotEqual(challenge.code_hash, code)
        self.assertTrue(check_password(code, challenge.code_hash))
        self.assertEqual(challenge.phone, '09123456789')
        self.assertNotIn('code', {key.lower() for key in requested.data if key != 'debug_code'})

        verified = self.client.post(
            '/api/auth/otp/verify/',
            {
                'request_id': requested.data['request_id'],
                'phone': '+989123456789',
                'code': code,
            },
            format='json',
        )
        self.assertEqual(verified.status_code, 201, verified.data)
        self.assertTrue(verified.data['created'])
        self.assertEqual(verified.data['account']['phone'], '09123456789')
        user = User.objects.get(pk=verified.data['user']['id'])
        self.assertFalse(user.has_usable_password())
        self.assertIsNotNone(user.account.phone_verified_at)

        cookie = verified.cookies['garinkood_auth']
        self.assertTrue(cookie['httponly'])
        session = self.client.get('/api/auth/session/')
        self.assertEqual(session.status_code, 200)
        self.assertEqual(session.data['user']['id'], user.id)

        challenge.refresh_from_db()
        self.assertEqual(challenge.status, OneTimePassword.STATUS_VERIFIED)
        self.assertIsNotNone(challenge.consumed_at)
        replay = self.client.post(
            '/api/auth/otp/verify/',
            {'request_id': str(challenge.request_id), 'phone': challenge.phone, 'code': code},
            format='json',
        )
        self.assertEqual(replay.status_code, 400)

    def test_existing_phone_logs_into_existing_account_without_enumeration_hint(self):
        user = User.objects.create_user(username='legacy', password='a-strong-password')
        user.account.phone = '09123456789'
        user.account.save(update_fields=['phone'])

        requested = self._request_code('09123456789')
        self.assertNotIn('exists', requested.data)
        verified = self.client.post(
            '/api/auth/otp/verify/',
            {
                'request_id': requested.data['request_id'],
                'phone': '09123456789',
                'code': requested.data['debug_code'],
            },
            format='json',
        )
        self.assertEqual(verified.status_code, 200, verified.data)
        self.assertFalse(verified.data['created'])
        self.assertEqual(verified.data['user']['id'], user.id)

    @override_settings(OTP_MAX_VERIFY_ATTEMPTS=2)
    def test_wrong_attempts_are_persisted_and_lock_the_challenge(self):
        requested = self._request_code()
        payload = {
            'request_id': requested.data['request_id'],
            'phone': '09123456789',
            'code': '999999' if requested.data['debug_code'] != '999999' else '888888',
        }
        self.assertEqual(self.client.post('/api/auth/otp/verify/', payload, format='json').status_code, 400)
        challenge = OneTimePassword.objects.get(request_id=requested.data['request_id'])
        self.assertEqual(challenge.attempts, 1)
        self.assertEqual(self.client.post('/api/auth/otp/verify/', payload, format='json').status_code, 400)
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 2)
        self.assertEqual(challenge.status, OneTimePassword.STATUS_FAILED)

    @override_settings(DEBUG=False, OTP_RETURN_DEBUG_CODE=True)
    def test_debug_code_never_leaks_when_django_debug_is_off(self):
        response = self._request_code()
        self.assertNotIn('debug_code', response.data)


@override_settings(
    MESSAGING_FAKE=True,
    MESSAGING_ENABLE_SMS=True,
    MESSAGING_ENABLE_BALE=True,
    MESSAGING_ENABLE_TELEGRAM=True,
    MESSAGING_ENABLE_WHATSAPP=True,
    NOTIFICATION_ADMIN_TELEGRAM_CHAT_IDS=[],
    NOTIFICATION_ADMIN_BALE_CHAT_IDS=[],
    NOTIFICATION_ADMIN_SMS_NUMBERS=[],
    NOTIFICATION_ADMIN_WHATSAPP_NUMBERS=[],
    NOTIFICATION_CUSTOMER_STATUS_CHANNELS=[],
    NOTIFICATION_MAX_ATTEMPTS=2,
)
class NotificationOutboxTests(TestCase):
    def setUp(self):
        self.recipient = NotificationRecipient.objects.create(
            name='مالک فروشگاه',
            channel='telegram',
            destination='123456789',
            receive_order_created=True,
            receive_order_status_changed=True,
        )
        self.order = Order.objects.create(
            customer_name='کشاورز نمونه',
            phone='09123456789',
            province='فارس',
            city='شیراز',
            address='نشانی محرمانه',
            subtotal=250_000,
            total_price=295_000,
            payment_method='coordination',
        )

    def test_idempotent_event_is_persisted_then_worker_records_delivery(self):
        self.assertEqual(enqueue_order_event(self.order, 'order_created'), 1)
        self.assertEqual(enqueue_order_event(self.order, 'order_created'), 0)
        delivery = NotificationDelivery.objects.get()
        self.assertEqual(delivery.status, NotificationDelivery.STATUS_PENDING)
        self.assertNotIn(self.order.phone, delivery.rendered_content)
        self.assertIn(mask_phone(self.order.phone), delivery.rendered_content)
        self.assertNotIn(self.order.address, delivery.payload)

        self.assertTrue(process_delivery(delivery.pk))
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, NotificationDelivery.STATUS_SENT)
        self.assertEqual(delivery.attempt_count, 1)
        self.assertTrue(delivery.provider_message_id.startswith('fake-telegram-'))
        self.assertIsNotNone(delivery.sent_at)

    def test_clear_provider_failure_retries_with_backoff_then_stops(self):
        enqueue_order_event(self.order, 'order_created')
        delivery = NotificationDelivery.objects.get()
        with patch(
            'shop.messaging.worker.send_delivery',
            side_effect=ProviderError('temporary', retryable=True),
        ):
            process_delivery(delivery.pk)
            delivery.refresh_from_db()
            self.assertEqual(delivery.status, NotificationDelivery.STATUS_RETRY)
            self.assertEqual(delivery.attempt_count, 1)
            delivery.next_attempt_at = timezone.now() - timedelta(seconds=1)
            delivery.save(update_fields=['next_attempt_at'])
            process_delivery(delivery.pk)
        delivery.refresh_from_db()
        self.assertEqual(delivery.status, NotificationDelivery.STATUS_FAILED)
        self.assertEqual(delivery.attempt_count, 2)
        self.assertEqual(delivery.last_error, 'temporary')

    def test_order_status_signal_enqueues_a_new_transition_once(self):
        self.order.status = 'confirmed'
        self.order.save(update_fields=['status', 'updated_at'])
        delivery = NotificationDelivery.objects.get(event='order_status_changed')
        self.assertEqual(delivery.order, self.order)
        self.assertIn('تأیید شده', delivery.rendered_content)


@override_settings(
    WHATSAPP_APP_SECRET='webhook-app-secret',
    WHATSAPP_WEBHOOK_VERIFY_TOKEN='webhook-verify-token',
)
class WhatsAppWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.delivery = NotificationDelivery.objects.create(
            event='test',
            audience='owner',
            channel='whatsapp',
            recipient='09123456789',
            rendered_content='test',
            idempotency_key='whatsapp-webhook-test',
            status=NotificationDelivery.STATUS_SENT,
            provider_message_id='wamid.example',
            sent_at=timezone.now(),
        )

    def test_verification_challenge_requires_matching_token(self):
        response = self.client.get(
            '/api/messaging/webhooks/whatsapp/',
            {
                'hub.mode': 'subscribe',
                'hub.verify_token': 'webhook-verify-token',
                'hub.challenge': '123456',
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b'123456')
        denied = self.client.get(
            '/api/messaging/webhooks/whatsapp/',
            {'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'x'},
        )
        self.assertEqual(denied.status_code, 403)

    def test_signed_delivery_status_updates_history(self):
        payload = {
            'entry': [{
                'changes': [{
                    'value': {
                        'statuses': [{
                            'id': 'wamid.example',
                            'status': 'delivered',
                            'timestamp': '1788393600',
                        }],
                    },
                }],
            }],
        }
        raw = json.dumps(payload, separators=(',', ':')).encode()
        signature = 'sha256=' + hmac.new(b'webhook-app-secret', raw, hashlib.sha256).hexdigest()
        response = self.client.post(
            '/api/messaging/webhooks/whatsapp/',
            data=raw,
            content_type='application/json',
            HTTP_X_HUB_SIGNATURE_256=signature,
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.delivery.refresh_from_db()
        self.assertEqual(self.delivery.status, NotificationDelivery.STATUS_DELIVERED)
        self.assertIsNotNone(self.delivery.delivered_at)
        self.assertEqual(self.delivery.provider_response['webhook']['status'], 'delivered')

        rejected = self.client.post(
            '/api/messaging/webhooks/whatsapp/',
            data=raw,
            content_type='application/json',
            HTTP_X_HUB_SIGNATURE_256='sha256=bad',
        )
        self.assertEqual(rejected.status_code, 403)


@override_settings(
    MESSAGING_FAKE=True,
    MESSAGING_ENABLE_TELEGRAM=True,
    NOTIFICATION_ADMIN_TELEGRAM_CHAT_IDS=[],
    NOTIFICATION_ADMIN_BALE_CHAT_IDS=[],
    NOTIFICATION_ADMIN_SMS_NUMBERS=[],
    NOTIFICATION_ADMIN_WHATSAPP_NUMBERS=[],
    NOTIFICATION_CUSTOMER_STATUS_CHANNELS=[],
)
class CheckoutNotificationIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        category = Category.objects.create(name='کود', slug='fertilizer')
        author = User.objects.create_user(username='notification-product-owner')
        self.product = Product.objects.create(
            author=author,
            category=category,
            title='کود آزمون',
            slug='notification-test-fertilizer',
            description='آزمون',
            price=100_000,
            stock=5,
            available=True,
            status='published',
        )
        NotificationRecipient.objects.create(
            name='مالک',
            channel='telegram',
            destination='987654321',
        )

    def test_successful_checkout_commits_order_and_pending_alert_without_network_call(self):
        added = self.client.post('/api/cart/add/', {'product_id': self.product.id, 'quantity': 2}, format='json')
        self.assertEqual(added.status_code, 201, added.data)
        with patch('shop.messaging.providers.send_delivery') as provider_call:
            response = self.client.post(
                '/api/orders/checkout/',
                {
                    'customer_name': 'خریدار',
                    'phone': '09123456789',
                    'province': 'فارس',
                    'city': 'شیراز',
                    'address': 'خیابان نمونه',
                    'payment_method': 'coordination',
                    'terms_accepted': True,
                },
                format='json',
            )
        self.assertEqual(response.status_code, 201, response.data)
        provider_call.assert_not_called()
        order = Order.objects.get(code=response.data['order']['code'])
        delivery = NotificationDelivery.objects.get(event='order_created')
        self.assertEqual(delivery.order, order)
        self.assertEqual(delivery.status, NotificationDelivery.STATUS_PENDING)

    def test_failed_checkout_creates_neither_order_nor_alert(self):
        self.client.post('/api/cart/add/', {'product_id': self.product.id, 'quantity': 2}, format='json')
        self.product.stock = 0
        self.product.available = False
        self.product.save(update_fields=['stock', 'available'])
        response = self.client.post(
            '/api/orders/checkout/',
            {
                'customer_name': 'خریدار',
                'phone': '09123456789',
                'province': 'فارس',
                'city': 'شیراز',
                'address': 'خیابان نمونه',
                'payment_method': 'coordination',
                'terms_accepted': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 409)
        self.assertFalse(Order.objects.exists())
        self.assertFalse(NotificationDelivery.objects.exists())
