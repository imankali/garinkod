"""Core domain models for the shop app (split from models.py)."""

from django.db import models
from django.conf import settings



# --- Geography ---
class Location(models.Model):
    """Provinces and their cities in one self-referencing table.

    A province row has `parent = None`; a city row points at its province. This
    keeps a single endpoint, a single foreign key target and lets the tree grow
    (districts, villages) without another migration.
    """

    KIND_CHOICES = (
        ('province', 'استان'),
        ('city', 'شهر'),
    )

    name = models.CharField(max_length=80, db_index=True)
    slug = models.SlugField(max_length=100)
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, db_index=True)
    parent = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.CASCADE, related_name='children'
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ('kind', 'name')
        verbose_name = 'موقعیت جغرافیایی'
        verbose_name_plural = 'موقعیت‌های جغرافیایی'
        constraints = [
            models.UniqueConstraint(fields=['parent', 'name'], name='unique_location_name_per_parent'),
        ]
        indexes = [
            models.Index(fields=['kind', 'name']),
        ]

    def __str__(self):
        if self.parent_id:
            return f'{self.parent.name} / {self.name}'
        return self.name

    @property
    def province_name(self) -> str:
        return self.parent.name if self.parent_id else self.name


# --- Management audit trail ---


# --- Management audit trail ---
class AdminAuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='management_actions')
    action = models.CharField(max_length=120, db_index=True)
    target_type = models.CharField(max_length=100)
    target_id = models.CharField(max_length=64)
    summary = models.CharField(max_length=500)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'لاگ مدیریتی'
        verbose_name_plural = 'لاگ‌های مدیریتی'

    def __str__(self):
        return f'{self.action} — {self.target_type}:{self.target_id}'


# --- External messaging and mobile OTP ---

