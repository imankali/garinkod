"""The sanctioned entry points into the durable background outbox.

Request threads never perform heavy side effects (image re-encoding,
provider I/O) themselves — they record an :class:`~shop.models.OutboxTask`
row and answer the client immediately. The ``process_async_tasks``
management command drains the queue (cron/supervisor in production, manual
or dev-loop locally).
"""

from __future__ import annotations

from django.conf import settings
from django.core.cache import cache


def enqueue(task_type: str, payload: dict):
    """Persist one unit of background work; returns the OutboxTask row."""
    from .models import OutboxTask  # local import: keeps settings load order safe

    return OutboxTask.objects.create(task_type=task_type, payload=payload)


def enqueue_image_variants(instance, *, old_variants: dict | None = None):
    """Queue AVIF/WebP regeneration for an ImageVariantsMixin instance.

    ``expected_image`` lets the worker drop superseded tasks: when two saves
    race, only the task matching the CURRENT stored name does real work.
    ``delete_variants`` carries the pre-change JSON so the worker can garbage
    collect orphan variant files after the new set exists."""
    from .models import OutboxTask

    image = instance._image_file()
    return enqueue(
        OutboxTask.TASK_PROCESS_IMAGE,
        {
            'app_label': instance._meta.app_label,
            'model': instance._meta.model_name,
            'pk': instance.pk,
            'image_source_field': instance.image_source_field,
            'expected_image': image.name if image else '',
            'delete_variants': dict(old_variants or {}),
        },
    )


def enqueue_otp_delivery(otp_pk: int, channels: list[str]):
    """Queue delivery of an already-persisted, already-hashed OTP challenge."""
    from .models import OutboxTask

    return enqueue(OutboxTask.TASK_SEND_OTP, {'otp_pk': otp_pk, 'channels': channels})


_OTP_CODE_CACHE_PREFIX = 'otp:async-deliver:'


def cache_otp_code_for_delivery(request_id: str, raw_code: str) -> None:
    """Stash the plaintext OTP where only the delivery worker can pop it.

    Uses the shared cache that OTP cooldown rate-limiting already mandates in
    production (shop/checks.E007), with a TTL equal to the code's own
    lifetime — the challenge row keeps NO plaintext code, as before."""
    cache.set(
        f'{_OTP_CODE_CACHE_PREFIX}{request_id}',
        raw_code,
        timeout=int(settings.OTP_TTL_SECONDS),
    )


def pop_otp_code_for_delivery(request_id: str) -> str | None:
    """One-shot read-and-destroy; a second worker finds nothing to leak."""
    key = f'{_OTP_CODE_CACHE_PREFIX}{request_id}'
    code = cache.get(key)
    if code is not None:
        cache.delete(key)
    return code
