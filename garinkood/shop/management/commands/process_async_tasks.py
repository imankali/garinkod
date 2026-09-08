"""Drain the durable background outbox (OutboxTask).

This command is the heartbeat of the async architecture: request threads
never encode images or call SMS/Bale providers — they enqueue rows and this
worker does the heavy lifting. Safe under multi-process production draining:

* claiming uses ``SELECT ... FOR UPDATE SKIP LOCKED`` where the engine
  supports it (MySQL/PostgreSQL), with a plain-transaction fallback for
  SQLite dev (single-writer engine ⇒ claim stays race-free);
* every handler is IDEMPOTENT: crash-and-rerun converges to the same final
  state — no duplicated sends, no corrupted variant JSON, no double GC.

Recommended production wiring (crontab or systemd/supervisor --continuous):

    */1 * * * *  cd /srv/garinkood && .venv/bin/python manage.py process_async_tasks --limit 50
"""

from __future__ import annotations

import time
from datetime import timedelta

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import OperationalError, connection, transaction
from django.db.models import Q
from django.utils import timezone

from shop.models import OutboxTask


class Command(BaseCommand):
    help = 'پردازش تسک‌های پس‌زمینه‌ی صف Outbox (تصویر، OTP، نوتیفیکیشن) با قفل امن و تلاش مجدد'

    #: A ``processing`` row untouched for this long is an orphaned claim —
    #: the worker died mid-task. ``--recover-stale`` hands it back to pending.
    STALE_MINUTES = 15

    #: task_type → handler method name. Handlers return 'done' | 'skipped'
    #: or RAISE to trigger the retry bookkeeping — they never mark statuses
    #: themselves; the claim/finish layers own the state machine.
    HANDLERS = {
        OutboxTask.TASK_PROCESS_IMAGE: '_handle_process_image',
        OutboxTask.TASK_SEND_OTP: '_handle_send_otp',
        OutboxTask.TASK_SEND_NOTIFICATION: '_handle_send_notification',
    }

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=10, help='حداکثر تسک در هر دور')
        parser.add_argument(
            '--task-type',
            choices=[choice for choice, _ in OutboxTask.TASK_CHOICES],
            default=None,
            help='فقط نوع مشخص‌شده را پردازش کن',
        )
        parser.add_argument(
            '--continuous',
            action='store_true',
            help='حلقه‌ی مداوم (برای Supervisor)؛ با Ctrl+C متوقف می‌شود',
        )
        parser.add_argument(
            '--sleep', type=float, default=2.0, help='توقف بین دورها در حالت مداوم (ثانیه)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='فقط گزارش وضعیت صف بدون ادعا یا اجرای هیچ تسکی',
        )
        parser.add_argument(
            '--recover-stale',
            action='store_true',
            help='تسک‌های «در حال اجرای» قدیمی‌تر از ۱۵ دقیقه را به صف برگردان و خروج',
        )

    # ------------------------------------------------------------------ API

    def handle(self, *args, **options):
        limit = max(int(options['limit']), 1)
        task_type = options['task_type']
        sleep_seconds = max(float(options['sleep']), 0.25)

        if options['dry_run']:
            self._report_queue(task_type)
            return

        if options['recover_stale']:
            self._recover_stale()
            return

        if options['continuous']:
            self.stdout.write(self.style.SUCCESS('🔁 حالت مداوم فعال — توقف با Ctrl+C'))
            idle_rounds = 0
            try:
                while True:
                    stats = self._drain_once(limit, task_type)
                    if stats['claimed']:
                        idle_rounds = 0
                    else:
                        idle_rounds += 1
                        if idle_rounds % 8 == 0:  # ~16s heartbeat at default sleep
                            self.stdout.write('… صف خالی است؛ ورکر در انتظار تسک.')
                    time.sleep(sleep_seconds)
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING('⏹ ورکر با دستور شما متوقف شد. سلامت صف حفظ شد.'))
            return

        self._drain_once(limit, task_type)

    # -------------------------------------------------------------- batching

    def _drain_once(self, limit: int, task_type: str | None) -> dict:
        stats = {'claimed': 0, 'done': 0, 'skipped': 0, 'error': 0}
        rows = self._claim_batch(limit, task_type)
        stats['claimed'] = len(rows)
        for task in rows:
            outcome = self._process_one(task)
            stats[outcome] = stats.get(outcome, 0) + 1
        if stats['claimed']:
            line = (
                f"پردازش‌شده: {stats['claimed']}، موفق: {stats['done']}، "
                f"خطا: {stats['error']}، رد شده: {stats['skipped']}"
            )
            if stats['error']:
                self.stdout.write(self.style.WARNING(f'📊 {line}'))
            else:
                self.stdout.write(self.style.SUCCESS(f'📊 {line}'))
        return stats

    def _claim_batch(self, limit: int, task_type: str | None) -> list[OutboxTask]:
        """Atomically claim ≤ ``limit`` pending rows → ``processing``.

        Any DB error inside the WITH block rolls the whole batch back — a
        half-flipped claim is structurally impossible."""
        base = OutboxTask.objects.filter(status=OutboxTask.STATUS_PENDING)
        if task_type:
            base = base.filter(task_type=task_type)

        def claim(qs):
            with transaction.atomic():
                rows = list(qs.order_by('created_at')[:limit])
                stamped = timezone.now()
                for row in rows:
                    row.status = OutboxTask.STATUS_PROCESSING
                    # Ownership stamp: if this worker dies mid-task,
                    # --recover-stale reads it to repark the orphan.
                    row.locked_at = stamped
                    row.save(update_fields=['status', 'locked_at', 'updated_at'])
            return rows

        if connection.features.has_select_for_update_skip_locked:
            return claim(base.select_for_update(skip_locked=True))
        try:
            # Some backends (older MariaDB) advertise FOR UPDATE but not
            # SKIP LOCKED — plain row locking is still correct for claiming.
            if connection.features.has_select_for_update:
                return claim(base.select_for_update())
            return claim(base)
        except OperationalError:
            # SQLite dev: selects serialize per-connection; a plain claim is
            # race-free under the single-writer lock.
            if connection.vendor != 'sqlite':
                raise
            return claim(base)

    # ------------------------------------------------------------- processing

    def _process_one(self, task: OutboxTask) -> str:
        handler = getattr(self, self.HANDLERS[task.task_type])
        try:
            outcome = handler(task)
        except Exception as exc:  # noqa: BLE001 — a broken task must never kill the batch
            task.attempts = int(task.attempts) + 1
            task.last_error = f'{type(exc).__name__}: {exc}'[:2000]
            if task.attempts >= OutboxTask.MAX_ATTEMPTS:
                task.status = OutboxTask.STATUS_FAILED
                # parked FOR the operator: stamp kept as forensic evidence.
                task.save(update_fields=['attempts', 'last_error', 'status', 'updated_at'])
                self.stderr.write(
                    self.style.ERROR(f'✗ تسک #{task.pk} ({task.task_type}) پس از {task.attempts} تلاش FAILED شد: {task.last_error}')
                )
            else:
                task.status = OutboxTask.STATUS_PENDING  # re-park for the next drain
                task.locked_at = None  # ownership released immediately
                task.save(update_fields=['attempts', 'last_error', 'status', 'locked_at', 'updated_at'])
                self.stdout.write(
                    self.style.WARNING(f'↻ تسک #{task.pk} ({task.task_type}) خطا خورد (تلاش {task.attempts}/{OutboxTask.MAX_ATTEMPTS})')
                )
            return 'error'

        task.status = OutboxTask.STATUS_COMPLETED
        task.last_error = ''
        task.locked_at = None
        task.save(update_fields=['status', 'last_error', 'locked_at', 'updated_at'])
        verb = '✓' if outcome == 'done' else '—'
        self.stdout.write(
            self.style.SUCCESS(f'{verb} تسک #{task.pk} ({task.task_type}) — {outcome}')
        )
        return 'done' if outcome == 'done' else 'skipped'

    # -------------------------------------------------------------- handlers

    def _handle_process_image(self, task: OutboxTask) -> str:
        """Regenerate AVIF/WebP srcset for the recorded object.

        IDEMPOTENCY CONTRACT: a re-run either finds the expected image and
        produces the same deterministic filenames (stale duplicate files are
        GC'd below), or finds a different name and skips — never a wrong
        JSON, never a broken link."""
        from shop.image_pipeline import delete_image_variants, generate_image_variants

        p = task.payload or {}
        model = apps.get_model(str(p.get('app_label', 'shop')), str(p.get('model', '')))
        if model is None:
            return 'skipped'  # model renamed/removed: nothing safe to do
        obj = model.objects.filter(pk=p.get('pk')).first()
        if obj is None:
            return 'skipped'  # record deleted after enqueue — legit no-op
        image = obj._image_file()
        if not image or not image.name or image.name != p.get('expected_image'):
            return 'skipped'  # superseded by a newer save; that newer task owns the work

        live_before = dict(obj.image_variants or {})
        variants = generate_image_variants(image, image.name)
        variants['fallback'] = obj.image_url
        model.objects.filter(pk=obj.pk).update(image_variants=variants)
        obj.image_variants = variants

        # GC every superseded variant set: the payload's pre-change JSON and
        # whatever the row held right before this write (crash-rerun debris).
        for stale in (p.get('delete_variants') or {}, live_before):
            if stale and stale != variants:
                delete_image_variants(stale)
        return 'done'

    def _handle_send_otp(self, task: OutboxTask) -> str:
        """Deliver the queued challenge over its ordered channel list.

        IDEMPOTENCY CONTRACT: the plaintext code is a single-flight cache
        entry — popped once. If (and only if) delivery ultimately FAILED we
        re-park the code so the retry can attempt it again; after a
        successful send the entry is gone, so a crash-rerun finds nothing to
        resend. An expired entry ⇒ skip, never send a dead code."""
        from shop.messaging.providers import ProviderError, send_otp
        from shop.task_queue import cache_otp_code_for_delivery, pop_otp_code_for_delivery
        from shop.models import OneTimePassword

        p = task.payload or {}
        challenge = OneTimePassword.objects.filter(pk=p.get('otp_pk')).first()
        if challenge is None:
            return 'skipped'  # challenge deleted (housekeeping) — nothing to send
        request_id = str(challenge.request_id)
        raw_code = pop_otp_code_for_delivery(request_id)
        if not raw_code:
            return 'skipped'  # expired or already delivered by a prior attempt

        channels = [str(channel) for channel in (p.get('channels') or ['sms']) if str(channel)]
        failures: list[Exception] = []
        for channel in channels:
            try:
                result = send_otp(channel, challenge.phone, raw_code, request_id)
            except ProviderError as exc:
                failures.append(exc)
                continue
            challenge.delivery_channel = channel
            challenge.provider_message_id = result.message_id[:200]
            challenge.save(update_fields=['delivery_channel', 'provider_message_id'])
            return 'done'

        cache_otp_code_for_delivery(request_id, raw_code)  # re-park for the retry pass
        challenge.last_error = ' | '.join(str(error) for error in failures)[:2000]
        challenge.save(update_fields=['last_error'])
        raise RuntimeError(f'ارسال OTP روی همه‌ی کانال‌ها ناموفق بود: {failures[-1] if failures else "no channels"}')

    def _handle_send_notification(self, task: OutboxTask) -> str:
        """Placeholder — dedicated notification outbox lands in a later phase."""
        return 'done'

    # ----------------------------------------------------------- dry reporting

    def _recover_stale(self) -> None:
        """Hand orphaned claims back to the queue.

        A worker that dies between claim and finish leaves its rows at
        ``processing`` forever; rows older than ``STALE_MINUTES`` without a
        finished state are by definition abandoned (no task legitimately
        holds a claim that long — handlers are bounded to seconds, not
        minutes). Attempts reset to zero: the orphan's partial progress was
        never (and can never be) observed, so a clean slate is the only
        honest state. NULL ``locked_at`` (pre-upgrade rows) counts as stale
        immediately — it can never prove a live owner."""
        cutoff = timezone.now() - timedelta(minutes=self.STALE_MINUTES)
        stale = list(
            OutboxTask.objects
            .filter(status=OutboxTask.STATUS_PROCESSING)
            .filter(Q(locked_at__lt=cutoff) | Q(locked_at__isnull=True))
            .order_by('created_at')
        )
        for row in stale:
            row.status = OutboxTask.STATUS_PENDING
            row.attempts = 0
            row.locked_at = None
            row.last_error = ''
            row.save(update_fields=['status', 'attempts', 'locked_at', 'last_error', 'updated_at'])
        if stale:
            self.stdout.write(
                self.style.WARNING(
                    f'🛟 بازیابی: {len(stale)} تسک گیرکرده پس از {self.STALE_MINUTES} دقیقه به صف بازگشتند '
                    f'(شناسه‌ها: {[r.pk for r in stale]})'
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS('🛟 بازیابی: هیچ تسک گیرکرده‌ای یافت نشد؛ صف سالم است.'))

    def _report_queue(self, task_type: str | None) -> None:
        qs = OutboxTask.objects.all()
        if task_type:
            qs = qs.filter(task_type=task_type)
        self.stdout.write(self.style.SUCCESS('📋 گزارش dry-run صف Outbox'))
        for status, label in OutboxTask.STATUS_CHOICES:
            count = qs.filter(status=status).count()
            if count:
                self.stdout.write(f'  • {label} ({status}): {count}')
        for row in qs.filter(status=OutboxTask.STATUS_PENDING).order_by('created_at')[:20]:
            self.stdout.write(
                f'    #{row.pk} {row.task_type} — تلاش {row.attempts} — {row.created_at:%H:%M:%S}'
            )
