"""Export bounded context - export-bound orders and their customs papers.

Independent Django app mirroring the holding's DDD layout (own models, admin,
API and migrations); the only inwards dependency is ``shop.Order`` via a
OneToOneField. A minority of orders ever need export treatment (certificate
of origin, phytosanitary papers, foreign-currency proformas), so that profile
lives here instead of widening the kernel Order table.
"""

from django.apps import AppConfig


class ExportConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "export"
    verbose_name = "صادرات و تجارت بین‌الملل"
