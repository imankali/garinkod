"""Messaging domain models for the shop app (split from models.py)."""

import uuid
from simple_history.models import HistoricalRecords
from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid
from django.core.exceptions import ValidationError
from .orders import Order



# --- External messaging and mobile OTP ---
class OneTimePassword(models.Model):
    """A single mobile-login challenge.

    Only Django's salted password hash is persisted; the raw code exists in
    memory just long enough to call the selected provider.
    """

    PURPOSE_LOGIN = 'login'
    PURPOSE_CHOICES = ((PURPOSE_LOGIN, 'ورود'),)
    STATUS_PENDING = 'pending'
    STATUS_VERIFIED = 'verified'
    STATUS_EXPIRED = 'expired'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'در انتظار تأیید'),
        (STATUS_VERIFIED, 'تأیید شده'),
        (STATUS_EXPIRED, 'منقضی شده'),
        (STATUS_FAILED, 'ناموفق/مسدود'),
    )

    request_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    phone = models.CharField(max_length=11, db_index=True, verbose_name='شماره موبایل')
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default=PURPOSE_LOGIN)
    code_hash = models.CharField(max_length=128, editable=False)
    delivery_channel = models.CharField(max_length=20, blank=True)
    provider_message_id = models.CharField(max_length=200, blank=True)
    last_error = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    requested_ip = models.GenericIPAddressField(null=True, blank=True)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'کد یک‌بارمصرف'
        verbose_name_plural = 'کدهای یک‌بارمصرف'
        indexes = [
            models.Index(fields=['phone', 'status', '-created_at'], name='otp_phone_status_idx'),
        ]

    def __str__(self):
        return f'{self.phone} — {self.get_status_display()}'


class NotificationTemplate(models.Model):
    """Editable, non-secret copy for one event/audience/channel route."""

    EVENT_ORDER_CREATED = 'order_created'
    EVENT_ORDER_STATUS_CHANGED = 'order_status_changed'
    EVENT_TEST = 'test'
    EVENT_CHOICES = (
        (EVENT_ORDER_CREATED, 'سفارش جدید'),
        (EVENT_ORDER_STATUS_CHANGED, 'تغییر وضعیت سفارش'),
        (EVENT_TEST, 'ارسال آزمایشی'),
    )
    AUDIENCE_OWNER = 'owner'
    AUDIENCE_CUSTOMER = 'customer'
    AUDIENCE_SELLER = 'seller'
    AUDIENCE_CHOICES = (
        (AUDIENCE_OWNER, 'مالک/مدیر'),
        (AUDIENCE_CUSTOMER, 'مشتری'),
        (AUDIENCE_SELLER, 'غرفه‌دار'),
    )
    CHANNEL_SMS = 'sms'
    CHANNEL_BALE = 'bale'
    CHANNEL_TELEGRAM = 'telegram'
    CHANNEL_WHATSAPP = 'whatsapp'
    CHANNEL_WEBPUSH = 'webpush'
    CHANNEL_CHOICES = (
        (CHANNEL_SMS, 'پیامک'),
        (CHANNEL_BALE, 'بله'),
        (CHANNEL_TELEGRAM, 'تلگرام'),
        (CHANNEL_WHATSAPP, 'واتساپ رسمی'),
        (CHANNEL_WEBPUSH, 'اعلان مرورگر'),
    )

    name = models.CharField(max_length=120, verbose_name='نام داخلی')
    event = models.CharField(max_length=40, choices=EVENT_CHOICES, db_index=True)
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    body = models.TextField(
        verbose_name='متن قالب',
        help_text='متغیرها با آکولاد نوشته می‌شوند؛ نمونه: {order_code} و {total_price}.',
    )
    provider_template_name = models.CharField(
        max_length=160,
        blank=True,
        help_text='نام قالب تأییدشده ارائه‌دهنده، مخصوصاً برای WhatsApp Cloud API.',
    )
    language_code = models.CharField(max_length=16, default='fa')
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ('event', 'audience', 'channel')
        verbose_name = 'قالب پیام‌رسانی'
        verbose_name_plural = 'قالب‌های پیام‌رسانی'
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'audience', 'channel'],
                name='unique_notification_template_route',
            ),
        ]

    def __str__(self):
        return f'{self.get_event_display()} / {self.get_audience_display()} / {self.get_channel_display()}'


class WebPushSubscription(models.Model):
    """One browser push endpoint explicitly opted in by an authenticated user."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='webpush_subscriptions'
    )
    endpoint = models.URLField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    failure_count = models.PositiveSmallIntegerField(default=0)
    last_used_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at',)
        verbose_name = 'اشتراک اعلان مرورگر'
        verbose_name_plural = 'اشتراک‌های اعلان مرورگر'

    def __str__(self):
        return f'{self.user.username} — {str(self.id)[:8]}'

    @property
    def subscription_info(self) -> dict:
        return {
            'endpoint': self.endpoint,
            'keys': {'p256dh': self.p256dh, 'auth': self.auth},
        }


class NotificationRecipient(models.Model):
    """A fixed administrative destination; API credentials remain in env."""

    name = models.CharField(max_length=120)
    channel = models.CharField(max_length=20, choices=NotificationTemplate.CHANNEL_CHOICES)
    destination = models.CharField(
        max_length=200,
        help_text='شناسه چت برای تلگرام/بله یا شماره E.164 برای پیامک/واتساپ.',
    )
    receive_order_created = models.BooleanField(default=True)
    receive_order_status_changed = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('name',)
        verbose_name = 'گیرنده پیام مدیریتی'
        verbose_name_plural = 'گیرندگان پیام مدیریتی'
        constraints = [
            models.UniqueConstraint(
                fields=['channel', 'destination'],
                name='unique_notification_recipient',
            ),
        ]

    def clean(self):
        super().clean()
        from ..phone_numbers import normalize_iranian_mobile

        if self.channel in {'sms', 'whatsapp'}:
            try:
                self.destination = normalize_iranian_mobile(self.destination)
            except ValueError as exc:
                raise ValidationError({'destination': str(exc)}) from exc
        elif self.channel == 'bale' and self.destination.startswith('phone:'):
            try:
                phone = normalize_iranian_mobile(self.destination.removeprefix('phone:'))
            except ValueError as exc:
                raise ValidationError({'destination': str(exc)}) from exc
            self.destination = f'phone:{phone}'

    def __str__(self):
        return f'{self.name} — {self.get_channel_display()}'


class NotificationDelivery(models.Model):
    """Durable transactional outbox row and its complete delivery history."""

    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_RETRY = 'retry'
    STATUS_SENT = 'sent'
    STATUS_DELIVERED = 'delivered'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'در صف'),
        (STATUS_PROCESSING, 'در حال ارسال'),
        (STATUS_RETRY, 'منتظر تلاش مجدد'),
        (STATUS_SENT, 'ارسال شده'),
        (STATUS_DELIVERED, 'تحویل شده'),
        (STATUS_FAILED, 'ناموفق نهایی'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='notification_deliveries',
    )
    template = models.ForeignKey(
        NotificationTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='deliveries',
    )
    event = models.CharField(max_length=40, choices=NotificationTemplate.EVENT_CHOICES, db_index=True)
    audience = models.CharField(max_length=20, choices=NotificationTemplate.AUDIENCE_CHOICES)
    channel = models.CharField(max_length=20, choices=NotificationTemplate.CHANNEL_CHOICES)
    recipient = models.CharField(max_length=200)
    rendered_content = models.TextField()
    payload = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=160, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=6)
    next_attempt_at = models.DateTimeField(default=timezone.now, db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    provider_message_id = models.CharField(max_length=200, blank=True)
    provider_response = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'ارسال پیام'
        verbose_name_plural = 'صف و تاریخچه ارسال پیام‌ها'
        indexes = [
            models.Index(fields=['status', 'next_attempt_at'], name='notify_due_idx'),
            models.Index(fields=['event', '-created_at'], name='notify_event_idx'),
            models.Index(
                fields=['channel', 'provider_message_id'],
                name='notify_provider_msg_idx',
            ),
        ]

    def __str__(self):
        return f'{self.get_event_display()} / {self.get_channel_display()} / {self.get_status_display()}'


# ========================================
# Site content: articles, growing guides, services, landing pages, trust pages
# ========================================

