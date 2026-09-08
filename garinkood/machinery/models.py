"""ادوات و ماشین‌آلات — durable agri machinery as first-class domain models.

Same platform-kernel contract as agri_inputs: every record extends ONE
``shop.Product`` via ``OneToOneField(..., CASCADE)``; the catalogue row owns
price/stock/media, this module owns the mechanical profile — working hours,
condition (new vs second-hand), warranty and compatibility.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Tractor(models.Model):
    """تراکتور — powered unit with horsepower, year, hours and warranty."""

    product = models.OneToOneField(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="tractor_details",
        verbose_name="محصول مرتبط",
    )
    horsepower = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(10), MaxValueValidator(1000)],
        verbose_name="اسب بخار",
    )
    manufacture_year = models.PositiveSmallIntegerField(
        # بازار ایران هر دو تقویم را می‌نویسد (۱۴۰۱، ۲۰۲۴) — هر دو قبول است.
        validators=[MinValueValidator(1300), MaxValueValidator(2100)],
        verbose_name="سال ساخت",
        db_index=True,
        help_text="سال شمسی یا میلادی ساخت؛ مثلاً ۱۴۰۱ یا ۲۰۲۳",
    )
    working_hours = models.PositiveIntegerField(default=0, verbose_name="ساعت کارکرد")
    warranty_months = models.PositiveSmallIntegerField(default=0, db_index=True, verbose_name="گارانتی (ماه)")
    is_second_hand = models.BooleanField(default=False, db_index=True, verbose_name="دست دوم")

    class Meta:
        verbose_name = "تراکتور"
        verbose_name_plural = "تراکتورها"
        ordering = ("-manufacture_year",)
        indexes = [
            # Hot machinery list: recoverable/second-hand machines by year.
            models.Index(fields=("is_second_hand", "-manufacture_year"), name="tractor_sh_year_idx"),
        ]

    def __str__(self):
        title = getattr(self.product, "title", "")
        condition = "دست دوم" if self.is_second_hand else "نو"
        return f"تراکتور {title} ({condition})" if title else f"تراکتور #{self.pk}"


class Implement(models.Model):
    """ادوات — trailed/mounted tools: sprayer, disc, plough, seeder."""

    TYPE_SPRAYER = "sprayer"
    TYPE_DISC = "disc"
    TYPE_PLOUGH = "plough"
    TYPE_SEEDER = "seeder"
    TYPE_OTHER = "other"
    TYPE_CHOICES = (
        (TYPE_SPRAYER, "سم‌پاش"),
        (TYPE_DISC, "دیسک"),
        (TYPE_PLOUGH, "شخم‌زن"),
        (TYPE_SEEDER, "بذرکار"),
        (TYPE_OTHER, "سایر ادوات"),
    )

    product = models.OneToOneField(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="implement_details",
        verbose_name="محصول مرتبط",
    )
    implement_type = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default=TYPE_OTHER, db_index=True,
        verbose_name="نوع ادوات",
    )
    working_width = models.DecimalField(
        max_digits=4, decimal_places=2, db_index=True, verbose_name="عرض کار (متر)",
    )
    compatible_tractors = models.TextField(
        blank=True, verbose_name="تراکتورهای سازگار",
        help_text="متن آزاد؛ مثلاً: «جاندیر ۳۸۵، فرگوسن ۲۳۵، رومانی ۴۴۵»",
    )
    warranty_months = models.PositiveSmallIntegerField(default=0, db_index=True, verbose_name="گارانتی (ماه)")

    class Meta:
        verbose_name = "ادوات کشاورزی"
        verbose_name_plural = "ادوات کشاورزی"
        ordering = ("implement_type",)

    def __str__(self):
        title = getattr(self.product, "title", "")
        return f"{self.get_implement_type_display()} {title}" if title else f"ادوات #{self.pk}"
