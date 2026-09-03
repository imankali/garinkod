"""Claim and process durable notification outbox rows with bounded retries."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from shop.models import NotificationDelivery

from .providers import ProviderError, send_delivery


def recover_stale_deliveries() -> int:
    """Return rows abandoned by a crashed worker to the retry queue."""

    cutoff = timezone.now() - timedelta(seconds=settings.NOTIFICATION_WORKER_STALE_SECONDS)
    return NotificationDelivery.objects.filter(
        status=NotificationDelivery.STATUS_PROCESSING,
        locked_at__lt=cutoff,
    ).update(
        status=NotificationDelivery.STATUS_RETRY,
        next_attempt_at=timezone.now(),
        locked_at=None,
        last_error='ارسال قبلی بدون ثبت نتیجه متوقف شد؛ برای تلاش مجدد بازیابی شد.',
        updated_at=timezone.now(),
    )


def _claim(delivery_id) -> NotificationDelivery | None:
    with transaction.atomic():
        delivery = NotificationDelivery.objects.select_for_update().filter(pk=delivery_id).first()
        if not delivery or delivery.status not in {
            NotificationDelivery.STATUS_PENDING,
            NotificationDelivery.STATUS_RETRY,
        }:
            return None
        if delivery.next_attempt_at > timezone.now():
            return None
        delivery.status = NotificationDelivery.STATUS_PROCESSING
        delivery.attempt_count += 1
        delivery.locked_at = timezone.now()
        delivery.save(update_fields=['status', 'attempt_count', 'locked_at', 'updated_at'])
        return delivery


def _finish_success(delivery: NotificationDelivery, result) -> None:
    NotificationDelivery.objects.filter(
        pk=delivery.pk,
        status=NotificationDelivery.STATUS_PROCESSING,
    ).update(
        status=NotificationDelivery.STATUS_SENT,
        provider_message_id=result.message_id[:200],
        provider_response=result.response or {},
        last_error='',
        sent_at=timezone.now(),
        locked_at=None,
        updated_at=timezone.now(),
    )


def _finish_failure(delivery: NotificationDelivery, error: ProviderError) -> None:
    final = not error.retryable or delivery.attempt_count >= delivery.max_attempts
    if final:
        status = NotificationDelivery.STATUS_FAILED
        next_attempt_at = delivery.next_attempt_at
    else:
        status = NotificationDelivery.STATUS_RETRY
        delay_seconds = min(30 * (2 ** max(delivery.attempt_count - 1, 0)), 3600)
        next_attempt_at = timezone.now() + timedelta(seconds=delay_seconds)
    NotificationDelivery.objects.filter(
        pk=delivery.pk,
        status=NotificationDelivery.STATUS_PROCESSING,
    ).update(
        status=status,
        next_attempt_at=next_attempt_at,
        last_error=str(error)[:2000],
        locked_at=None,
        updated_at=timezone.now(),
    )


def process_delivery(delivery_id) -> bool:
    """Process one due row. Return true only when this worker claimed it."""

    delivery = _claim(delivery_id)
    if delivery is None:
        return False
    try:
        result = send_delivery(delivery)
    except ProviderError as exc:
        _finish_failure(delivery, exc)
    except Exception:
        # Programming errors should be visible to process monitoring rather
        # than hidden as a provider retry, but release the claim first so an
        # operator can retry the row after deploying a fix.
        _finish_failure(delivery, ProviderError('خطای داخلی پردازش پیام.', retryable=False))
        raise
    else:
        _finish_success(delivery, result)
    return True


def process_due_deliveries(limit: int = 100) -> int:
    recover_stale_deliveries()
    due_ids = list(
        NotificationDelivery.objects.filter(
            status__in=[NotificationDelivery.STATUS_PENDING, NotificationDelivery.STATUS_RETRY],
            next_attempt_at__lte=timezone.now(),
        )
        .order_by('next_attempt_at', 'created_at')
        .values_list('pk', flat=True)[:limit]
    )
    processed = 0
    for delivery_id in due_ids:
        processed += int(process_delivery(delivery_id))
    return processed
