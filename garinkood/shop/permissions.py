"""Level-aware DRF permissions.

The platform runs on the eight-step ladder in :mod:`shop.levels`. These classes
express "who may reach this endpoint at all"; Django's model permissions still
decide "which records may they change" on top of that.

Every message states the level in the number the console shows, and the numbers
come from the ladder rather than being typed here — a gate and the screen that
explains it must not be able to disagree after the next step is added.
"""

from rest_framework import permissions

from .levels import (
    LEVEL_ADMIN,
    LEVEL_BUYER,
    LEVEL_DESK_AGENT,
    LEVEL_MODERATOR,
    LEVEL_OWNER,
    LEVEL_SELLER,
    LEVEL_VERIFIED_BUYER,
    level_for,
)
from .persian import fa_digits


def _level_word(value: int) -> str:
    return f'سطح {fa_digits(str(value))}'


class IsAtLeastLevel(permissions.BasePermission):
    """Grant access when the caller's level is at or above ``required_level``."""

    required_level = LEVEL_BUYER
    message = 'سطح دسترسی شما برای این بخش کافی نیست.'

    def has_permission(self, request, view):
        return level_for(request.user) >= self.required_level


class IsVerifiedBuyer(IsAtLeastLevel):
    """Level 2+: the phone number behind the account was confirmed."""

    required_level = LEVEL_VERIFIED_BUYER
    message = f'برای این بخش شماره تلفن خود را تأیید کنید ({_level_word(LEVEL_VERIFIED_BUYER)}).'


class IsSeller(IsAtLeastLevel):
    """Level 3+: owns a storefront."""

    required_level = LEVEL_SELLER
    message = 'برای این بخش باید غرفه فعال داشته باشید.'


class IsDeskAgent(IsAtLeastLevel):
    """Level 5+: staffs one of the service desks.

    This is the tier the ladder gained so a hired operator can work the queue
    without also being handed the moderation tools.
    """

    required_level = LEVEL_DESK_AGENT
    message = f'کار روی صف میز خدمات به {_level_word(LEVEL_DESK_AGENT)} (کارشناس میز خدمات) نیاز دارد.'


class IsModerator(IsAtLeastLevel):
    """Level 6+: may review listings, posts, comments and complaints."""

    required_level = LEVEL_MODERATOR
    message = f'دسترسی به مرکز مدیریت از {_level_word(LEVEL_MODERATOR)} به بالا امکان‌پذیر است.'


class IsAdminLevel(IsAtLeastLevel):
    """Level 7+: may manage other staff members."""

    required_level = LEVEL_ADMIN
    message = f'این عملیات نیازمند {_level_word(LEVEL_ADMIN)} (مدیر) است.'


class IsOwnerLevel(IsAtLeastLevel):
    """Level 8: the system owner."""

    required_level = LEVEL_OWNER
    message = f'تنها مالک سیستم ({_level_word(LEVEL_OWNER)}) اجازه این عملیات را دارد.'


class IsStorefrontOwnerOrReadOnly(permissions.BasePermission):
    """Object-level rule: only the storefront owner may mutate its content.

    Works for any object exposing ``storefront``, ``user`` or being a
    ``Storefront`` itself. Moderators and above may always act.
    """

    message = 'این محتوا متعلق به غرفه شما نیست.'

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if level_for(request.user) >= LEVEL_MODERATOR:
            return True
        owner_id = None
        if hasattr(obj, 'storefront_id') and obj.storefront_id:
            owner_id = obj.storefront.user_id
        elif hasattr(obj, 'user_id'):
            owner_id = obj.user_id
        return bool(owner_id) and owner_id == getattr(request.user, 'id', None)
