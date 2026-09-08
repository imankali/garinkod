"""Agri-inputs bounded context — fertilizers, pesticides, seeds, seedlings.

This is an independent Django app (DDD): it owns its models, admin, API and
migrations. The only inwards dependency is the platform-kernel ``shop.Product``
row it extends with domain-specific attributes via OneToOneField.
"""

from django.apps import AppConfig


class AgriInputsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "agri_inputs"
    verbose_name = "نهاده‌های کشاورزی (کود، سم، بذر، نهال)"
