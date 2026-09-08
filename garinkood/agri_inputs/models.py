"""نهاده‌های کشاورزی — consumable agri inputs as first-class domain models.

Every record extends ONE platform product (``shop.Product``) through a
``OneToOneField`` with ``on_delete=CASCADE``: the product stays the single
price/stock/media source of truth, and this module only carries the
regulatory/agronomic profile (registration numbers, expiry, agronomy).
Deleting the product deletes the profile; never reverse-side side effects.

DRY note: ``AbstractRegisteredInput`` نگه‌دارنده‌ی فیلد «شماره ثبت جهاد» است
زیرا هر دو کلاس قانون‌محورِ کود و سم نیازمند آن‌اند؛ بذر و نهال این شناسه را
ندارند و آن ارث‌بری نمی‌کنند — آگاهانه. هر دو کلاس قانون‌محور «تاریخ انقضا»
هم دارند (واقعیت دامنه: سموم هم منقضی می‌شوند) و property مشترکِ is_expired.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from .validators import validate_expiry_not_past


class AbstractRegisteredInput(models.Model):
    """Abstract base for regulated inputs that carry a Jihad registration id.

    Concrete tables each receive their own (unique) index — abstract classes
    never create a table, so the constraint lands exactly where the data is.
    """

    registration_number = models.CharField(
        max_length=40, unique=True, verbose_name="شماره ثبت جهاد کشاورزی"
    )

    class Meta:
        abstract = True


class Fertilizer(AbstractRegisteredInput):
    """کود — fertilizer with NPK ratio, Jihad registration and guarded expiry."""

    product = models.OneToOneField(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="fertilizer_details",
        verbose_name="محصول مرتبط",
    )
    active_ingredient = models.CharField(max_length=120, verbose_name="ماده مؤثره")
    npk_ratio = models.CharField(
        max_length=20,
        verbose_name="نسبت N-P-K",
        help_text="به‌صورت سه‌بخشی با خط تیره؛ مثل 20-20-20",
    )
    expiry_date = models.DateField(
        db_index=True,
        validators=[validate_expiry_not_past],
        verbose_name="تاریخ انقضا",
    )

    class Meta:
        verbose_name = "کود"
        verbose_name_plural = "کودها"
        ordering = ("expiry_date",)

    @property
    def is_expired(self) -> bool:
        """قرارداد نمایشی+گزارش‌پذیر؛ حاوی فایلترویر ValidationError نیست —
        زمینه: از validations هنگام ساخت/ویرایش جلوگیری می‌شود، اما داده‌های
        قدیمی طبیعتاً روزی منقضی خواهند شد و این property نمایش را امکان‌پذیر می‌کند."""
        if not self.expiry_date:
            return False
        return self.expiry_date < timezone.now().date()

    def __str__(self):
        title = getattr(self.product, "title", "")
        return f"کود {title} ({self.npk_ratio})" if title else f"کود #{self.pk}"


class Pesticide(AbstractRegisteredInput):
    """سم — pesticide with toxicity level, waiting period and expiry.

    (architectural note V2: این مدل فاقد expiry_date بود که یک نقص دامنه‌ای
    بود — سموم مانند کود تاریخ انقضا دارند. فیلد نال‌پذیر است تا رکوردهای
    قدیمی‌تر که پیش از این اصلاح ساخته‌اند نیاز به پیش‌فرض مصنوعی نداشته باشند.)"""

    TOXICITY_LOW = "low"
    TOXICITY_MEDIUM = "medium"
    TOXICITY_HIGH = "high"
    TOXICITY_CHOICES = (
        (TOXICITY_LOW, "کم"),
        (TOXICITY_MEDIUM, "متوسط"),
        (TOXICITY_HIGH, "زیاد"),
    )

    product = models.OneToOneField(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="pesticide_details",
        verbose_name="محصول مرتبط",
    )
    target_pest = models.CharField(max_length=150, verbose_name="آفت هدف")
    toxicity_level = models.CharField(
        max_length=10, choices=TOXICITY_CHOICES, default=TOXICITY_MEDIUM, db_index=True,
        verbose_name="سطح سمیت",
    )
    waiting_period = models.PositiveSmallIntegerField(verbose_name="دوره کارنس (روز)")
    expiry_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        validators=[validate_expiry_not_past],
        verbose_name="تاریخ انقضا",
    )

    class Meta:
        verbose_name = "سم"
        verbose_name_plural = "سموم"
        ordering = ("product_id",)

    @property
    def is_expired(self) -> bool:
        if not self.expiry_date:
            return False
        return self.expiry_date < timezone.now().date()

    def __str__(self):
        title = getattr(self.product, "title", "")
        return f"سم {title}" if title else f"سم #{self.pk}"


class Seed(models.Model):
    """بذر — seed lot with germination rate (bounded 0..100) and season."""

    SEASON_SPRING = "spring"
    SEASON_AUTUMN = "autumn"
    SEASON_BOTH = "both"
    SEASON_CHOICES = (
        (SEASON_SPRING, "بهار"),
        (SEASON_AUTUMN, "پاییز"),
        (SEASON_BOTH, "هر دو فصل"),
    )

    product = models.OneToOneField(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="seed_details",
        verbose_name="محصول مرتبط",
    )
    germination_rate = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name="نرخ جوانه‌زنی (درصد)",
    )
    planting_season = models.CharField(
        max_length=10, choices=SEASON_CHOICES, default=SEASON_SPRING, db_index=True,
        verbose_name="فصل کاشت",
    )
    seed_treatment = models.BooleanField(default=False, db_index=True, verbose_name="ضدعفونی‌شده")
    variety_name = models.CharField(max_length=120, verbose_name="نام رقم")

    class Meta:
        verbose_name = "بذر"
        verbose_name_plural = "بذرها"
        ordering = ("variety_name",)

    def __str__(self):
        return f"بذر {self.variety_name}"


class Seedling(models.Model):
    """نهال — grafted seedling with rootstock/scion and physical profile."""

    product = models.OneToOneField(
        "shop.Product",
        on_delete=models.CASCADE,
        related_name="seedling_details",
        verbose_name="محصول مرتبط",
    )
    rootstock = models.CharField(max_length=120, verbose_name="پایه")
    scion_variety = models.CharField(max_length=120, verbose_name="رقم پیوندی")
    age_years = models.PositiveSmallIntegerField(db_index=True, verbose_name="سن نهال (سال)")
    height_cm = models.PositiveSmallIntegerField(verbose_name="ارتفاع (سانتی‌متر)")

    class Meta:
        verbose_name = "نهال"
        verbose_name_plural = "نهال‌ها"
        ordering = ("product_id",)

    def __str__(self):
        return f"نهال {self.scion_variety} روی {self.rootstock}"
