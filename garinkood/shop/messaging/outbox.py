"""Transactional event routing into the durable notification outbox."""

from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass
from typing import Iterable

from django.conf import settings
from django.db import transaction

from shop.models import (
    NotificationDelivery,
    NotificationRecipient,
    NotificationTemplate,
    Order,
)
from shop.phone_numbers import mask_phone, normalize_iranian_mobile


DEFAULT_BODIES: dict[tuple[str, str, str], str] = {
    ('order_created', 'owner', 'telegram'): (
        '🛒 سفارش جدید {order_code}\n'
        'مشتری: {customer_name} ({customer_phone})\n'
        'اقلام: {items}\n'
        'مبلغ: {total_price} تومان\n'
        'شهر: {city}\n'
        'پرداخت: {payment_status_label} | وضعیت: {status_label}\n'
        '{admin_url}'
    ),
    ('order_created', 'owner', 'bale'): (
        '🛒 سفارش جدید {order_code}\n'
        'مشتری: {customer_name} ({customer_phone})\n'
        'اقلام: {items}\n'
        'مبلغ: {total_price} تومان\n'
        'شهر: {city}\n'
        'پرداخت: {payment_status_label} | وضعیت: {status_label}\n'
        '{admin_url}'
    ),
    ('order_created', 'owner', 'sms'): (
        'سفارش جدید {order_code} | {customer_name} | {total_price} تومان | '
        '{city} | {status_label}'
    ),
    ('order_created', 'owner', 'whatsapp'): (
        'سفارش جدید {order_code}\n{customer_name}\n{items}\n'
        '{total_price} تومان\n{status_label}\n{admin_url}'
    ),
    ('order_status_changed', 'owner', 'telegram'): (
        'وضعیت سفارش {order_code} تغییر کرد.\n'
        'وضعیت: {status_label}\nپرداخت: {payment_status_label}\n{admin_url}'
    ),
    ('order_status_changed', 'owner', 'bale'): (
        'وضعیت سفارش {order_code} تغییر کرد.\n'
        'وضعیت: {status_label}\nپرداخت: {payment_status_label}\n{admin_url}'
    ),
    ('order_status_changed', 'owner', 'sms'): (
        'سفارش {order_code}: {status_label}؛ پرداخت: {payment_status_label}'
    ),
    ('order_status_changed', 'owner', 'whatsapp'): (
        'سفارش {order_code}: {status_label}؛ پرداخت: {payment_status_label}'
    ),
    ('order_status_changed', 'customer', 'sms'): (
        'گرین کود: وضعیت سفارش {order_code} به «{status_label}» تغییر کرد.'
    ),
    ('order_status_changed', 'customer', 'bale'): (
        'گرین کود: وضعیت سفارش {order_code} به «{status_label}» تغییر کرد.'
    ),
    ('order_status_changed', 'customer', 'whatsapp'): (
        'گرین کود: وضعیت سفارش {order_code} به «{status_label}» تغییر کرد.'
    ),
}

_TOKEN_PATTERN = re.compile(r'\{([A-Za-z0-9_]+)\}')
_CHANNEL_LIMITS = {'sms': 1800, 'bale': 4000, 'telegram': 4000, 'whatsapp': 4000}


@dataclass(frozen=True)
class Route:
    channel: str
    destination: str
    audience: str = NotificationTemplate.AUDIENCE_OWNER


def _channel_enabled(channel: str) -> bool:
    if settings.MESSAGING_FAKE:
        return True
    return {
        'sms': settings.MESSAGING_ENABLE_SMS,
        'bale': settings.MESSAGING_ENABLE_BALE,
        'telegram': settings.MESSAGING_ENABLE_TELEGRAM,
        'whatsapp': settings.MESSAGING_ENABLE_WHATSAPP,
    }.get(channel, False)


def _environment_owner_routes(event: str) -> Iterable[Route]:
    mapping = {
        'telegram': settings.NOTIFICATION_ADMIN_TELEGRAM_CHAT_IDS,
        'bale': settings.NOTIFICATION_ADMIN_BALE_CHAT_IDS,
        'sms': settings.NOTIFICATION_ADMIN_SMS_NUMBERS,
        'whatsapp': settings.NOTIFICATION_ADMIN_WHATSAPP_NUMBERS,
    }
    for channel, destinations in mapping.items():
        if not _channel_enabled(channel):
            continue
        for destination in destinations:
            destination = str(destination).strip()
            if destination:
                yield Route(channel, destination)


def _database_owner_routes(event: str) -> Iterable[Route]:
    recipients = NotificationRecipient.objects.filter(is_active=True)
    if event == NotificationTemplate.EVENT_ORDER_CREATED:
        recipients = recipients.filter(receive_order_created=True)
    elif event == NotificationTemplate.EVENT_ORDER_STATUS_CHANGED:
        recipients = recipients.filter(receive_order_status_changed=True)
    for recipient in recipients.iterator():
        if _channel_enabled(recipient.channel):
            yield Route(recipient.channel, recipient.destination)


def _customer_routes(order: Order, event: str) -> Iterable[Route]:
    if event != NotificationTemplate.EVENT_ORDER_STATUS_CHANGED:
        return
    for channel in settings.NOTIFICATION_CUSTOMER_STATUS_CHANNELS:
        channel = str(channel).strip()
        if channel not in {'sms', 'bale', 'whatsapp'} or not _channel_enabled(channel):
            continue
        try:
            phone = normalize_iranian_mobile(order.phone)
        except ValueError:
            continue
        destination = f'phone:{phone}' if channel == 'bale' else phone
        yield Route(channel, destination, NotificationTemplate.AUDIENCE_CUSTOMER)


def _normalise_destination(channel: str, destination: str) -> str:
    destination = destination.strip()
    try:
        if channel in {'sms', 'whatsapp'}:
            return normalize_iranian_mobile(destination)
        if channel == 'bale' and destination.startswith('phone:'):
            return f'phone:{normalize_iranian_mobile(destination.removeprefix("phone:"))}'
    except ValueError:
        return ''
    return destination


def _routes(order: Order, event: str) -> list[Route]:
    unique: dict[tuple[str, str, str], Route] = {}
    for route in (
        *_environment_owner_routes(event),
        *_database_owner_routes(event),
        *_customer_routes(order, event),
    ):
        destination = _normalise_destination(route.channel, route.destination)
        if destination:
            unique[(route.channel, destination, route.audience)] = Route(
                route.channel, destination, route.audience
            )
    return list(unique.values())


def _order_context(order: Order) -> dict[str, str]:
    lines = []
    for item in order.items.all():
        unit = f' {item.unit}' if item.unit else ''
        lines.append(f'{item.product_title} × {item.quantity}{unit}')
    items = '، '.join(lines) or '—'
    admin_base = getattr(settings, 'ADMIN_PUBLIC_URL', settings.SITE_URL).rstrip('/')
    return {
        'order_code': order.code,
        'customer_name': order.customer_name,
        # The default copy is deliberately masked. An operator can follow the
        # authenticated admin link for full order/address details.
        'customer_phone': mask_phone(order.phone),
        # Full PII is available only when an operator deliberately adds these
        # variables to a trusted-channel template; defaults never include it.
        'customer_phone_full': order.phone,
        'email': order.email,
        'address': order.address,
        'postal_code': order.postal_code,
        'notes': order.notes,
        'items': items[:1200],
        'subtotal': f'{order.subtotal:,}',
        'shipping_price': f'{order.shipping_price:,}',
        'discount_amount': f'{order.discount_amount:,}',
        'total_price': f'{order.total_price:,}',
        'province': order.province,
        'city': order.city,
        'status': order.status,
        'status_label': order.get_status_display(),
        'payment_status': order.payment_status,
        'payment_status_label': order.get_payment_status_display(),
        'payment_method_label': order.get_payment_method_display(),
        'admin_url': f'{admin_base}/admin/shop/order/{order.pk}/change/',
    }


def _render(body: str, context: dict[str, str], channel: str) -> str:
    rendered = _TOKEN_PATTERN.sub(lambda match: context.get(match.group(1), match.group(0)), body)
    limit = _CHANNEL_LIMITS.get(channel, 4000)
    if len(rendered) > limit:
        rendered = f'{rendered[:limit - 1]}…'
    return rendered


def _template_for(event: str, audience: str, channel: str) -> tuple[NotificationTemplate | None, str] | None:
    template = NotificationTemplate.objects.filter(
        event=event,
        audience=audience,
        channel=channel,
    ).first()
    if template:
        if not template.is_active:
            return None
        return template, template.body
    default = DEFAULT_BODIES.get((event, audience, channel))
    return (None, default) if default else None


def _idempotency_key(order: Order, event: str, route: Route) -> str:
    recipient_hash = hashlib.sha256(route.destination.encode('utf-8')).hexdigest()[:20]
    event_instance = event
    if event == NotificationTemplate.EVENT_ORDER_STATUS_CHANGED:
        event_instance = (
            f'{event}:{order.status}:{order.payment_status}:'
            f'{order.updated_at.isoformat(timespec="microseconds")}'
        )
    return f'{event_instance}:{order.pk}:{route.audience}:{route.channel}:{recipient_hash}'[:160]


def enqueue_order_event(order: Order, event: str) -> int:
    """Persist all routes for an order event without performing network I/O."""

    if event not in {
        NotificationTemplate.EVENT_ORDER_CREATED,
        NotificationTemplate.EVENT_ORDER_STATUS_CHANGED,
    }:
        raise ValueError('Unsupported order notification event.')
    context = _order_context(order)
    created_count = 0
    with transaction.atomic():
        for route in _routes(order, event):
            selected = _template_for(event, route.audience, route.channel)
            if selected is None:
                continue
            template, body = selected
            provider_options: dict[str, object] = {}
            if template and template.provider_template_name:
                provider_options = {
                    'template_name': template.provider_template_name,
                    'language_code': template.language_code,
                    'template_parameters': (
                        [context['order_code'], context['customer_name'], context['total_price'], context['status_label']]
                        if event == NotificationTemplate.EVENT_ORDER_CREATED
                        else [context['order_code'], context['status_label']]
                    ),
                }
            _, created = NotificationDelivery.objects.get_or_create(
                idempotency_key=_idempotency_key(order, event, route),
                defaults={
                    'order': order,
                    'template': template,
                    'event': event,
                    'audience': route.audience,
                    'channel': route.channel,
                    'recipient': route.destination,
                    'rendered_content': _render(body, context, route.channel),
                    'payload': {
                        'order_code': context['order_code'],
                        'provider_options': provider_options,
                    },
                    'max_attempts': settings.NOTIFICATION_MAX_ATTEMPTS,
                },
            )
            created_count += int(created)
    return created_count


def enqueue_test_delivery(recipient: NotificationRecipient) -> NotificationDelivery:
    """Queue a harmless test message from the Django admin action."""

    if not _channel_enabled(recipient.channel):
        raise ValueError('این کانال در تنظیمات محیطی فعال نیست.')
    template = NotificationTemplate.objects.filter(
        event=NotificationTemplate.EVENT_TEST,
        audience=NotificationTemplate.AUDIENCE_OWNER,
        channel=recipient.channel,
    ).first()
    if template and not template.is_active:
        raise ValueError('قالب پیام آزمایشی این کانال غیرفعال است.')
    body = template.body if template else (
        'پیام آزمایشی گرین کود: اتصال کانال پیام‌رسان با موفقیت در صف بررسی قرار گرفت.'
    )
    provider_options = {}
    if template and template.provider_template_name:
        provider_options = {
            'template_name': template.provider_template_name,
            'language_code': template.language_code,
            'template_parameters': [],
        }
    nonce = uuid.uuid4().hex
    return NotificationDelivery.objects.create(
        template=template,
        event=NotificationTemplate.EVENT_TEST,
        audience=NotificationTemplate.AUDIENCE_OWNER,
        channel=recipient.channel,
        recipient=recipient.destination,
        rendered_content=body,
        payload={'provider_options': provider_options},
        idempotency_key=f'test:{recipient.pk}:{nonce}',
        max_attempts=settings.NOTIFICATION_MAX_ATTEMPTS,
    )
