"""Persian numerals and calendar words, so the backend can write a sentence.

Anything a farmer reads verbatim — a desk's working hours, «بازگشایی سه‌شنبه
۰۹:۰۰» under a closed-thread notice — is composed on the server, and Latin
digits or an English weekday inside a Persian line looks broken even when the
meaning is right. The frontend localises its own numbers; this module is for the
strings that are already text before they leave the view.
"""

from __future__ import annotations

DIGITS = str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹')

# Indexed the way ``DeskSettings.work_days`` indexes the week: Saturday first.
WEEKDAY_NAMES = ('شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه')


def fa_digits(value) -> str:
    """``9`` → ``۹``, ``'06:00'`` → ``'۰۶:۰۰'``; anything else is stringified."""
    return str(value).translate(DIGITS)


def time_label(moment) -> str:
    """A clock time as the farmer reads it, e.g. ``۰۹:۳۰``."""
    return fa_digits(moment.strftime('%H:%M'))


def weekday_label(index: int) -> str:
    """Weekday name for the platform's Saturday-first index."""
    try:
        return WEEKDAY_NAMES[int(index) % 7]
    except (TypeError, ValueError):
        return ''


def platform_day_index(moment) -> int:
    """Python's Monday=0 weekday as the platform's Saturday=0 index.

    This is the one definition of the week's start; ``DeskSettings`` and the
    labels below both read it, so a work-day set can never be interpreted with a
    different offset than the day names it is printed with.
    """
    return (moment.weekday() + 2) % 7


def datetime_label(moment) -> str:
    """``سه‌شنبه ۰۹:۰۰`` from an aware datetime in the project timezone."""
    return f'{weekday_label(platform_day_index(moment))} {time_label(moment)}'
