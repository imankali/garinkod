"""A single, predictable error envelope for the whole API.

Every failure — validation, auth, permission, throttling, 404, conflict —
returns the same shape so the frontend has exactly one thing to parse:

    {
      "error":  "پیام قابل نمایش به کاربر",
      "code":   "validation_error",
      "status": 400,
      "fields": {"phone": ["شماره تماس معتبر نیست."]}   # only for 400
    }

``fields`` is present only when the failure is field-level, which is what lets
forms show a message next to the offending input instead of a generic toast.
"""

from django.http import Http404
from rest_framework import status as http_status
from rest_framework.exceptions import (
    APIException, NotAuthenticated, PermissionDenied, Throttled, ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

# Human, Persian defaults for each status the API can return.
STATUS_MESSAGES = {
    400: 'اطلاعات ارسال‌شده معتبر نیست. لطفاً موارد مشخص‌شده را اصلاح کنید.',
    401: 'برای انجام این کار باید وارد حساب کاربری خود شوید.',
    403: 'شما اجازه دسترسی به این بخش را ندارید.',
    404: 'موردی که دنبال آن بودید پیدا نشد.',
    405: 'این عملیات روی این آدرس پشتیبانی نمی‌شود.',
    409: 'به دلیل تغییر وضعیت، این درخواست قابل انجام نیست.',
    413: 'حجم فایل ارسالی بیش از حد مجاز است.',
    429: 'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.',
    500: 'خطای غیرمنتظره‌ای رخ داد. تیم فنی در جریان قرار گرفت.',
    503: 'سرویس پیام‌رسان موقتاً در دسترس نیست؛ کمی بعد تلاش کنید.',
}

STATUS_CODES = {
    400: 'validation_error',
    401: 'authentication_required',
    403: 'permission_denied',
    404: 'not_found',
    405: 'method_not_allowed',
    409: 'conflict',
    413: 'payload_too_large',
    429: 'throttled',
    500: 'server_error',
    503: 'service_unavailable',
}

# Keys DRF uses for whole-request (not field-specific) errors.
NON_FIELD_KEYS = {'non_field_errors', 'detail', 'error'}


def _flatten(value) -> str:
    """Reduce DRF's nested error structures to one readable sentence."""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return _flatten(value[0]) if value else ''
    if isinstance(value, dict):
        for item in value.values():
            flattened = _flatten(item)
            if flattened:
                return flattened
    return str(value)


def _normalise_fields(detail) -> dict:
    """Turn a validation detail into ``{field: [messages]}``."""
    if not isinstance(detail, dict):
        return {}
    fields = {}
    for key, value in detail.items():
        if key in NON_FIELD_KEYS:
            continue
        if isinstance(value, list):
            fields[key] = [_flatten(entry) for entry in value]
        else:
            fields[key] = [_flatten(value)]
    return fields


def api_exception_handler(exc, context):
    """Wrap DRF's handler so every error shares one envelope."""
    if isinstance(exc, Http404):
        exc = APIException(STATUS_MESSAGES[404])
        exc.status_code = http_status.HTTP_404_NOT_FOUND

    response = drf_exception_handler(exc, context)
    if response is None:
        # Unhandled exception: let Django's own 500 handling (and any error
        # reporter attached to it) run instead of masking the traceback.
        return None

    status_code = response.status_code
    payload = {
        'code': STATUS_CODES.get(status_code, 'error'),
        'status': status_code,
    }

    detail = response.data
    if isinstance(exc, ValidationError):
        fields = _normalise_fields(detail)
        if fields:
            payload['fields'] = fields
        non_field = ''
        if isinstance(detail, dict):
            for key in NON_FIELD_KEYS:
                if key in detail:
                    non_field = _flatten(detail[key])
                    break
        else:
            non_field = _flatten(detail)
        payload['error'] = non_field or STATUS_MESSAGES[400]
    elif isinstance(exc, Throttled):
        wait = int(exc.wait or 0)
        payload['error'] = (
            f'{STATUS_MESSAGES[429]} (حدود {wait} ثانیه دیگر دوباره تلاش کنید.)'
            if wait else STATUS_MESSAGES[429]
        )
        payload['retry_after'] = wait
        response['Retry-After'] = str(wait)
    elif isinstance(exc, (NotAuthenticated, PermissionDenied)):
        message = _flatten(detail)
        default = STATUS_MESSAGES.get(status_code, STATUS_MESSAGES[403])
        # DRF's English defaults are replaced; a custom Persian message is kept.
        payload['error'] = default if message.isascii() else message
    else:
        message = _flatten(detail)
        payload['error'] = message or STATUS_MESSAGES.get(status_code, STATUS_MESSAGES[500])

    response.data = payload
    return response
