"""Durable, database-backed task outbox for background work.

One row = one unit of work that MUST NOT run inside a request thread
(image variant encoding, OTP/notification provider I/O). Workers claim rows
with ``SELECT ... FOR UPDATE SKIP LOCKED``, so several cron/supervisor
processes can drain the queue concurrently without ever processing the same
task twice. SQLite dev (no SKIP LOCKED) still behaves correctly because the
claim update happens inside one short transaction.
"""

from django.db import models


class OutboxTask(models.Model):
    TASK_PROCESS_IMAGE = 'process_image'
    TASK_SEND_OTP = 'send_otp'
    TASK_SEND_NOTIFICATION = 'send_notification'
    TASK_CHOICES = (
        (TASK_PROCESS_IMAGE, 'بازتولید واریانت‌های تصویر'),
        (TASK_SEND_OTP, 'ارسال کد یک‌بارمصرف'),
        (TASK_SEND_NOTIFICATION, 'ارسال نوتیفیکیشن'),
    )

    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'در انتظار'),
        (STATUS_PROCESSING, 'در حال اجرا'),
        (STATUS_COMPLETED, 'انجام‌شده'),
        (STATUS_FAILED, 'ناموفق'),
    )

    #: After this many failed attempts the row parks at ``failed`` for an
    #: operator to inspect — never silently deleted.
    MAX_ATTEMPTS = 3

    task_type = models.CharField(max_length=30, choices=TASK_CHOICES, db_index=True)
    payload = models.JSONField(default=dict)
    status = models.CharField(
        max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=2000, blank=True)
    # Ownership stamp written by the claiming worker. When a worker dies
    # mid-task the row would otherwise sit at ``processing`` forever; the
    # ``--recover-stale`` sweep of the consumer command uses this stamp to
    # hand genuinely orphaned rows back to ``pending``.
    locked_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('created_at',)
        indexes = [
            # The hot drain query: WHERE status = 'pending' ORDER BY created_at
            # — kept one composite key away from a full scan at any volume.
            models.Index(fields=('status', 'created_at'), name='outboxtask_poll_idx'),
        ]
        verbose_name = 'تسک پس‌زمینه (Outbox)'
        verbose_name_plural = 'تسک‌های پس‌زمینه (Outbox)'

    def __str__(self):
        return f'{self.task_type}#{self.pk} — {self.status}'
