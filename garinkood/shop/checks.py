"""Deployment checks for explicitly enabled messaging providers."""

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
