"""Accounts domain models for the shop app (split from models.py)."""

from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
from ..levels import LEVEL_ADMIN, LEVEL_BUYER, LEVEL_CHOICES, LEVEL_DESK_AGENT, LEVEL_GUEST, LEVEL_MODERATOR, LEVEL_OWNER, LEVEL_SELLER, LEVEL_VERIFIED_BUYER, LEVEL_VERIFIED_SELLER, MAXIMUM_LEVEL, MINIMUM_LEVEL, STAFF_LEVELS, level_for, rank_for, label as level_label



# --- User Account ---
class UserAccount(models.Model):
    GENDER_CHOICES = (
        ('male', 'آقا'),
        ('female', 'خانم'),
    )

    # Access levels: the eight-step ladder in ``shop/levels.py``. The level is
    # authoritative for coarse-grained access (the console, the storefront
    # tools, whether someone may open a ticket at all); Django groups still
    # express the fine-grained "which model may I change" permissions on top of
    # it. Labels and choices live in one place so a gate and the screen that
    # explains it cannot drift apart.
    LEVEL_GUEST = LEVEL_GUEST
    LEVEL_BUYER = LEVEL_BUYER
    LEVEL_VERIFIED_BUYER = LEVEL_VERIFIED_BUYER
    LEVEL_SELLER = LEVEL_SELLER
    LEVEL_VERIFIED_SELLER = LEVEL_VERIFIED_SELLER
    LEVEL_DESK_AGENT = LEVEL_DESK_AGENT
    LEVEL_MODERATOR = LEVEL_MODERATOR
    LEVEL_ADMIN = LEVEL_ADMIN
    LEVEL_OWNER = LEVEL_OWNER
    LEVEL_CHOICES = LEVEL_CHOICES
    STAFF_LEVELS = STAFF_LEVELS
    MINIMUM_LEVEL = MINIMUM_LEVEL
    MAXIMUM_LEVEL = MAXIMUM_LEVEL

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='account')
    phone = models.CharField(max_length=11, db_index=True, verbose_name="شماره تلفن")
    phone_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان تأیید شماره تلفن",
    )
    gender = models.CharField(max_length=15, choices=GENDER_CHOICES, default='male', verbose_name="جنسیت")
    address = models.TextField(max_length=250, blank=True, null=True, verbose_name="آدرس")
    # A seller's identity record. The marketplace only publishes a stall after
    # its owner has declared one, so a dispute can be traced to a real person;
    # the checksum is enforced by ``shop.national_id`` rather than here, so the
    # admin form and the storefront form cannot disagree about what "valid" means.
    national_id = models.CharField(
        max_length=10, blank=True, db_index=True, verbose_name="کد ملی",
    )
    national_id_verified_at = models.DateTimeField(
        null=True, blank=True, verbose_name="زمان تأیید کد ملی",
    )
    avatar = models.ImageField(upload_to='avatars/%Y/%m/', blank=True, null=True, verbose_name="تصویر پروفایل")
    level = models.PositiveSmallIntegerField(
        choices=LEVEL_CHOICES,
        default=LEVEL_BUYER,
        db_index=True,
        verbose_name="سطح دسترسی",
    )
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "حساب کاربری"
        verbose_name_plural = "حساب‌های کاربری"
        constraints = [
            models.UniqueConstraint(
                fields=['phone'],
                condition=~Q(phone=''),
                name='unique_nonempty_useraccount_phone',
            ),
        ]

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if self.pk and (update_fields is None or 'phone' in update_fields):
            previous_phone = type(self).objects.filter(pk=self.pk).values_list('phone', flat=True).first()
            verification_is_explicit = update_fields is not None and 'phone_verified_at' in update_fields
            if previous_phone != self.phone and not verification_is_explicit:
                self.phone_verified_at = None
                if update_fields is not None:
                    kwargs['update_fields'] = set(update_fields) | {'phone_verified_at'}
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username}"

    @property
    def avatar_url(self):
        return self.avatar.url if self.avatar else ''

    @property
    def is_staff_level(self) -> bool:
        return self.level in self.STAFF_LEVELS

    @property
    def level_label(self) -> str:
        return level_label(self.level)

    @property
    def rank(self):
        """The ladder row for this account, or None for an unknown value."""
        return rank_for(self.level)

    @property
    def verified_phone(self) -> bool:
        return self.phone_verified_at is not None

    def promote_to(self, level: int, *, save: bool = True) -> 'UserAccount':
        """Raise the level, never silently lowering an existing one."""
        if level > self.level:
            self.level = level
            if save:
                self.save(update_fields=['level', 'updated'])
        return self


def account_level(user) -> int:
    """Resolve a user's level without assuming the profile row exists.

    A thin alias for :func:`shop.levels.level_for`, kept because most of the
    codebase already speaks this name.
    """
    return level_for(user)


# --- Comment ---

