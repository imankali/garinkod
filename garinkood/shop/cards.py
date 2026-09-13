"""Bank card number rules for seller payouts.

The card is collected at storefront registration (next to the rules checkbox)
and is where withdrawal requests are paid. Only the normalised 16 digits are
stored; every display goes through :func:`mask_card_number`, the same way
national codes are masked, so a money screen never prints a full card.
"""

_FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
_AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'


def normalize_card_number(value: str) -> str:
    """Keep only digits, translating Persian/Arabic ones to ASCII."""
    out = []
    for char in (value or '').strip():
        if char.isdigit():
            out.append(char if char.isascii() else str(int(char)))
        elif char in _FA_DIGITS:
            out.append(str(_FA_DIGITS.index(char)))
        elif char in _AR_DIGITS:
            out.append(str(_AR_DIGITS.index(char)))
    return ''.join(out)


def card_number_error(value: str) -> str:
    """A human-readable problem, or '' when the value is a valid 16-digit card."""
    cleaned = normalize_card_number(value)
    if not cleaned:
        return ''
    if len(cleaned) != 16:
        return 'شماره کارت باید ۱۶ رقم باشد.'
    return ''


def mask_card_number(value: str) -> str:
    cleaned = normalize_card_number(value)
    if len(cleaned) != 16:
        return ''
    return f'****-****-****-{cleaned[-4:]}'
