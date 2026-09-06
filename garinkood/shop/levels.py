"""The access ladder: every rank the platform grants, and what each one unlocks.

Two questions get answered apart here, and keeping them apart is the whole
point of the module:

* **How far has this account come?** — the ladder below. It is ordered, so
  ``level >= X`` stays a meaningful comparison everywhere in the codebase.
* **Which desk does this person staff?** — Django groups and the
  :class:`~shop.models.DeskAgent` roster. Duty is not rank: a consulting
  agronomist is not "more trusted" than a support operator.

Why the old five steps became eight
----------------------------------
The old ladder jumped from «غرفه‌دار» straight to «ناظر محتوا», so hiring one
person to answer the support desk meant handing them content moderation too.
And a buyer whose phone number was verified looked exactly like a brand new
registration, even though the platform already trusts that account more.
Both gaps are now real steps (۲ و ۴ و ۵), each with a difference you can point
at, not a decoration:

* ۲ — the verified badge that travels with their messages;
* ۴ — the storefront appears in «غرفه‌های منتخب» and carries the verified mark;
* ۵ — the service queue is theirs to work, with no moderation power attached.

This module is the single source of truth: labels, floors, the capability
matrix and the "staff do not queue in front of farmers" rule all read from
here, so a gate and the UI that explains it cannot disagree. Nothing here
imports Django models — the functions accept whatever object carries the
attributes they need, which is what keeps ``models.py`` importable from here
without a cycle.
"""

from __future__ import annotations

from dataclasses import dataclass

# --- The ladder -------------------------------------------------------------

LEVEL_GUEST = 0            # not signed in at all; never stored on an account
LEVEL_BUYER = 1
LEVEL_VERIFIED_BUYER = 2
LEVEL_SELLER = 3
LEVEL_VERIFIED_SELLER = 4
LEVEL_DESK_AGENT = 5
LEVEL_MODERATOR = 6
LEVEL_ADMIN = 7
LEVEL_OWNER = 8

MINIMUM_LEVEL = LEVEL_BUYER
MAXIMUM_LEVEL = LEVEL_OWNER


@dataclass(frozen=True)
class Rank:
    """One step of the ladder, described the same way for humans and for the API."""

    value: int
    key: str
    label: str
    promise: str
    how: str

    @property
    def short(self) -> str:
        """The label without the «سطح ۴ — » prefix, for chips and badges."""
        return self.label.split('—', 1)[1].strip() if '—' in self.label else self.label


# The order of this tuple *is* the order of the ladder. `LEVEL_CHOICES` for the
# model and every human-facing list (admin dropdowns, the management console,
# the profile card) are derived from it, so a new step only needs to be added
# here once.
LADDER: tuple[Rank, ...] = (
    Rank(
        LEVEL_BUYER,
        'buyer',
        'سطح ۱ — خریدار',
        'ثبت سفارش، پرداخت، دیدگاه و امتیاز، گفتگو با غرفه‌دار و میز پشتیبانی.',
        'با ساختن حساب.',
    ),
    Rank(
        LEVEL_VERIFIED_BUYER,
        'verified_buyer',
        'سطح ۲ — خریدار تأییدشده',
        'نشان «تأییدشده» کنار نامش در گفتگو و دیدگاه‌ها؛ طرف مقابل می‌فهمد با یک حساب زودگذر حرف نمی‌زند.',
        'با تأیید شماره تلفن (کد یک‌بارمصرف).',
    ),
    Rank(
        LEVEL_SELLER,
        'seller',
        'سطح ۳ — غرفه‌دار',
        'غرفه، آگهی‌ها، استودیو غرفه، پیام‌های خریداران و پرونده زمین.',
        'با ساختن غرفه؛ خودکار.',
    ),
    Rank(
        LEVEL_VERIFIED_SELLER,
        'verified_seller',
        'سطح ۴ — غرفه‌دار تأییدشده',
        'غرفه در «غرفه‌های منتخب» و نتایج جستجو جلوتر می‌آید و نشان تأیید روی همهٔ آگهی‌ها می‌نشیند.',
        'با تأیید غرفه توسط ناظر؛ خودکار.',
    ),
    Rank(
        LEVEL_DESK_AGENT,
        'desk_agent',
        'سطح ۵ — کارشناس میز خدمات',
        'صف میز پشتیبانی و مشاوره در دسترسش است، با شیفت و امتیاز خودش — بدون قدرت سانسور محتوا.',
        'با انتصاب مدیر یا مالک.',
    ),
    Rank(
        LEVEL_MODERATOR,
        'moderator',
        'سطح ۶ — ناظر محتوا',
        'بازبینی آگهی‌ها، پست‌ها و شکایت‌ها، تقویم زمین و کنسول مدیریت.',
        'با انتصاب مدیر یا مالک.',
    ),
    Rank(
        LEVEL_ADMIN,
        'admin',
        'سطح ۷ — مدیر',
        'همهٔ کنسول، انتصاب نقش‌ها برای کارمندان، و دفتر مالی.',
        'با انتصاب مالک.',
    ),
    Rank(
        LEVEL_OWNER,
        'owner',
        'سطح ۸ — مالک سیستم',
        'تنظیمات مالکیت: ظرفیت و صف، ساعات میز، صفحات قانونی، و تعیین سطح بقیه.',
        'تنها مالک فعلی یا سوپرکاربر جنگو.',
    ),
)

RANKS: tuple[Rank, ...] = LADDER
RANK_BY_VALUE: dict[int, Rank] = {rank.value: rank for rank in LADDER}
RANK_BY_KEY: dict[str, Rank] = {rank.key: rank for rank in LADDER}

#: The model's ``choices``. The guest step is excluded — no stored account is a
#: guest; :func:`level_for` returns 0 for anonymous visitors.
LEVEL_CHOICES: tuple[tuple[int, str], ...] = tuple(
    (rank.value, rank.label) for rank in LADDER if rank.value >= MINIMUM_LEVEL
)

#: Levels that mean "this person works for the platform". ``is_staff`` follows
#: this set, so the Django admin and the level ladder agree about who is staff.
STAFF_LEVELS: tuple[int, ...] = tuple(
    rank.value for rank in LADDER if rank.value >= LEVEL_DESK_AGENT
)

#: From this level up a person is *answering* the service desks, so they stop
#: being their own customer. See :func:`may_contact_desk`.
SERVICE_STAFF_FLOOR = LEVEL_DESK_AGENT


# --- Capabilities -----------------------------------------------------------
#
# capability -> (human label, the first level that gets it). Everything is a
# floor, so the matrix stays honest with the comparison style the code already
# uses; a capability that needs something *other* than a rank (a duty, a
# verified storefront) is expressed by the helper functions below it.
CAPABILITIES: dict[str, tuple[str, int]] = {
    'browse': ('دیدن کالاها، غرفه‌ها و محتوا', LEVEL_BUYER),
    'order': ('ثبت سفارش و پرداخت', LEVEL_BUYER),
    'review': ('دیدگاه و امتیاز دادن', LEVEL_BUYER),
    'contact_storefront': ('گفتگو با غرفه‌دار', LEVEL_BUYER),
    'support_chat': ('گفتگو با میز پشتیبانی سایت', LEVEL_BUYER),
    'consult_desk': ('درخواست مشاوره کشاورزی', LEVEL_BUYER),
    'loyalty': ('کیف اعتبار، کوپن و پاداش', LEVEL_BUYER),
    'affiliate': ('همکاری در فروش و تسویه', LEVEL_BUYER),
    'verified_badge': ('نشان «تأییدشده» در گفتگو', LEVEL_VERIFIED_BUYER),
    'sell': ('غرفه، آگهی و استودیو غرفه', LEVEL_SELLER),
    'featured_storefront': ('نمایش در غرفه‌های منتخب', LEVEL_VERIFIED_SELLER),
    'desk_queue': ('کار روی صف میز خدمات', LEVEL_DESK_AGENT),
    'moderate': ('بازبینی محتوا و شکایت‌ها', LEVEL_MODERATOR),
    'console': ('کنسول مدیریت', LEVEL_MODERATOR),
    'manage_staff': ('انتصاب سطح و نقش کارمندان', LEVEL_ADMIN),
    'own': ('تنظیمات مالکیت سیستم', LEVEL_OWNER),
}

#: Which capability a given route/section needs, kept next to the matrix so the
#: management screen can say *why* a level is not enough.
CAPABILITY_LABELS: dict[str, str] = {key: label for key, (label, _floor) in CAPABILITIES.items()}


def label(value: object) -> str:
    """The Persian label for a level, safe for ``None``/junk input."""
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return ''
    rank = RANK_BY_VALUE.get(number)
    return rank.label if rank else ''


def rank_for(value: object) -> Rank | None:
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return RANK_BY_VALUE.get(number)


def is_valid(value: object) -> bool:
    """Whether ``value`` is a level a stored account may hold.

    Deliberately strict about type: a form or a query string hands us a string,
    and the caller should convert (and validate) it before asking this question.
    """
    if isinstance(value, bool) or not isinstance(value, int):
        return False
    return value in RANK_BY_VALUE and value >= MINIMUM_LEVEL


def level_for(user) -> int:
    """Resolve a user's level without assuming the profile row exists.

    Superusers are always owners, so a fresh ``createsuperuser`` account can
    reach the console before any profile row has been written.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return LEVEL_GUEST
    if getattr(user, 'is_superuser', False):
        return LEVEL_OWNER
    account = getattr(user, 'account', None)
    if account is None:
        return LEVEL_BUYER
    return int(account.level or LEVEL_BUYER)


def is_staff_level(value: object) -> bool:
    try:
        return int(value) in STAFF_LEVELS  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return False


def capabilities_for(user) -> dict[str, bool]:
    """The capability matrix as seen by one user.

    Two capabilities carry a second clause beyond the rank floor, and both come
    from the same principle — nobody queues as a customer at a desk they answer:

    * ``support_chat`` also drops for staff of any rank (a support operator,
      a moderator, a manager or the owner does not open a ticket against
      themselves);
    * ``consult_desk`` drops for whoever staffs the consulting desk, whatever
      their rank is.
    """
    level = level_for(user)
    out: dict[str, bool] = {}
    for key, (_label, floor) in CAPABILITIES.items():
        out[key] = level >= floor
    if out['support_chat'] and is_staff_level(level):
        out['support_chat'] = False
    if getattr(user, 'is_superuser', False):
        out['support_chat'] = False
        out['consult_desk'] = False
    if out['consult_desk'] and _staffs_consulting_desk(user):
        out['consult_desk'] = False
    return out


def _staffs_consulting_desk(user) -> bool:
    """Duty, not rank: is this person on the consulting roster?

    Imported lazily — ``models`` imports this module, so importing the desk at
    load time would close a cycle.
    """
    from .desk import is_operator_for
    from .models import StorefrontConversation

    return bool(is_operator_for(user, StorefrontConversation.CHANNEL_CONSULTING))


def may_contact_desk(user, channel: str, *, staff_of_desk: bool = False) -> tuple[bool, str]:
    """Whether this user may be the *customer* of one of the service desks.

    Returns ``(allowed, reason)``; the reason is the sentence the person reads,
    so it names where to go instead of only saying no. ``staff_of_desk`` lets
    the caller pass the narrower, duty-based answer — this very person sits at
    this desk — on top of the rank-based rule.
    """
    from .models import StorefrontConversation

    if staff_of_desk:
        return False, (
            'شما خودتان روی همین میز هستید؛ پیام شما به جای اینکه به صف برسد، در دسترس همکارانتان '
            'قرار می‌گیرد. مورد را از همان صف ثبت و پیگیری کنید.'
        )
    if channel == StorefrontConversation.CHANNEL_SUPPORT:
        if is_staff_level(level_for(user)) or getattr(user, 'is_superuser', False):
            return False, (
                'تیم گرین کود با میز پشتیبانی خودش گفتگو نمی‌کند؛ این صف برای کشاورزهاست. '
                'برای یک ایراد فنی «گزارش خطا» و برای باقی موارد «بازخورد پلتفرم» را استفاده کنید.'
            )
        return True, ''
    if is_operator_for_channel(user, channel):
        return False, (
            'شما خودتان در این میز حضور دارید؛ پیام شما به همکارانتان می‌رسد، نه به کشاورز دیگری. '
            'مورد را از صف میز ثبت کنید.'
        )
    return True, ''


def is_operator_for_channel(user, channel: str) -> bool:
    from .desk import is_operator_for

    return bool(is_operator_for(user, channel))


def matrix() -> list[dict[str, object]]:
    """The ladder with its capabilities, for the admin screens and the docs."""
    rows: list[dict[str, object]] = []
    for rank in LADDER:
        rows.append({
            'value': rank.value,
            'key': rank.key,
            'label': rank.label,
            'short_label': rank.short,
            'promise': rank.promise,
            'how': rank.how,
            'is_staff': rank.value in STAFF_LEVELS,
            'unlocks': [
                {'key': key, 'label': CAPABILITY_LABELS[key]}
                for key, (_label_unused, floor) in CAPABILITIES.items()
                if floor == rank.value
            ],
    })
    return rows


def next_step(user) -> dict[str, object] | None:
    """What the next rank is and how to reach it — the profile's «یک پله جلوتر»."""
    level = level_for(user)
    candidates = [rank for rank in LADDER if rank.value > level]
    # Staff ranks are never "the next step" a normal user can walk into; they
    # are appointments, and telling a farmer to wait for one is noise.
    if not candidates or candidates[0].value >= SERVICE_STAFF_FLOOR:
        return None
    rank = candidates[0]
    return {'value': rank.value, 'label': rank.label, 'how': rank.how, 'promise': rank.promise}
