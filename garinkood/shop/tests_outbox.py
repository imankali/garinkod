"""Outbox worker tests — the async availability contract, item by item.

Each test pins one guaranteed behaviour of ``process_async_tasks``:

* claiming flips rows to ``processing`` atomically (unit of the claim),
* the dispatcher really runs image regeneration (mocked boundary: the
  deterministic encoder itself is covered by the media tests),
* provider failure triggers bounded retry → ``failed`` after MAX_ATTEMPTS,
  with the plaintext OTP re-parked between attempts (idempotency),
* completed tasks are invisible to later claims (no double-processing),
* superseded image tasks are ``skipped`` fast — never a stale write,
* the OTP happy path records the delivery channel + provider message id."""

from datetime import timedelta
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from shop.management.commands.process_async_tasks import Command
from shop.models import Category, OneTimePassword, OutboxTask, Product
from shop.task_queue import cache_otp_code_for_delivery

User = get_user_model()


def _run_worker(*, limit=10, task_type=None):
    out = StringIO()
    kwargs = {'limit': limit, 'stdout': out}
    if task_type:
        kwargs['task_type'] = task_type
    call_command('process_async_tasks', **kwargs)
    return out.getvalue()


def _otp_task(challenge, code='246810'):
    cache_otp_code_for_delivery(str(challenge.request_id), code)
    return OutboxTask.objects.create(
        task_type=OutboxTask.TASK_SEND_OTP,
        payload={'otp_pk': challenge.pk, 'channels': ['sms', 'bale']},
    )


@override_settings(CACHES={'default': {
    'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    'LOCATION': 'outbox-tests',
}})
class OutboxWorkerTests(TestCase):
    # The project test runner swaps in DummyCache globally (throttle hygiene,
    # see shop/test_runner.py). The OTP single-flight cache IS part of the
    # unit under test here, so this class opts back into a real backend —
    # the same documented convention ThrottleTests already uses.
    def setUp(self):
        self.user = User.objects.create_user(username='outbox-buyer', password='safe-password-123')
        self.category = Category.objects.create(name='بذر آزمون', slug='outbox-seed')
        self.product = Product.objects.create(
            title='بذر آزمون', slug='outbox-product', author=self.user,
            category=self.category, description='تست صف Outbox', status='published',
            price=10000, stock=5, available=True,
        )
        self.challenge = OneTimePassword.objects.create(
            phone='09120000077', code_hash='pbkdf2$hash',
            expires_at=timezone.now() + timedelta(minutes=5),
        )
        # Product.save() itself enqueues a placeholder-image task (that's the
        # deferral working as designed) — clear the queue so every test owns
        # exactly the rows it creates.
        OutboxTask.objects.all().delete()

    # 1) Claim semantics -------------------------------------------------

    def test_claim_flips_pending_rows_to_processing(self):
        first = OutboxTask.objects.create(task_type=OutboxTask.TASK_SEND_NOTIFICATION, payload={})
        second = OutboxTask.objects.create(task_type=OutboxTask.TASK_SEND_NOTIFICATION, payload={})
        cmd = Command()
        claimed = cmd._claim_batch(10, None)
        self.assertEqual({row.pk for row in claimed}, {first.pk, second.pk})
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, OutboxTask.STATUS_PROCESSING)
        self.assertEqual(second.status, OutboxTask.STATUS_PROCESSING)
        # and nothing remains claimable until handlers finish them
        self.assertEqual(cmd._claim_batch(10, None), [])

    # 2) Dispatcher: process_image happy path ----------------------------

    def test_process_image_task_regenerates_and_updates_variants(self):
        Product.objects.filter(pk=self.product.pk).update(image='products/outbox-x.jpg')
        fake_variants = {'avif': ['https://cdn/x-480.avif'], 'webp': [], 'widths': [480], 'formats': ('avif', 'webp')}
        legacy = {'avif': ['https://cdn/old-480.avif'], 'webp': [], 'widths': [480], 'formats': ['avif', 'webp']}
        task = OutboxTask.objects.create(
            task_type=OutboxTask.TASK_PROCESS_IMAGE,
            payload={
                'app_label': 'shop', 'model': 'product', 'pk': self.product.pk,
                'image_source_field': 'image', 'expected_image': 'products/outbox-x.jpg',
                'delete_variants': legacy,
            },
        )
        with mock.patch('shop.image_pipeline.generate_image_variants', return_value=dict(fake_variants)) as gen, \
                mock.patch('shop.image_pipeline.delete_image_variants') as gc:
            output = _run_worker()
        task.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(task.status, OutboxTask.STATUS_COMPLETED)
        self.assertEqual(self.product.image_variants['avif'], ['https://cdn/x-480.avif'])
        self.assertEqual(self.product.image_variants['fallback'], self.product.image_url)
        gen.assert_called_once()
        gc.assert_called_once_with(legacy)
        self.assertIn('موفق: 1', output)

    # 3) Bounded retry ---------------------------------------------------

    @override_settings(MESSAGING_FAKE=False, MESSAGING_ENABLE_SMS=False, MESSAGING_ENABLE_BALE=False)
    def test_otp_delivery_failure_retries_bounded_times_then_fails(self):
        task = _otp_task(self.challenge)
        for expected_attempt in (1, 2):
            _run_worker()
            task.refresh_from_db()
            self.assertEqual(task.attempts, expected_attempt)
            self.assertEqual(task.status, OutboxTask.STATUS_PENDING)  # re-parked, code still cached
        _run_worker()  # third strike
        task.refresh_from_db()
        self.assertEqual(task.attempts, OutboxTask.MAX_ATTEMPTS)
        self.assertEqual(task.status, OutboxTask.STATUS_FAILED)
        self.assertTrue(task.last_error)
        # Plaintext code survived every failed attempt (re-parked for retry)
        from shop.task_queue import pop_otp_code_for_delivery
        self.assertEqual(pop_otp_code_for_delivery(str(self.challenge.request_id)), '246810')

    # 4) Idempotency: completed rows are never re-processed --------------

    def test_completed_task_is_never_claimed_again(self):
        task = OutboxTask.objects.create(task_type=OutboxTask.TASK_SEND_NOTIFICATION, payload={})
        first = _run_worker()
        task.refresh_from_db()
        self.assertEqual(task.status, OutboxTask.STATUS_COMPLETED)
        self.assertIn('موفق: 1', first)
        second = _run_worker()
        self.assertNotIn('پردازش‌شده:', second)  # empty batch — nothing re-claimed
        task.refresh_from_db()
        self.assertEqual(task.status, OutboxTask.STATUS_COMPLETED)
        self.assertEqual(task.attempts, 0)

    # 5) Superseded image task → skip ------------------------------------

    def test_superseded_image_task_is_skipped_without_touching_variants(self):
        # The row now carries a DIFFERENT image than the task expects —
        # a newer save already enqueued its own fresh task.
        Product.objects.filter(pk=self.product.pk).update(image='products/NEWEST.jpg')
        task = OutboxTask.objects.create(
            task_type=OutboxTask.TASK_PROCESS_IMAGE,
            payload={
                'app_label': 'shop', 'model': 'product', 'pk': self.product.pk,
                'image_source_field': 'image', 'expected_image': 'products/OLD.jpg',
                'delete_variants': {},
            },
        )
        with mock.patch('shop.image_pipeline.generate_image_variants') as gen:
            output = _run_worker()
        task.refresh_from_db()
        self.assertEqual(task.status, OutboxTask.STATUS_COMPLETED)
        self.assertFalse(gen.called)  # never touch the pipeline for stale work
        self.assertIn('رد شده: 1', output)

    # 6) OTP happy path ---------------------------------------------------

    @override_settings(MESSAGING_FAKE=True)
    def test_otp_task_delivers_and_records_channel(self):
        task = _otp_task(self.challenge)
        _run_worker()
        task.refresh_from_db()
        self.challenge.refresh_from_db()
        self.assertEqual(task.status, OutboxTask.STATUS_COMPLETED)
        self.assertEqual(self.challenge.delivery_channel, 'sms')
        self.assertTrue(self.challenge.provider_message_id.startswith('fake-otp-sms-'))
        # single-flight: the cache entry is gone — a rerun could never resend
        from shop.task_queue import pop_otp_code_for_delivery
        self.assertIsNone(pop_otp_code_for_delivery(str(self.challenge.request_id)))

    # Bonus: expired/absent code ⇒ clean skip ------------------------------

    def test_otp_task_without_cached_code_is_skipped_not_sent(self):
        task = OutboxTask.objects.create(
            task_type=OutboxTask.TASK_SEND_OTP,
            payload={'otp_pk': self.challenge.pk, 'channels': ['sms']},
        )  # deliberately no cache_otp_code_for_delivery()
        with mock.patch('shop.messaging.providers.send_otp') as sender:
            output = _run_worker()
        task.refresh_from_db()
        self.assertEqual(task.status, OutboxTask.STATUS_COMPLETED)
        self.assertFalse(sender.called)  # never send a dead code
        self.assertIn('رد شده: 1', output)
