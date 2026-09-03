"""Signed inbound status webhooks for official provider APIs."""

from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone as datetime_timezone

from ..schema import documented_api
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from rest_framework import permissions, status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.response import Response

from shop.models import NotificationDelivery


def _valid_meta_signature(raw_body: bytes, supplied: str) -> bool:
    if not settings.WHATSAPP_APP_SECRET or not supplied.startswith('sha256='):
        return False
    expected = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode('utf-8'),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return constant_time_compare(supplied.removeprefix('sha256='), expected)


def _status_timestamp(value) -> datetime:
    try:
        return datetime.fromtimestamp(int(value), tz=datetime_timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return timezone.now()


def _apply_whatsapp_status(status_payload: dict) -> None:
    message_id = str(status_payload.get('id') or '')
    provider_status = str(status_payload.get('status') or '')
    if not message_id or provider_status not in {'sent', 'delivered', 'read', 'failed'}:
        return
    delivery = NotificationDelivery.objects.filter(
        channel='whatsapp',
        provider_message_id=message_id,
    ).first()
    if not delivery:
        return

    received_at = _status_timestamp(status_payload.get('timestamp'))
    delivery.provider_response = {
        **(delivery.provider_response or {}),
        'webhook': {
            'status': provider_status,
            'timestamp': received_at.isoformat(),
        },
    }
    fields = ['provider_response', 'updated_at']
    if provider_status in {'delivered', 'read'}:
        delivery.status = NotificationDelivery.STATUS_DELIVERED
        delivery.delivered_at = delivery.delivered_at or received_at
        fields.extend(['status', 'delivered_at'])
    elif provider_status == 'sent' and delivery.status not in {
        NotificationDelivery.STATUS_DELIVERED,
        NotificationDelivery.STATUS_FAILED,
    }:
        delivery.status = NotificationDelivery.STATUS_SENT
        delivery.sent_at = delivery.sent_at or received_at
        fields.extend(['status', 'sent_at'])
    elif provider_status == 'failed':
        errors = status_payload.get('errors') or []
        first = errors[0] if errors and isinstance(errors[0], dict) else {}
        error_code = str(first.get('code') or '')
        error_title = str(first.get('title') or first.get('message') or 'WhatsApp delivery failed')
        delivery.status = NotificationDelivery.STATUS_FAILED
        delivery.last_error = f'{error_code}: {error_title}'.strip(': ')[:2000]
        fields.extend(['status', 'last_error'])
    delivery.save(update_fields=fields)


@documented_api
@api_view(['GET', 'POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
@throttle_classes([])
def whatsapp_webhook(request):
    """Verify Meta's challenge and consume HMAC-authenticated status updates."""

    if request.method == 'GET':
        mode = request.query_params.get('hub.mode')
        token = request.query_params.get('hub.verify_token', '')
        challenge = request.query_params.get('hub.challenge', '')
        if (
            mode == 'subscribe'
            and settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN
            and constant_time_compare(token, settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN)
        ):
            return HttpResponse(challenge, content_type='text/plain')
        return Response({'error': 'تأیید webhook ناموفق بود.'}, status=status.HTTP_403_FORBIDDEN)

    raw_body = request.body
    signature = request.META.get('HTTP_X_HUB_SIGNATURE_256', '')
    if not _valid_meta_signature(raw_body, signature):
        return Response({'error': 'امضای webhook معتبر نیست.'}, status=status.HTTP_403_FORBIDDEN)

    payload = request.data if isinstance(request.data, dict) else {}
    for entry in payload.get('entry', []):
        if not isinstance(entry, dict):
            continue
        for change in entry.get('changes', []):
            if not isinstance(change, dict):
                continue
            value = change.get('value') or {}
            if not isinstance(value, dict):
                continue
            for status_payload in value.get('statuses', []):
                if isinstance(status_payload, dict):
                    _apply_whatsapp_status(status_payload)
    return Response({'received': True})
