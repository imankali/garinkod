"""Farming domain models for the shop app (split from models.py)."""

from django.db import models
from django.conf import settings
from django.db.models import F, Q
from .catalog import Product



# --- Farm profile: lands, calendars and consultation ---
class FarmLand(models.Model):
    """One production unit of a farmer: an orchard, a cropland or a greenhouse.

    A farmer may own any number of these, in any mix (two orchards, an orchard
    plus a greenhouse, …), and each land keeps its own identification record
    and its own calendar — the "case file" a consultant works on.
    """

    LAND_TYPE_CHOICES = (
        ('orchard', 'باغ'),
        ('farmland', 'زمین زراعی'),
        ('greenhouse', 'گلخانه'),
    )
    AREA_UNIT_CHOICES = (
        ('hectare', 'هکتار'),
        ('jarib', 'جریب'),
        ('square_meter', 'مترمربع'),
    )
    SOIL_TYPE_CHOICES = (
        ('loam', 'لومی'),
        ('clay', 'رسی'),
        ('sandy', 'شنی'),
        ('calcareous', 'آهکی'),
        ('other', 'سایر'),
    )
    IRRIGATION_TYPE_CHOICES = (
        ('drip', 'قطره‌ای'),
        ('sprinkler', 'بارانی'),
        ('flood', 'غرقابی'),
        ('furrow', 'کرتی/نشتی'),
        ('other', 'سایر'),
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='farm_lands'
    )
    name = models.CharField(max_length=120, verbose_name='نام زمین')
    land_type = models.CharField(max_length=20, choices=LAND_TYPE_CHOICES, verbose_name='نوع زمین')
    area = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='مساحت')
    area_unit = models.CharField(max_length=15, choices=AREA_UNIT_CHOICES, default='hectare', verbose_name='واحد مساحت')
    crop_type = models.CharField(max_length=150, verbose_name='نوع محصول')
    crop_variety = models.CharField(max_length=150, blank=True, verbose_name='رقم/واریته')
    province = models.CharField(max_length=80, blank=True, verbose_name='استان')
    city = models.CharField(max_length=80, blank=True, verbose_name='شهر')
    soil_type = models.CharField(max_length=15, choices=SOIL_TYPE_CHOICES, default='loam', verbose_name='نوع خاک')
    irrigation_type = models.CharField(
        max_length=15, choices=IRRIGATION_TYPE_CHOICES, default='drip', verbose_name='نوع آبیاری'
    )
    planting_date = models.DateField(null=True, blank=True, verbose_name='تاریخ کاشت')
    notes = models.TextField(max_length=2000, blank=True, verbose_name='یادداشت‌های شناسنامه')
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='فعال')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'زمین کشاورز'
        verbose_name_plural = 'زمین‌های کشاورزان'

    def __str__(self):
        return f'{self.name} ({self.get_land_type_display()})'

    @property
    def area_label(self) -> str:
        return f'{self.area} {self.get_area_unit_display()}'


class FarmCalendarEvent(models.Model):
    """One entry in a land's calendar: spraying, fertilizing or irrigation.

    Both the farmer and the consultant write here; every change keeps the
    author, so the farmer can see which recommendations came from the expert.
    """

    EVENT_KIND_CHOICES = (
        ('spraying', 'سم‌پاشی'),
        ('fertilizing', 'کوددهی'),
        ('irrigation', 'آبیاری'),
    )
    STATUS_CHOICES = (
        ('planned', 'برنامه‌ریزی‌شده'),
        ('done', 'انجام شد'),
        ('cancelled', 'لغو شد'),
    )

    land = models.ForeignKey(FarmLand, on_delete=models.CASCADE, related_name='calendar_events')
    kind = models.CharField(max_length=15, choices=EVENT_KIND_CHOICES, verbose_name='نوع عملیات')
    title = models.CharField(max_length=150, verbose_name='عنوان')
    date = models.DateField(db_index=True, verbose_name='تاریخ اجرا')
    notes = models.TextField(max_length=2000, blank=True, verbose_name='دستورالعمل')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='planned', db_index=True, verbose_name='وضعیت')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_farm_events'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('date', 'created_at')
        verbose_name = 'رویداد تقویم کشاورزی'
        verbose_name_plural = 'رویدادهای تقویم کشاورزی'
        indexes = [
            models.Index(fields=['land', 'date']),
        ]

    def __str__(self):
        return f'{self.land.name} — {self.get_kind_display()} ({self.date})'


class FarmConsultationRequest(models.Model):
    """A farmer's consultation request about one specific land (case file).

    The consultant opens the request and immediately has the full dossier:
    the farmer's profile, the chosen land's identification record and its
    calendar. Replies and calendar entries written afterwards are visible to
    the farmer on the same screen.
    """

    SUBJECT_CHOICES = (
        ('general', 'مشاوره عمومی'),
        ('spraying', 'مشاوره سم‌پاشی'),
        ('fertilizing', 'مشاوره کوددهی'),
        ('irrigation', 'مشاوره آبیاری'),
        ('pest', 'آفت و بیماری'),
    )
    STATUS_CHOICES = (
        ('pending', 'در انتظار بررسی'),
        ('answered', 'پاسخ داده شد'),
        ('closed', 'بسته شد'),
    )

    farmer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='consultation_requests'
    )
    land = models.ForeignKey(
        FarmLand, on_delete=models.CASCADE, related_name='consultation_requests'
    )
    subject = models.CharField(max_length=15, choices=SUBJECT_CHOICES, default='general', verbose_name='موضوع')
    message = models.TextField(max_length=3000, verbose_name='متن درخواست')
    reply = models.TextField(max_length=3000, blank=True, verbose_name='پاسخ مشاور')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending', db_index=True, verbose_name='وضعیت')
    replied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='replied_consultations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'درخواست مشاوره کشاورزی'
        verbose_name_plural = 'درخواست‌های مشاوره کشاورزی'

    def __str__(self):
        return f'{self.farmer.username} — {self.land.name}'


# --- Agricultural input reference data (dose calculator) ---


# --- Agricultural input reference data (dose calculator) ---
class AgriInput(models.Model):
    """A fertiliser or pesticide with the dose rates the calculator relies on.

    Recommendations are never invented at runtime: a dose is returned only when
    a matching `AgriInputDose` row exists, so the UI cannot suggest an unsafe or
    unverified rate.
    """

    KIND_CHOICES = (
        ('fertilizer', 'کود'),
        ('pesticide', 'سم'),
    )

    name = models.CharField(max_length=150, db_index=True)
    slug = models.SlugField(max_length=180, unique=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, db_index=True)
    active_ingredient = models.CharField(max_length=150, blank=True)
    formulation = models.CharField(max_length=100, blank=True, verbose_name='فرمولاسیون')
    unit = models.CharField(max_length=20, default='کیلوگرم', verbose_name='واحد اندازه‌گیری')
    product = models.ForeignKey(
        Product, null=True, blank=True, on_delete=models.SET_NULL, related_name='agri_inputs'
    )
    safety_notes = models.TextField(max_length=1500, blank=True, verbose_name='هشدارهای ایمنی')
    preharvest_interval_days = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name='دوره کارنس (روز)'
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('kind', 'name')
        verbose_name = 'نهاده کشاورزی'
        verbose_name_plural = 'نهاده‌های کشاورزی'

    def __str__(self):
        return f'{self.get_kind_display()}: {self.name}'


class AgriInputDose(models.Model):
    """A verified dose range for one input on one target crop."""

    BASIS_CHOICES = (
        ('per_hectare', 'به ازای هکتار'),
        ('per_1000_liter', 'به ازای ۱۰۰۰ لیتر آب'),
    )

    agri_input = models.ForeignKey(AgriInput, on_delete=models.CASCADE, related_name='doses')
    crop_name = models.CharField(max_length=120, db_index=True, verbose_name='محصول هدف')
    target = models.CharField(max_length=150, blank=True, verbose_name='آفت/نیاز هدف')
    basis = models.CharField(max_length=20, choices=BASIS_CHOICES, default='per_hectare')
    min_rate = models.DecimalField(max_digits=10, decimal_places=3, verbose_name='حداقل دوز')
    max_rate = models.DecimalField(max_digits=10, decimal_places=3, verbose_name='حداکثر دوز')
    rate_unit = models.CharField(max_length=20, default='کیلوگرم')
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ('crop_name',)
        verbose_name = 'دوز مصرف نهاده'
        verbose_name_plural = 'دوزهای مصرف نهاده'
        constraints = [
            models.UniqueConstraint(
                fields=['agri_input', 'crop_name', 'target', 'basis'],
                name='unique_dose_per_input_crop_target',
            ),
            models.CheckConstraint(
                condition=models.Q(max_rate__gte=models.F('min_rate')),
                name='dose_max_rate_gte_min_rate',
            ),
        ]

    def __str__(self):
        return f'{self.agri_input.name} — {self.crop_name}'


# --- Geography ---

