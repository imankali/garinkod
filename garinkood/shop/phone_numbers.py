"""Canonical Iranian mobile-number handling shared by auth and providers."""

import re


_DIGIT_TRANSLATION = str.maketrans(
    '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
    '01234567890123456789',
)


def normalize_iranian_mobile(value: object) -> str:
    """Return an Iranian mobile in the application's canonical ``09…`` form.

    Persian/Arabic digits, spaces, punctuation, ``+98`` and ``0098`` are all
    accepted. Restricting login to mobile prefixes avoids accidentally sending
    an OTP to landlines or malformed international numbers.
    """

    raw = str(value or '').translate(_DIGIT_TRANSLATION).strip()
    digits = re.sub(r'\D', '', raw)
    if digits.startswith('0098'):
        digits = digits[4:]
    elif digits.startswith('98'):
        digits = digits[2:]
    if len(digits) == 10 and digits.startswith('9'):
        digits = f'0{digits}'
    if not re.fullmatch(r'09\d{9}', digits):
        raise ValueError('شماره موبایل ایران را به‌صورت ۰۹xxxxxxxxx وارد کنید.')
    return digits


def iranian_mobile_e164(value: object, *, include_plus: bool = True) -> str:
    """Convert a valid canonical number to the provider-facing E.164 form."""

    local = normalize_iranian_mobile(value)
    prefix = '+' if include_plus else ''
    return f'{prefix}98{local[1:]}'


def mask_phone(value: object) -> str:
    """Keep enough digits for a user to recognise their number without leaking it."""

    try:
        phone = normalize_iranian_mobile(value)
    except ValueError:
        return '***********'
    return f'{phone[:4]}***{phone[-4:]}'
