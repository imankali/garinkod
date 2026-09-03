"""Deployment checks for every explicitly enabled external integration."""

from urllib.parse import urlparse
from uuid import UUID

from django.conf import settings
from django.core import checks


def _missing(*names: str) -> list[str]:
    return [name for name in names if getattr(settings, name, None) in (None, '', 0)]


@checks.register(checks.Tags.security)
def messaging_configuration_check(app_configs, **kwargs):
    errors = []
    if settings.MESSAGING_FAKE:
        if not settings.DEBUG:
            errors.append(
                checks.Error(
                    'MESSAGING_FAKE در محیط production مجاز نیست.',
                    id='shop.E000',
                )
            )
        return errors
    if settings.MESSAGING_ENABLE_SMS:
        if settings.SMS_PROVIDER == 'smsir':
            missing = _missing('SMSIR_API_KEY', 'SMSIR_OTP_TEMPLATE_ID')
        elif settings.SMS_PROVIDER == 'kavenegar':
            missing = _missing('KAVENEGAR_API_KEY', 'KAVENEGAR_OTP_TEMPLATE')
        else:
            missing = ['SMS_PROVIDER (smsir یا kavenegar)']
        if missing:
            errors.append(
                checks.Error(
                    f'کانال پیامک فعال است اما این تنظیمات خالی‌اند: {", ".join(missing)}',
                    id='shop.E001',
                )
            )
    if settings.MESSAGING_ENABLE_BALE:
        missing = (
            _missing('BALE_SAFIR_API_KEY', 'BALE_SAFIR_BOT_ID')
            if 'bale' in settings.OTP_DELIVERY_CHANNELS
            else []
        )
        if missing:
            errors.append(
                checks.Error(
                    f'کانال بله برای OTP فعال است اما این تنظیمات خالی‌اند: {", ".join(missing)}',
                    id='shop.E002',
                )
            )
        if settings.NOTIFICATION_ADMIN_BALE_CHAT_IDS and not settings.BALE_BOT_TOKEN:
            errors.append(
                checks.Error(
                    'گیرنده مدیریتی بله تنظیم شده اما BALE_BOT_TOKEN خالی است.',
                    id='shop.E003',
                )
            )
    if settings.MESSAGING_ENABLE_TELEGRAM and _missing('TELEGRAM_BOT_TOKEN'):
        errors.append(
            checks.Error('تلگرام فعال است اما TELEGRAM_BOT_TOKEN خالی است.', id='shop.E004')
        )
    if settings.MESSAGING_ENABLE_WHATSAPP:
        missing = _missing(
            'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID',
            'WHATSAPP_APP_SECRET', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
        )
        if missing:
            errors.append(
                checks.Error(
                    f'واتساپ فعال است اما این تنظیمات خالی‌اند: {", ".join(missing)}',
                    id='shop.E005',
                )
            )
    if (
        not settings.DEBUG
        and (settings.MESSAGING_ENABLE_SMS or settings.MESSAGING_ENABLE_BALE)
        and not settings.CACHE_URL
    ):
        errors.append(
            checks.Error(
                'OTP در production به CACHE_URL/Redis مشترک برای cooldown و محدودیت per-phone نیاز دارد.',
                id='shop.E007',
            )
        )
    invalid_otp_channels = set(settings.OTP_DELIVERY_CHANNELS) - {'sms', 'bale'}
    if invalid_otp_channels:
        errors.append(
            checks.Error(
                f'OTP_DELIVERY_CHANNELS شامل کانال نامعتبر است: {", ".join(sorted(invalid_otp_channels))}',
                id='shop.E006',
            )
        )
    return errors


@checks.register(checks.Tags.security)
def integration_configuration_check(app_configs, **kwargs):
    errors = []

    zarinpal = settings.PAYMENT_PROVIDER_CONFIG["zarinpal"]
    if zarinpal["enabled"]:
        try:
            UUID(zarinpal["merchant_id"])
        except (ValueError, TypeError, AttributeError):
            errors.append(
                checks.Error(
                    "زرین‌پال فعال است اما ZARINPAL_MERCHANT_ID یک UUID معتبر نیست.",
                    id="shop.E100",
                )
            )
        if zarinpal.get("currency") != "IRT":
            errors.append(
                checks.Error("واحد زرین‌پال باید IRT (تومان) باشد.", id="shop.E101")
            )
        if not settings.DEBUG and urlparse(settings.PAYMENT_CALLBACK_BASE_URL).scheme != "https":
            errors.append(
                checks.Error("آدرس callback پرداخت در production باید HTTPS باشد.", id="shop.E102")
            )

    if settings.MEDIA_STORAGE_BACKEND == "s3" and not settings.STORAGES["default"]["OPTIONS"].get("bucket_name"):
        errors.append(checks.Error("ذخیره‌ساز S3 فعال است اما S3_BUCKET_NAME خالی است.", id="shop.E110"))

    if settings.MEILISEARCH_ENABLED:
        parsed = urlparse(settings.MEILISEARCH_URL)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            errors.append(checks.Error("MEILISEARCH_URL معتبر نیست.", id="shop.E120"))
        if not settings.DEBUG and not settings.MEILISEARCH_API_KEY:
            errors.append(
                checks.Error("Meilisearch در production به MEILISEARCH_API_KEY نیاز دارد.", id="shop.E121")
            )

    if settings.WEBPUSH_ENABLED:
        missing = _missing(
            "WEBPUSH_VAPID_PUBLIC_KEY", "WEBPUSH_VAPID_PRIVATE_KEY", "WEBPUSH_VAPID_SUBJECT"
        )
        if missing:
            errors.append(
                checks.Error(
                    f'Web Push فعال است اما این تنظیمات خالی‌اند: {", ".join(missing)}',
                    id="shop.E130",
                )
            )
        if not settings.WEBPUSH_VAPID_SUBJECT.startswith(("mailto:", "https://")):
            errors.append(
                checks.Error("WEBPUSH_VAPID_SUBJECT باید mailto: یا HTTPS باشد.", id="shop.E131")
            )

    if not settings.DEBUG and not settings.OPERATIONS_TOKEN:
        errors.append(
            checks.Warning(
                "OPERATIONS_TOKEN خالی است؛ readiness و metrics فقط با نشست staff در دسترس‌اند.",
                id="shop.W100",
            )
        )
    return errors
