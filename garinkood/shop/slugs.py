"""Slug helpers that work with Persian text.

Django's :func:`django.utils.text.slugify` with ``allow_unicode=True`` keeps
Persian letters, which is what we want for readable storefront addresses. On
top of that we:

* normalise the Arabic forms of ی/ک and strip zero-width joiners, so "گل‌خانه"
  and "گلخانه" cannot become two visually identical addresses;
* guarantee uniqueness with a numeric suffix, retrying on the database's own
  unique constraint rather than trusting a prior existence check (two
  simultaneous submissions would otherwise race).
"""

import re

from django.utils.text import slugify

# Characters that must be folded before slugifying so lookalikes collapse.
_TRANSLATIONS = str.maketrans({
    'ي': 'ی',
    'ك': 'ک',
    'ۀ': 'ه',
    'ة': 'ه',
    'أ': 'ا',
    'إ': 'ا',
    'آ': 'ا',
    '\u200c': '-',  # zero-width non-joiner
    '\u200f': '',   # right-to-left mark
    '\u200e': '',   # left-to-right mark
    '_': '-',
})


def slugify_fa(value: str) -> str:
    """Return a URL-safe, Unicode slug for Persian or Latin input."""
    if not value:
        return ''
    folded = str(value).strip().translate(_TRANSLATIONS)
    folded = re.sub(r'\s+', '-', folded)
    slug = slugify(folded, allow_unicode=True)
    return slug.strip('-')[:180]


def _next_candidate(base: str, attempt: int) -> str:
    if attempt == 0:
        return base
    suffix = f'-{attempt + 1}'
    return f'{base[:180 - len(suffix)]}{suffix}'


def unique_slug(model, value: str, *, field: str = 'slug', fallback: str = 'item', exclude_pk=None) -> str:
    """Build a slug for ``model`` that is not already taken.

    This is a best-effort pre-check; callers that write concurrently should
    still rely on the unique constraint and retry, which
    :func:`save_with_unique_slug` does.
    """
    base = slugify_fa(value) or fallback
    attempt = 0
    while True:
        candidate = _next_candidate(base, attempt)
        queryset = model.objects.filter(**{field: candidate})
        if exclude_pk is not None:
            queryset = queryset.exclude(pk=exclude_pk)
        if not queryset.exists():
            return candidate
        attempt += 1


def unique_storefront_slug(name: str) -> str:
    from .models import Storefront

    return unique_slug(Storefront, name, fallback='ghorfe')


def unique_listing_slug(title: str) -> str:
    from .models import MarketplaceListing

    return unique_slug(MarketplaceListing, title, fallback='agahi')


def save_with_unique_slug(instance, source_value: str, *, field: str = 'slug', fallback: str = 'item', max_attempts: int = 6):
    """Save ``instance``, resolving slug collisions caused by a race.

    Between building a candidate and committing it another request may claim
    the same slug. Rather than pre-locking the table we let the unique index do
    its job and retry with the next suffix.
    """
    from django.db import IntegrityError, transaction

    model = type(instance)
    base = slugify_fa(source_value) or fallback
    for attempt in range(max_attempts):
        candidate = unique_slug(
            model, base, field=field, fallback=fallback, exclude_pk=instance.pk
        ) if attempt == 0 else _next_candidate(base, attempt)
        setattr(instance, field, candidate)
        try:
            with transaction.atomic():
                instance.save()
            return instance
        except IntegrityError:
            if attempt == max_attempts - 1:
                raise
    return instance
