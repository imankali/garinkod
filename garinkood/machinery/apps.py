"""Machinery bounded context — durable agri equipment (tractors, implements).

Independent Django app mirroring agri_inputs' DDD layout: its own models,
admin, API and migrations; the only inwards dependency is shop.Product via
OneToOneField. Durable goods (warranty/working hours) instead of lots/expiry.
"""

from django.apps import AppConfig


class MachineryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "machinery"
    verbose_name = "ادوات و ماشین‌آلات کشاورزی"
