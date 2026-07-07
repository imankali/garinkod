# shop/apps.py

from django.apps import AppConfig


class ShopConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'shop'
    verbose_name = 'فروشگاه گرین کود'

    # ✅ اضافه شدن ready() برای signal handlers در آینده
    def ready(self):
        """
        این متد هنگام شروع Django اجرا می‌شود.
        برای ثبت signal handlers یا سایر initialization ها استفاده می‌شود.
        """
        # اگر در آینده signal نیاز داشتی، اینجا import کن:
        # import shop.signals
        pass