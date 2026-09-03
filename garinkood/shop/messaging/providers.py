"""Official HTTP adapters for outbound transactional messaging.

Business code talks only to :func:`send_delivery` / :func:`send_otp`. Provider
credentials are read from Django settings (which in turn reads environment
secrets) and never copied into database rows or exception messages.
"""

from __future__ import annotations

import json
import socket
from dataclasses import dataclass
from typing import Any
from urllib import error as urlerror
from urllib import parse, request

from django.conf import settings

from shop.phone_numbers import iranian_mobile_e164, normalize_iranian_mobile


@dataclass(frozen=True)
class ProviderResult:
    message_id: str = ''
    response: dict[str, Any] | None = None


class ProviderError(RuntimeError):
    """A safe-to-persist provider failure without credentials or raw payloads."""

    def __init__(self, message: str, *, retryable: bool = True):
        super().__init__(message[:1000])
        self.retryable = retryable


class ProviderConfigurationError(ProviderError):
    def __init__(self, message: str):
        super().__init__(message, retryable=False)


def _local_phone(value: object) -> str:
    try:
        return normalize_iranian_mobile(value)
    except ValueError as exc:
        raise ProviderConfigurationError('شماره گیرنده پیام معتبر نیست.') from exc


def _e164_phone(value: object, *, include_plus: bool) -> str:
    try:
        return iranian_mobile_e164(value, include_plus=include_plus)
    except ValueError as exc:
        raise ProviderConfigurationError('شماره گیرنده پیام معتبر نیست.') from exc


def _safe_response(data: Any) -> dict[str, Any]:
    """Retain useful delivery metadata while dropping PII and secret-like keys."""

    if not isinstance(data, dict):
        return {}
    blocked = (
        'token', 'secret', 'access', 'api_key', 'apikey',
        'phone', 'mobile', 'receptor', 'wa_id', 'contacts',
    )
    safe: dict[str, Any] = {}
    for key, value in data.items():
        lowered = str(key).lower()
        if any(part in lowered for part in blocked):
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[str(key)] = value if not isinstance(value, str) else value[:500]
        elif isinstance(value, dict):
            safe[str(key)] = _safe_response(value)
        elif isinstance(value, list):
            safe[str(key)] = [
                _safe_response(item) if isinstance(item, dict) else str(item)[:200]
                for item in value[:10]
            ]
    return safe


def _decode_response(raw: bytes) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        decoded = json.loads(raw.decode('utf-8', errors='replace'))
    except (ValueError, UnicodeDecodeError):
        return {'detail': raw.decode('utf-8', errors='replace')[:500]}
    return decoded if isinstance(decoded, dict) else {'result': decoded}


def _http_post(
    url: str,
    *,
    payload: dict[str, Any],
    headers: dict[str, str] | None = None,
    form_encoded: bool = False,
) -> dict[str, Any]:
    timeout = getattr(settings, 'MESSAGING_HTTP_TIMEOUT', 8)
    request_headers = {'Accept': 'application/json', **(headers or {})}
    if form_encoded:
        body = parse.urlencode(payload).encode('utf-8')
        request_headers['Content-Type'] = 'application/x-www-form-urlencoded'
    else:
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        request_headers['Content-Type'] = 'application/json'
    req = request.Request(url, data=body, headers=request_headers, method='POST')
    try:
        with request.urlopen(req, timeout=timeout) as response:
            return _decode_response(response.read())
    except urlerror.HTTPError as exc:
        # Do not include the URL: Kavenegar carries its API key in the path.
        raw = exc.read(2048) if hasattr(exc, 'read') else b''
        detail = _safe_response(_decode_response(raw))
        message = str(detail.get('message') or detail.get('error') or detail.get('detail') or '')
        retryable = exc.code == 429 or exc.code >= 500
        raise ProviderError(
            f'پاسخ ناموفق سرویس پیام‌رسان (HTTP {exc.code}){": " + message if message else ""}',
            retryable=retryable,
        ) from exc
    except (urlerror.URLError, TimeoutError, socket.timeout, OSError) as exc:
        raise ProviderError('ارتباط با سرویس پیام‌رسان برقرار نشد.', retryable=True) from exc


def _require(value: Any, label: str) -> Any:
    if value in (None, '', 0):
        raise ProviderConfigurationError(f'تنظیم محیطی {label} تکمیل نشده است.')
    return value


def _result(data: dict[str, Any], *message_id_paths: tuple[Any, ...]) -> ProviderResult:
    message_id: Any = ''
    for path in message_id_paths:
        cursor: Any = data
        for part in path:
            if isinstance(cursor, dict):
                cursor = cursor.get(part)
            elif isinstance(cursor, list) and isinstance(part, int) and 0 <= part < len(cursor):
                cursor = cursor[part]
            else:
                cursor = None
                break
        if cursor not in (None, ''):
            message_id = cursor
            break
    return ProviderResult(str(message_id or ''), _safe_response(data))


def _send_smsir_otp(phone: str, code: str) -> ProviderResult:
    api_key = _require(settings.SMSIR_API_KEY, 'SMSIR_API_KEY')
    template_id = _require(settings.SMSIR_OTP_TEMPLATE_ID, 'SMSIR_OTP_TEMPLATE_ID')
    data = _http_post(
        'https://api.sms.ir/v1/send/verify',
        headers={'X-API-KEY': str(api_key)},
        payload={
            'mobile': _local_phone(phone),
            'templateId': int(template_id),
            'parameters': [
                {'name': settings.SMSIR_OTP_PARAMETER, 'value': code},
            ],
        },
    )
    if data.get('status') is not None and int(data.get('status') or 0) != 1:
        raise ProviderError(str(data.get('message') or 'ارسال OTP توسط SMS.ir ناموفق بود.'), retryable=False)
    return _result(data, ('data', 'messageId'), ('messageId',))


def _send_smsir_text(phone: str, text: str) -> ProviderResult:
    api_key = _require(settings.SMSIR_API_KEY, 'SMSIR_API_KEY')
    line_number = _require(settings.SMSIR_LINE_NUMBER, 'SMSIR_LINE_NUMBER')
    data = _http_post(
        'https://api.sms.ir/v1/send/bulk',
        headers={'X-API-KEY': str(api_key)},
        payload={
            'lineNumber': int(line_number),
            'messageText': text,
            'mobiles': [_local_phone(phone)],
            'sendDateTime': None,
        },
    )
    if data.get('status') is not None and int(data.get('status') or 0) != 1:
        raise ProviderError(str(data.get('message') or 'ارسال پیامک توسط SMS.ir ناموفق بود.'), retryable=False)
    return _result(data, ('data', 0, 'messageId'), ('messageId',))


def _kavenegar_url(scope_method: str) -> str:
    api_key = _require(settings.KAVENEGAR_API_KEY, 'KAVENEGAR_API_KEY')
    return f'https://api.kavenegar.com/v1/{parse.quote(str(api_key), safe="")}/{scope_method}.json'


def _validate_kavenegar(data: dict[str, Any]) -> None:
    result = data.get('return') or {}
    status_code = int(result.get('status') or 0)
    if status_code != 200:
        raise ProviderError(
            str(result.get('message') or 'ارسال پیامک توسط کاوه‌نگار ناموفق بود.'),
            retryable=status_code in {408, 409, 429, 500, 503},
        )


def _send_kavenegar_otp(phone: str, code: str) -> ProviderResult:
    template = _require(settings.KAVENEGAR_OTP_TEMPLATE, 'KAVENEGAR_OTP_TEMPLATE')
    data = _http_post(
        _kavenegar_url('verify/lookup'),
        form_encoded=True,
        payload={
            'receptor': _local_phone(phone),
            'token': code,
            'template': template,
        },
    )
    _validate_kavenegar(data)
    entries = data.get('entries') or []
    message_id = entries[0].get('messageid') if entries and isinstance(entries[0], dict) else ''
    return ProviderResult(str(message_id or ''), _safe_response(data))


def _send_kavenegar_text(phone: str, text: str) -> ProviderResult:
    payload: dict[str, Any] = {
        'receptor': _local_phone(phone),
        'message': text,
    }
    if settings.KAVENEGAR_SENDER:
        payload['sender'] = settings.KAVENEGAR_SENDER
    data = _http_post(_kavenegar_url('sms/send'), form_encoded=True, payload=payload)
    _validate_kavenegar(data)
    entries = data.get('entries') or []
    message_id = entries[0].get('messageid') if entries and isinstance(entries[0], dict) else ''
    return ProviderResult(str(message_id or ''), _safe_response(data))


def _send_bale_safir(phone: str, *, text: str = '', code: str = '', request_id: str = '') -> ProviderResult:
    api_key = _require(settings.BALE_SAFIR_API_KEY, 'BALE_SAFIR_API_KEY')
    bot_id = _require(settings.BALE_SAFIR_BOT_ID, 'BALE_SAFIR_BOT_ID')
    message_data = {'otp_message': {'otp': code}} if code else {'message': {'text': text}}
    data = _http_post(
        'https://safir.bale.ai/api/v3/send_message',
        headers={'api-access-key': str(api_key)},
        payload={
            'request_id': request_id,
            'bot_id': int(bot_id),
            'phone_number': _e164_phone(phone, include_plus=False),
            'message_data': message_data,
        },
    )
    errors = data.get('error_data') or []
    if errors:
        first = errors[0] if isinstance(errors[0], dict) else {}
        code_value = int(first.get('code') or 0)
        raise ProviderError(
            str(first.get('description') or 'ارسال پیام در بله ناموفق بود.'),
            retryable=code_value in {2, 3},
        )
    return _result(data, ('message_id',))


def _send_bale_bot(chat_id: str, text: str) -> ProviderResult:
    token = _require(settings.BALE_BOT_TOKEN, 'BALE_BOT_TOKEN')
    data = _http_post(
        f'https://tapi.bale.ai/bot{parse.quote(str(token), safe=":")}/sendMessage',
        payload={'chat_id': chat_id, 'text': text},
    )
    if data.get('ok') is False:
        raise ProviderError(str(data.get('description') or 'ارسال پیام بله ناموفق بود.'), retryable=False)
    return _result(data, ('result', 'message_id'), ('message_id',))


def _send_telegram(chat_id: str, text: str) -> ProviderResult:
    token = _require(settings.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN')
    data = _http_post(
        f'https://api.telegram.org/bot{parse.quote(str(token), safe=":")}/sendMessage',
        payload={
            'chat_id': chat_id,
            'text': text,
            'disable_web_page_preview': True,
        },
    )
    if data.get('ok') is not True:
        raise ProviderError(str(data.get('description') or 'ارسال پیام تلگرام ناموفق بود.'), retryable=False)
    return _result(data, ('result', 'message_id'))


def _send_whatsapp(phone: str, text: str, options: dict[str, Any]) -> ProviderResult:
    access_token = _require(settings.WHATSAPP_ACCESS_TOKEN, 'WHATSAPP_ACCESS_TOKEN')
    phone_number_id = _require(settings.WHATSAPP_PHONE_NUMBER_ID, 'WHATSAPP_PHONE_NUMBER_ID')
    recipient = _e164_phone(phone, include_plus=False)
    template_name = str(options.get('template_name') or '')
    if template_name:
        parameters = [
            {'type': 'text', 'text': str(value)}
            for value in options.get('template_parameters', [])
        ]
        template_payload: dict[str, Any] = {
            'name': template_name,
            'language': {'code': str(options.get('language_code') or 'fa')},
        }
        if parameters:
            template_payload['components'] = [{'type': 'body', 'parameters': parameters}]
        payload: dict[str, Any] = {
            'messaging_product': 'whatsapp',
            'to': recipient,
            'type': 'template',
            'template': template_payload,
        }
    elif settings.WHATSAPP_ALLOW_FREEFORM:
        payload = {
            'messaging_product': 'whatsapp',
            'to': recipient,
            'type': 'text',
            'text': {'preview_url': False, 'body': text},
        }
    else:
        raise ProviderConfigurationError(
            'برای واتساپ نام قالب تأییدشده لازم است؛ ارسال آزاد فقط در پنجره ۲۴ ساعته مجاز است.'
        )
    data = _http_post(
        f'https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{phone_number_id}/messages',
        headers={'Authorization': f'Bearer {access_token}'},
        payload=payload,
    )
    messages = data.get('messages') or []
    message_id = messages[0].get('id') if messages and isinstance(messages[0], dict) else ''
    if not message_id:
        raise ProviderError('واتساپ شناسه پیام برنگرداند.', retryable=True)
    return ProviderResult(str(message_id), _safe_response(data))


def _fake_result(prefix: str) -> ProviderResult:
    return ProviderResult(f'fake-{prefix}', {'provider': 'fake', 'accepted': True})


def send_otp(channel: str, phone: str, code: str, request_id: str) -> ProviderResult:
    """Send an interactive OTP immediately; callers implement channel fallback."""

    if settings.MESSAGING_FAKE:
        return _fake_result(f'otp-{channel}-{request_id}')
    if channel == 'bale':
        if not settings.MESSAGING_ENABLE_BALE:
            raise ProviderConfigurationError('کانال بله غیرفعال است.')
        return _send_bale_safir(phone, code=code, request_id=request_id)
    if channel != 'sms':
        raise ProviderConfigurationError('کانال OTP پشتیبانی نمی‌شود.')
    if not settings.MESSAGING_ENABLE_SMS:
        raise ProviderConfigurationError('کانال پیامک غیرفعال است.')
    if settings.SMS_PROVIDER == 'smsir':
        return _send_smsir_otp(phone, code)
    if settings.SMS_PROVIDER == 'kavenegar':
        return _send_kavenegar_otp(phone, code)
    raise ProviderConfigurationError('SMS_PROVIDER باید smsir یا kavenegar باشد.')


def send_delivery(delivery: Any) -> ProviderResult:
    """Dispatch one outbox row through its official channel adapter."""

    if settings.MESSAGING_FAKE:
        return _fake_result(f'{delivery.channel}-{delivery.id}')
    text = delivery.rendered_content
    options = delivery.payload.get('provider_options', {}) if isinstance(delivery.payload, dict) else {}
    if delivery.channel == 'telegram':
        if not settings.MESSAGING_ENABLE_TELEGRAM:
            raise ProviderConfigurationError('کانال تلگرام غیرفعال است.')
        return _send_telegram(delivery.recipient, text)
    if delivery.channel == 'bale':
        if not settings.MESSAGING_ENABLE_BALE:
            raise ProviderConfigurationError('کانال بله غیرفعال است.')
        if delivery.recipient.startswith('phone:'):
            return _send_bale_safir(
                delivery.recipient.removeprefix('phone:'),
                text=text,
                request_id=str(delivery.id),
            )
        return _send_bale_bot(delivery.recipient.removeprefix('chat:'), text)
    if delivery.channel == 'sms':
        if not settings.MESSAGING_ENABLE_SMS:
            raise ProviderConfigurationError('کانال پیامک غیرفعال است.')
        if settings.SMS_PROVIDER == 'smsir':
            return _send_smsir_text(delivery.recipient, text)
        if settings.SMS_PROVIDER == 'kavenegar':
            return _send_kavenegar_text(delivery.recipient, text)
        raise ProviderConfigurationError('SMS_PROVIDER باید smsir یا kavenegar باشد.')
    if delivery.channel == 'whatsapp':
        if not settings.MESSAGING_ENABLE_WHATSAPP:
            raise ProviderConfigurationError('کانال واتساپ غیرفعال است.')
        return _send_whatsapp(delivery.recipient, text, options)
    raise ProviderConfigurationError('کانال پیام‌رسان پشتیبانی نمی‌شود.')
