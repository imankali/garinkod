"""Ironclad Part 1+2 — worker-resilience contracts for the async outbox AND
the media backfill command's environment safety gate.

Pinned contracts:

* every claim stamps ``locked_at`` (ownership evidence);
* ``--recover-stale`` returns ONLY genuinely orphaned rows to pending and
  resets their attempts (partial, unobservable progress = clean slate);
* young claims are NEVER swept;
* finishing a task clears the ownership stamp; failures park with evidence;
* the media backfill refuses to start without ۵۰۰MB of free disk —
  discovering a full disk mid-backfill in production is the failure we are
  paying to remove, so the gate fires BEFORE any processing."""

from datetime import timedelta
from io import StringIO
from types import SimpleNamespace
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from .management.commands.process_async_tasks import Command
from .models import OutboxTask


class OutboxResilienceTests(TestCase):
    def setUp(self):
        OutboxTask.objects.all().delete()

    def _run(self, **kwargs):
        out = StringIO()
        call_command("process_async_tasks", stdout=out, **kwargs)
        return out.getvalue()

    def test_claim_stamps_locked_at_on_every_row(self):
        first = OutboxTask.objects.create(task_type=OutboxTask.TASK_SEND_NOTIFICATION, payload={})
        second = OutboxTask.objects.create(task_type=OutboxTask.TASK_SEND_NOTIFICATION, payload={})
        claimed = Command()._claim_batch(10, None)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertIsNotNone(first.locked_at)
        self.assertIsNotNone(second.locked_at)
        self.assertEqual({r.pk for r in claimed}, {first.pk, second.pk})

    def test_recover_stale_reparks_orphans_and_resets_attempts(self):
        twenty_minutes_ago = timezone.now() - timedelta(minutes=20)
        orphaned = OutboxTask.objects.create(
            task_type=OutboxTask.TASK_SEND_NOTIFICATION,
            payload={},
            status=OutboxTask.STATUS_PROCESSING,
            attempts=3,
            locked_at=twenty_minutes_ago,
        )
        self._run(recover_stale=True)
        orphaned.refresh_from_db()
        self.assertEqual(orphaned.status, OutboxTask.STATUS_PENDING)
        self.assertEqual(orphaned.attempts, 0)
        self.assertIsNone(orphaned.locked_at)
        self.assertEqual(orphaned.last_error, "")

    def test_recover_stale_never_touches_young_claims(self):
        one_minute_ago = timezone.now() - timedelta(minutes=1)
        fresh = OutboxTask.objects.create(
            task_type=OutboxTask.TASK_SEND_NOTIFICATION,
            payload={},
            status=OutboxTask.STATUS_PROCESSING,
            attempts=1,
            locked_at=one_minute_ago,
        )
        self._run(recover_stale=True)
        fresh.refresh_from_db()
        self.assertEqual(fresh.status, OutboxTask.STATUS_PROCESSING)
        self.assertEqual(fresh.attempts, 1)
        self.assertIsNotNone(fresh.locked_at)

    def test_completed_task_releases_ownership_stamp(self):
        OutboxTask.objects.create(task_type=OutboxTask.TASK_SEND_NOTIFICATION, payload={})
        task = OutboxTask.objects.get()
        self._run(limit=5)
        task.refresh_from_db()
        self.assertEqual(task.status, OutboxTask.STATUS_COMPLETED)
        self.assertIsNone(task.locked_at)
        self.assertIsNotNone(task.updated_at)


class BackfillDiskSafetyTests(TestCase):
    """The disk-headroom gate fires BEFORE any encode/DB work, deterministically."""

    def test_backfill_aborts_with_commanderror_when_disk_is_low(self):
        tiny_free = SimpleNamespace(free=100 * 1024 * 1024, total=1, used=1)
        with mock.patch("shutil.disk_usage", return_value=tiny_free):
            with self.assertRaises(CommandError) as ctx:
                call_command("backfill_image_variants")
        message = str(ctx.exception)
        self.assertIn("فضای دیسک ناکافی", message)
        self.assertIn("100 MB موجود", message)
        self.assertIn("۵۰۰ MB", message)

    def test_backfill_starts_normally_with_enough_disk(self):
        roomy_free = SimpleNamespace(free=10 * 1024**3, total=1, used=1)
        with mock.patch("shutil.disk_usage", return_value=roomy_free):
            out = StringIO()
            call_command(
                "backfill_image_variants",
                "--model", "listing",
                "--dry-run",
                stdout=out,
            )  # no CommandError — the gate lets healthy runs through
        self.assertNotIn("فضای دیسک ناکافی", out.getvalue())
