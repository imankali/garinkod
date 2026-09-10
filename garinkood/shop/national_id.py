"""Iranian national code (کد ملی) validation, shared by every form that records one.

The storefront registry asks a seller for their national code so a marketplace
dispute can be traced to a real person; a field that accepts any ten digits is
worse than no field at all, because it lets a seller believe the platform holds
a usable record. So the checksum is verified here, in one place, and every
message a user sees comes from this module.

The algorithm is the published weighted-modulo check: the ten digits, weighted
``10..2``, must leave a remainder below two when divided by eleven — and a code
whose six leading digits are identical (0000001234 style) is structurally
impossible and rejected separately, since the checksum alone lets it through.
"""

from __future__ import annotations

import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

DIGITS_ONLY = re.compile(r'^\d{10}$')

WEIGHTS = (11, 10, 9, 8, 7, 6, 5, 4, 3, 2)

ERROR_BLANK = _('کد ملی الزامی است.')
ERROR_FORMAT = _('کد ملی باید دقیقاً ۱۰ رقم باشد و فقط رقم فارسی یا انگلیسی بپذیرد.')
ERROR_REPEATED = _('این کد ملی معتبر نیست (ارقام تکراری).')
ERROR_CHECKSUM = _('کد ملی صحیح نیست؛ رقم آخر را بررسی کنید.')

_PERSIAN_DIGITS = str.maketrans('۰۱۲۳۴۵۶۷۸۹', '0123456789')
_ARABIC_DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')


def normalise(value: str) -> str:
    """Digits only, with Persian/Arabic numerals folded onto ASCII ones.

    People paste a national code from a document that uses Persian digits; the
    form that rejects them for that reason is a form that quietly loses sellers.
    """
    text = str(value or '').strip().translate(_PERSIAN_DIGITS).translate(_ARABIC_DIGITS)
    return re.sub(r'[\s\-]', '', text)


def is_valid_national_id(value: str) -> bool:
    """True when ``value`` is a checksum-valid ten-digit national code."""
    code = normalise(value)
    if not DIGITS_ONLY.match(code):
        return False
    if len(set(code)) == 1:
        return False
    # 1111111111 is caught above, but '0000001234' style padding is the other
    # shape that passes the checksum while being unissued.
    if code[:6] == code[0] * 6:
        return False
    digits = [int(char) for char in code]
    control = digits[9]
    total = sum(digit * weight for digit, weight in zip(digits[:9], WEIGHTS[1:]))
    remainder = total % 11
    if remainder < 2:
        return control == remainder
    return control == 11 - remainder


def validate_national_id(value: str) -> str:
    """Django-field validator: returns the normalised code or raises."""
    code = normalise(value)
    if not code:
        raise ValidationError(ERROR_BLANK)
    if not DIGITS_ONLY.match(code):
        raise ValidationError(ERROR_FORMAT)
    if len(set(code)) == 1 or code[:6] == code[0] * 6:
        raise ValidationError(ERROR_REPEATED)
    if not is_valid_national_id(code):
        raise ValidationError(ERROR_CHECKSUM)
    return code


def mask_national_id(value: str) -> str:
    """A display-safe form for staff screens that list accounts.

    ``0079584381`` → ``007****381``. The full code stays on the account itself;
    a directory that prints every seller's national code turns an admin list
    into a data leak.
    """
    code = normalise(value)
    if len(code) != 10:
        return ''
    return f'{code[:3]}*****{code[9]}'
