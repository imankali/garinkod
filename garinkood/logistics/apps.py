"""Logistics bounded context - customer-facing shipment tracking.

Independent Django app mirroring the holding's DDD layout (own models, admin,
API and migrations); the only inwards dependency is ``shop.Order`` via a
OneToOneField. This module owns the buyer-visible tracking projection: one
primary parcel per order with a unique carrier tracking code and an
append-only event timeline. Carrier-integrated fulfilment stays in
``shop.models.Shipment`` where the ops desk already manages it - see the
module docstring in ``logistics/models.py`` for the coexistence contract.
"""

from django.apps import AppConfig


class LogisticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "logistics"
    verbose_name = "لجستیک و رهگیری مرسولات"
