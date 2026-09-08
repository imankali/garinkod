"""Reusable validators for the agri-inputs bounded context.

Kept as plain functions (not lambdas / not buried inside clean()) so they
ride on the FIELD: admin's ModelForm.full_clean, DRF's generated serializer
validators and direct ``instance.full_clean()`` all enforce the same rule,
and makemigrations can serialize the callable reference.
"""

from django.core.exceptions import ValidationError
from django.utils import timezone


def validate_expiry_not_past(value):
    """Regulated inputs can never be registered with an already-expired lot.

    Applied on ``Fertilizer.expiry_date``; any future dated expiry field in
    this module should reuse the same callable for consistent messaging."""
    if value and value < timezone.now().date():
        raise ValidationError('تاریخ انقضا نمی‌تواند در گذشته باشد. یک تاریخ آینده وارد کنید.')
