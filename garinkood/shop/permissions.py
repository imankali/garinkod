"""Level-aware DRF permissions.

The platform has five user levels (see ``UserAccount.LEVEL_CHOICES``). These
classes express "who may reach this endpoint at all"; Django's model
permissions still decide "which records may they change" on top of that.
"""

from rest_framework import permissions

from .models import UserAccount, account_level


class IsAtLeastLevel(permissions.BasePermission):
    """Grant access when the caller's level is at or above ``required_level``."""

    required_level = UserAccount.LEVEL_BUYER
    message = 'سطح دسترسی شما برای این بخش کافی نیست.'

    def has_permission(self, request, view):
        return account_level(request.user) >= self.required_level


class IsSeller(IsAtLeastLevel):
    """Level 2+: owns a storefront."""

    required_level = UserAccount.LEVEL_SELLER
    message = 'برای این بخش باید غرفه فعال داشته باشید.'


class IsModerator(IsAtLeastLevel):
    """Level 3+: may review listings, posts, comments and complaints."""

    required_level = UserAccount.LEVEL_MODERATOR
    message = 'دسترسی به مرکز مدیریت از سطح ۳ به بالا امکان‌پذیر است.'


class IsAdminLevel(IsAtLeastLevel):
    """Level 4+: may manage other staff members."""

    required_level = UserAccount.LEVEL_ADMIN
    message = 'این عملیات نیازمند سطح ۴ (مدیر) است.'


class IsOwnerLevel(IsAtLeastLevel):
    """Level 5: the system owner."""

    required_level = UserAccount.LEVEL_OWNER
    message = 'تنها مالک سیستم (سطح ۵) اجازه این عملیات را دارد.'


class IsStorefrontOwnerOrReadOnly(permissions.BasePermission):
    """Object-level rule: only the storefront owner may mutate its content.

    Works for any object exposing ``storefront``, ``user`` or being a
    ``Storefront`` itself. Moderators and above may always act.
    """

    message = 'این محتوا متعلق به غرفه شما نیست.'

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if account_level(request.user) >= UserAccount.LEVEL_MODERATOR:
            return True
        owner_id = None
        if hasattr(obj, 'storefront_id') and obj.storefront_id:
            owner_id = obj.storefront.user_id
        elif hasattr(obj, 'user_id'):
            owner_id = obj.user_id
        return bool(owner_id) and owner_id == getattr(request.user, 'id', None)
