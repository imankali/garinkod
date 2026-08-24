# shop/apps.py

from django.apps import AppConfig


class ShopConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'shop'
    verbose_name = 'فروشگاه گرین کود'

    def ready(self):
        # Register database connection tuning without importing models at
        # module load time.
        from . import db  # noqa: F401
        from . import signals  # noqa: F401