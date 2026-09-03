"""Security-hardened mobile OTP issuance and account resolution."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from shop.models import OneTimePassword, UserAccount
from shop.phone_numbers import mask_phone, normalize_iranian_mobile

from .providers import ProviderError, send_otp

User = get_user_model()


class OtpError(Exception):
    pass


class OtpCooldown(OtpError):
    def __init__(self, wait: int):
        super().__init__('برای ارسال دوباره کد کمی صبر کنید.')
        self.wait = max(int(wait), 1)


class OtpRequestLimit(OtpError):
    pass


class OtpDeliveryUnavailable(OtpError):
    pass


class OtpVerificationError(OtpError):
    pass


class OtpAccountError(OtpError):
    pass


@dataclass(frozen=True)
class OtpIssueResult:
    challenge: OneTimePassword
    resend_after: int
    raw_code_for_debug: str = ''


def _cache_key(namespace: str, phone: str) -> str:
    digest = salted_hmac(f'otp:{namespace}', phone).hexdigest()
    return f'otp:{namespace}:{digest}'


def _claim_request_budget(phone: str) -> None:
    cooldown = int(settings.OTP_RESEND_COOLDOWN_SECONDS)
    cooldown_key = _cache_key('cooldown', phone)
    if not cache.add(cooldown_key, '1', timeout=cooldown):
        ttl = getattr(cache, 'ttl', lambda _key: None)(cooldown_key)
        raise OtpCooldown(ttl or cooldown)

    window = int(settings.OTP_PHONE_RATE_WINDOW_SECONDS)
    limit = int(settings.OTP_PHONE_RATE_LIMIT)
    count_key = _cache_key('phone-window', phone)
    if cache.add(count_key, 1, timeout=window):
        count = 1
    else:
        try:
            count = cache.incr(count_key)
        except ValueError:
            # A concurrent cache expiry is harmless; claim a fresh window.
            cache.set(count_key, 1, timeout=window)
            count = 1
    if count > limit:
        raise OtpRequestLimit('تعداد درخواست کد برای این شماره بیش از حد مجاز است.')


def _generate_code() -> str:
    length = int(settings.OTP_CODE_LENGTH)
    if not 4 <= length <= 8:
        raise ImproperlyConfigured('OTP_CODE_LENGTH must be between 4 and 8.')
    return ''.join(str(secrets.randbelow(10)) for _ in range(length))


def issue_login_otp(phone_value: object, *, requested_ip: str | None = None, requested_channel: str = 'auto') -> OtpIssueResult:
    """Create, hash and synchronously deliver a login OTP with fallback."""

    phone = normalize_iranian_mobile(phone_value)
    _claim_request_budget(phone)
    raw_code = _generate_code()
    now = timezone.now()
    channels = [str(channel).strip() for channel in settings.OTP_DELIVERY_CHANNELS if str(channel).strip()]
    if requested_channel != 'auto':
        if requested_channel not in {'sms', 'bale'}:
            raise ValueError('کانال ارسال کد معتبر نیست.')
        channels = [requested_channel]
    if not channels:
        raise OtpDeliveryUnavailable('هیچ کانال OTP فعالی پیکربندی نشده است.')

    with transaction.atomic():
        OneTimePassword.objects.filter(
            phone=phone,
            purpose=OneTimePassword.PURPOSE_LOGIN,
            status=OneTimePassword.STATUS_PENDING,
        ).update(status=OneTimePassword.STATUS_EXPIRED, code_hash='!')
        challenge = OneTimePassword.objects.create(
            phone=phone,
            purpose=OneTimePassword.PURPOSE_LOGIN,
            code_hash=make_password(raw_code),
            max_attempts=settings.OTP_MAX_VERIFY_ATTEMPTS,
            requested_ip=requested_ip,
            expires_at=now + timedelta(seconds=settings.OTP_TTL_SECONDS),
        )

    failures: list[ProviderError] = []
    for channel in channels:
        try:
            result = send_otp(channel, phone, raw_code, str(challenge.request_id))
        except ProviderError as exc:
            failures.append(exc)
            continue
        challenge.delivery_channel = channel
        challenge.provider_message_id = result.message_id[:200]
        challenge.save(update_fields=['delivery_channel', 'provider_message_id'])
        debug_code = raw_code if settings.DEBUG and settings.OTP_RETURN_DEBUG_CODE else ''
        return OtpIssueResult(challenge, int(settings.OTP_RESEND_COOLDOWN_SECONDS), debug_code)

    challenge.status = OneTimePassword.STATUS_FAILED
    challenge.code_hash = '!'
    challenge.last_error = ' | '.join(str(error) for error in failures)[:2000]
    challenge.save(update_fields=['status', 'code_hash', 'last_error'])
    # The provider details are intentionally not exposed to the endpoint;
    # operators can diagnose the sanitised reason from admin/system checks.
    raise OtpDeliveryUnavailable('ارسال کد تأیید در حال حاضر ممکن نیست.') from (failures[-1] if failures else None)


def _create_mobile_user(phone: str, first_name: str = '', last_name: str = ''):
    # Do not duplicate the raw mobile number into a public-facing username.
    digest = salted_hmac('otp-mobile-user', phone).hexdigest()[:16]
    base = f'mobile_{digest}'
    username = base
    while User.objects.filter(username=username).exists():
        username = f'{base}_{secrets.token_hex(2)}'
    user = User(username=username, first_name=first_name[:150], last_name=last_name[:150])
    user.set_unusable_password()
    user.save()
    account = user.account
    account.phone = phone
    account.phone_verified_at = timezone.now()
    account.save(update_fields=['phone', 'phone_verified_at', 'updated'])
    return user, account


def verify_login_otp(
    *,
    request_id: object,
    phone_value: object,
    code: object,
    first_name: str = '',
    last_name: str = '',
) -> tuple[object, UserAccount, bool]:
    """Consume a challenge exactly once and return its existing/new account."""

    phone = normalize_iranian_mobile(phone_value)
    submitted_code = str(code or '').translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'))
    generic_error = 'کد تأیید معتبر نیست یا منقضی شده است.'
    if not submitted_code.isdigit() or len(submitted_code) != int(settings.OTP_CODE_LENGTH):
        raise OtpVerificationError(generic_error)

    failure: OtpError | None = None
    authenticated: tuple[object, UserAccount, bool] | None = None
    with transaction.atomic():
        challenge = (
            OneTimePassword.objects.select_for_update()
            .filter(
                request_id=request_id,
                phone=phone,
                purpose=OneTimePassword.PURPOSE_LOGIN,
            )
            .first()
        )
        if not challenge or challenge.status != OneTimePassword.STATUS_PENDING:
            failure = OtpVerificationError(generic_error)
        else:
            now = timezone.now()
            if challenge.expires_at <= now:
                challenge.status = OneTimePassword.STATUS_EXPIRED
                challenge.code_hash = '!'
                challenge.save(update_fields=['status', 'code_hash'])
                failure = OtpVerificationError(generic_error)
            elif challenge.attempts >= challenge.max_attempts:
                challenge.status = OneTimePassword.STATUS_FAILED
                challenge.code_hash = '!'
                challenge.save(update_fields=['status', 'code_hash'])
                failure = OtpVerificationError(generic_error)
            elif not check_password(submitted_code, challenge.code_hash):
                challenge.attempts += 1
                if challenge.attempts >= challenge.max_attempts:
                    challenge.status = OneTimePassword.STATUS_FAILED
                    challenge.code_hash = '!'
                challenge.save(update_fields=['attempts', 'status', 'code_hash'])
                failure = OtpVerificationError(generic_error)
            else:
                accounts = list(
                    UserAccount.objects.select_for_update().select_related('user').filter(phone=phone)[:2]
                )
                if len(accounts) > 1:
                    challenge.status = OneTimePassword.STATUS_FAILED
                    challenge.code_hash = '!'
                    challenge.save(update_fields=['status', 'code_hash'])
                    failure = OtpAccountError(
                        'برای این شماره بیش از یک حساب ثبت شده است؛ با پشتیبانی تماس بگیرید.'
                    )
                elif accounts and not accounts[0].user.is_active:
                    challenge.status = OneTimePassword.STATUS_FAILED
                    challenge.code_hash = '!'
                    challenge.save(update_fields=['status', 'code_hash'])
                    failure = OtpAccountError('این حساب غیرفعال است؛ با پشتیبانی تماس بگیرید.')
                else:
                    created = not accounts
                    if accounts:
                        account = accounts[0]
                        user = account.user
                        account.phone_verified_at = now
                        account.save(update_fields=['phone_verified_at', 'updated'])
                    else:
                        try:
                            # A savepoint lets a rare cross-worker race fall
                            # back to the account that won the unique phone.
                            with transaction.atomic():
                                user, account = _create_mobile_user(phone, first_name, last_name)
                        except IntegrityError:
                            account = (
                                UserAccount.objects.select_for_update()
                                .select_related('user')
                                .get(phone=phone)
                            )
                            user = account.user
                            created = False
                            account.phone_verified_at = now
                            account.save(update_fields=['phone_verified_at', 'updated'])
                    challenge.status = OneTimePassword.STATUS_VERIFIED
                    challenge.code_hash = '!'
                    challenge.consumed_at = now
                    challenge.save(update_fields=['status', 'code_hash', 'consumed_at'])
                    authenticated = (user, account, created)

    if failure:
        raise failure
    if authenticated is None:  # Defensive: all branches above set one outcome.
        raise OtpVerificationError(generic_error)
    return authenticated


def otp_public_payload(result: OtpIssueResult) -> dict[str, object]:
    payload: dict[str, object] = {
        'request_id': str(result.challenge.request_id),
        'masked_phone': mask_phone(result.challenge.phone),
        'channel': result.challenge.delivery_channel,
        'expires_in': int(settings.OTP_TTL_SECONDS),
        'resend_after': result.resend_after,
        'message': 'کد تأیید ارسال شد.',
    }
    if result.raw_code_for_debug:
        payload['debug_code'] = result.raw_code_for_debug
    return payload
