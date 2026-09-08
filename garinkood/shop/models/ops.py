"""Ops domain models for the shop app (split from models.py)."""

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.db.models import F
from django.core.exceptions import ValidationError
from datetime import time, timedelta
from ..levels import LEVEL_CHOICES
from ..persian import fa_digits



# ========================================
# Operations: capacity, presence, admission and the system log
# ========================================

class CapacitySettings(models.Model):
    """How many people the shop serves at once, and how that number is found.

    The default answer is measured, not remembered: the process reads its own
    container limits, so a 1 GB box is sized as a 1 GB box even when the host
    behind it has 64. What the operator supplies is two ratios they can argue with
    and one safety margin; a fixed number stays available for a deployment that
    knows something /proc does not.

    The waiting room is off by default. Locking real buyers out is a worse failure
    than a slow page, so the shop first reports the pressure and the operator
    decides when to start holding people at the door.
    """

    STRATEGY_AUTO = 'auto'
    STRATEGY_FIXED = 'fixed'
    STRATEGY_CHOICES = (
        (STRATEGY_AUTO, 'تطبیقی با توان سرور'),
        (STRATEGY_FIXED, 'عدد ثابت (دستی)'),
    )

    strategy = models.CharField(
        max_length=8, choices=STRATEGY_CHOICES, default=STRATEGY_AUTO, verbose_name='روش تعیین ظرفیت'
    )
    fixed_limit = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='فقط در روش دستی استفاده می‌شود؛ تعداد نفرانی که هم‌زمان داخل سایت می‌مانند.',
        verbose_name='سقف دستی',
    )
    users_per_cpu_core = models.PositiveSmallIntegerField(
        default=80,
        help_text='تخمین نفر به‌ازای هر هسته پردازنده، پیش از کسر ضریب اطمینان.',
        verbose_name='کاربر به‌ازای هر هسته',
    )
    users_per_gb_ram = models.PositiveSmallIntegerField(
        default=40,
        help_text='تخمین نفر به‌ازای هر گیگابایت حافظه‌ی آزادِ در دسترس این پروسه.',
        verbose_name='کاربر به‌ازای هر گیگابایت',
    )
    safety_percent = models.PositiveSmallIntegerField(
        default=75,
        help_text='سهمی از توان اندازه‌گیری‌شده که واقعاً به بازدیدکننده داده می‌شود؛ بقیه برای '
                  'کرنل، دیتابیس و جاهای غیرمنتظره می‌ماند.',
        verbose_name='ضریب اطمینان (٪)',
    )
    derate_load_percent = models.PositiveSmallIntegerField(
        default=150,
        help_text='اگر بار یک‌دقیقه‌ای هر هسته از این درصد بگذرد، سقف همان لحظه به همان نسبت '
                  'کم می‌شود؛ یعنی وقتی خودِ ماشین زیر فشار است، صف زودتر شروع می‌شود.',
        verbose_name='آستانه فشار (٪ بار هر هسته)',
    )
    activity_window_minutes = models.PositiveSmallIntegerField(
        default=5,
        help_text='چند دقیقه از آخرین درخواست یک نفر، او را «آنلاین» حساب می‌کند.',
        verbose_name='بازه حضور (دقیقه)',
    )
    sample_interval_seconds = models.PositiveSmallIntegerField(
        default=60,
        help_text='چند وقت یک‌بار وضعیت سرور نمونه‌برداری و در نمودار ثبت می‌شود.',
        verbose_name='بازه نمونه‌برداری (ثانیه)',
    )
    queue_enabled = models.BooleanField(
        default=False,
        help_text='با روشن‌کردن، بازدیدکننده‌ی تازه‌ای که جایی نمانده به صفحه انتظار می‌رود و '
                  'هرچه باز می‌شود به ترتیب ورودش داخل می‌آید.',
        verbose_name='صف انتظار',
    )
    queue_max_minutes = models.PositiveSmallIntegerField(
        default=30,
        help_text='پس از این مدت در صف، کاربر بدون توجه به ظرفیت وارد می‌شود؛ هیچ‌کس تا '
                  'ابدیدر صف نمی‌ماند.',
        verbose_name='حداکثر ماندن در صف (دقیقه)',
    )
    queue_message = models.TextField(
        max_length=600, blank=True,
        help_text='متنی که کاربر در صفحه انتظار می‌خواند. خالی بماند، پیام پیش‌فرض نمایش داده می‌شود.',
        verbose_name='پیام صفحه انتظار',
    )
    bypass_staff = models.BooleanField(
        default=True,
        help_text='کارمندان و مدیران هرگز در صف نمی‌مانند تا بتوانند سایت را درست کنند.',
        verbose_name='عبور کارکنان از صف',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'تنظیمات ظرفیت و صف'
        verbose_name_plural = 'تنظیمات ظرفیت و صف'

    # The middleware reads this on every request, so the row is cached for a few
    # seconds instead of being selected per page view.
    _CACHE_SECONDS = 15.0
    _cache: dict = {'row': None, 'until': 0.0}

    def __str__(self):
        if self.strategy == self.STRATEGY_FIXED:
            return f"سقف دستی: {fa_digits(self.fixed_limit or 0)} نفر"
        return 'ظرفیت تطبیقی با توان سرور'

    @classmethod
    def load(cls) -> 'CapacitySettings':
        import time

        now = time.monotonic()
        row = cls._cache['row']
        if row is not None and now < cls._cache['until']:
            return row
        obj, _ = cls.objects.get_or_create(pk=1)
        cls._cache['row'] = obj
        cls._cache['until'] = now + cls._CACHE_SECONDS
        return obj

    @classmethod
    def clear_cache(cls) -> None:
        """Called on save, so an edit in the admin takes effect at once."""
        cls._cache['row'] = None
        cls._cache['until'] = 0.0

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        type(self).clear_cache()

    @property
    def is_measured(self) -> bool:
        return self.strategy == self.STRATEGY_AUTO

    @property
    def queue_is_live(self) -> bool:
        return self.queue_enabled

    def clean(self):
        if self.strategy == self.STRATEGY_FIXED and not self.fixed_limit:
            raise ValidationError({'fixed_limit': 'در روش دستی، یک عدد برای سقف لازم است.'})


class ResourceSample(models.Model):
    """One reading of the machine, kept so a graph is made of measurements.

    Nothing here is estimated after the fact: the row is written by the request
    path at most once per sampling interval, which is also what makes the
    «وضعیت در لحظه فشار» in the console something an operator can trust.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    cpu_count = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='هسته‌ها')
    load_1m = models.FloatField(null=True, blank=True, verbose_name='بار یک‌دقیقه‌ای')
    load_5m = models.FloatField(null=True, blank=True, verbose_name='بار پنج‌دقیقه‌ای')
    memory_total_mb = models.PositiveIntegerField(null=True, blank=True, verbose_name='حافظه کل (مگابایت)')
    memory_available_mb = models.PositiveIntegerField(null=True, blank=True, verbose_name='حافظه آزاد')
    container_limit_mb = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='سقف حافظه کانتینر'
    )
    disk_free_mb = models.PositiveIntegerField(null=True, blank=True, verbose_name='فضای آزاد دیسک')
    disk_total_mb = models.PositiveIntegerField(null=True, blank=True, verbose_name='فضای کل دیسک')
    gpu = models.CharField(max_length=140, blank=True, verbose_name='پردازنده گرافیکی')
    online_users = models.PositiveIntegerField(default=0, verbose_name='کاربران آنلاین')
    online_guests = models.PositiveIntegerField(default=0, verbose_name='مهمان‌های آنلاین')
    queue_waiting = models.PositiveIntegerField(default=0, verbose_name='در صف')
    capacity_limit = models.PositiveIntegerField(default=0, verbose_name='سقف استفاده‌شده')
    capacity_basis = models.CharField(max_length=220, blank=True, verbose_name='نحوه محاسبه')

    class Meta:
        verbose_name = 'نمونه وضعیت سرور'
        verbose_name_plural = 'نمونه‌های وضعیت سرور'
        ordering = ('-created_at',)

    def __str__(self):
        return (
            f"{self.created_at:%Y-%m-%d %H:%M} — {fa_digits(self.online_users + self.online_guests)} نفر، "
            f"سقف {fa_digits(self.capacity_limit)}"
        )


class PresenceBeat(models.Model):
    """One row per visitor, refreshed at most once a minute.

    «چند نفر آنلاین‌اند» has to come from somewhere, and the only honest source is
    the requests people actually make. A dedicated row per identity (rather than a
    counter) is what lets the console also answer «چه کسانی»، and the write is
    self-throttling: one UPDATE per visitor per window, so a flood of traffic adds
    one query per person per minute and not one per page view.
    """

    KIND_USER = 'user'
    KIND_GUEST = 'guest'

    identity = models.CharField(max_length=90, unique=True, verbose_name='شناسه نشست')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE,
        related_name='presence_beats', verbose_name='کاربر'
    )
    kind = models.CharField(max_length=5, choices=((KIND_USER, 'کاربر'), (KIND_GUEST, 'مهمان')), db_index=True)
    is_staff = models.BooleanField(default=False, verbose_name='از کارکنان')
    path = models.CharField(max_length=200, blank=True, verbose_name='آخرین نشانی')
    requests = models.PositiveIntegerField(default=1, verbose_name='درخواست‌ها در این بازه')
    started_at = models.DateTimeField(auto_now_add=True, verbose_name='شروع این نشست')
    last_seen_at = models.DateTimeField(db_index=True, verbose_name='آخرین فعالیت')

    class Meta:
        verbose_name = 'حضور کاربر'
        verbose_name_plural = 'حضور کاربران'
        ordering = ('-last_seen_at',)
        indexes = [models.Index(fields=['kind', 'last_seen_at'])]

    def __str__(self):
        label = self.user.get_username() if self.user else 'مهمان'
        return f"{label} — ساعت {fa_digits(timezone.localtime(self.last_seen_at).strftime('%H:%M'))}"

    @classmethod
    def online(cls, window_minutes: int | None = None) -> 'QuerySet':
        """Everyone whose last request is inside the presence window."""
        minutes = window_minutes if window_minutes is not None else cls.settings_window()
        since = timezone.now() - timedelta(minutes=max(1, minutes))
        return cls.objects.filter(last_seen_at__gte=since)

    @staticmethod
    def settings_window() -> int:
        return max(1, CapacitySettings.load().activity_window_minutes)


class QueueTicket(models.Model):
    """A visitor held at the door, in line for a free place.

    Admission is first-come-first-served and the line moves on its own: every time
    the pressure drops, the oldest waiting ticket is let in. Nobody is trapped —
    after the configured ceiling of patience a visitor is admitted whatever the
    load, because an infinity of waiting is how a shop loses a customer for good.
    """

    STATUS_WAITING = 'waiting'
    STATUS_ADMITTED = 'admitted'
    STATUS_CHOICES = ((STATUS_WAITING, 'در صف'), (STATUS_ADMITTED, 'وارد شده'))

    key = models.CharField(max_length=64, unique=True, verbose_name='کلید صف')
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_WAITING, db_index=True
    )
    path = models.CharField(max_length=200, blank=True, verbose_name='صفحه‌ی درخواستی')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='ورود به صف')
    admitted_at = models.DateTimeField(null=True, blank=True, verbose_name='زمان ورود')
    waits = models.PositiveIntegerField(
        default=1, help_text='چند بار پشت‌درپیش به صفحه انتظار برگشته است؛ برای اینکه کسی '
                             'با رفراف‌کردن جلوتر نزند.',
        verbose_name='تعداد مراجعه',
    )

    class Meta:
        verbose_name = 'بلیت صف'
        verbose_name_plural = 'بلیت‌های صف'
        ordering = ('created_at', 'id')

    def __str__(self):
        state = 'در صف' if self.status == self.STATUS_WAITING else 'وارد شده'
        return f"صف {state} — {self.created_at:%H:%M}"

    @property
    def position(self) -> int:
        """How many people came before this one and are still waiting."""
        if self.status != self.STATUS_WAITING:
            return 0
        return QueueTicket.objects.filter(
            status=QueueTicket.STATUS_WAITING, created_at__lt=self.created_at
        ).count() + 1

    def minutes_waiting(self) -> int:
        return int((timezone.now() - self.created_at).total_seconds() // 60)


class SystemLogEntry(models.Model):
    """What broke, how often, and whether anyone has looked at it.

    Errors are grouped rather than appended: a bug that fires on every page view
    would otherwise bury the two things that matter in a wall of identical lines.
    ``count``/``last_at`` keep the frequency honest while the list stays readable,
    and a client can report what it saw here too — which is the difference between
    «the app froze for someone» and a report of it that nobody receives.

    Secrets never come near this table: what is written is run through
    :func:`shop.capacity.redact` first.
    """

    LEVEL_ERROR = 'error'
    LEVEL_WARNING = 'warning'
    LEVEL_NOTICE = 'notice'
    LEVEL_CHOICES = (
        (LEVEL_ERROR, 'خطا'),
        (LEVEL_WARNING, 'هشدار'),
        (LEVEL_NOTICE, 'ثبت'),
    )

    group = models.CharField(
        max_length=40, unique=True, db_index=True,
        help_text='اثر انگشت یکسان برای رویدادهای تکراری؛ یک ردیف، یک مشکل.',
        verbose_name='گروه',
    )
    level = models.CharField(max_length=7, choices=LEVEL_CHOICES, default=LEVEL_ERROR, db_index=True)
    source = models.CharField(max_length=70, db_index=True, verbose_name='بخش')
    title = models.CharField(max_length=200, verbose_name='خلاصه')
    message = models.TextField(max_length=4000, blank=True, verbose_name='جزئیات')
    path = models.CharField(max_length=200, blank=True, verbose_name='نشانی')
    method = models.CharField(max_length=8, blank=True, verbose_name='روش')
    status_code = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name='کد وضعیت')

    count = models.PositiveIntegerField(default=1, verbose_name='تکرار')
    first_at = models.DateTimeField(auto_now_add=True, verbose_name='نخستین بار')
    last_at = models.DateTimeField(default=timezone.now, db_index=True, verbose_name='آخرین بار')

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='system_logs', verbose_name='کاربر'
    )
    user_label = models.CharField(max_length=120, blank=True, verbose_name='نام کاربر در زمان رخداد')
    visitor_key = models.CharField(max_length=64, blank=True, verbose_name='کلید بازدیدکننده')
    context = models.JSONField(default=dict, blank=True, verbose_name='بافت')

    resolved_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name='برطرف شد')
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='resolved_logs', verbose_name='توسط'
    )
    note = models.TextField(max_length=1000, blank=True, verbose_name='یادداشت رفع')

    class Meta:
        verbose_name = 'رویداد سامانه'
        verbose_name_plural = 'رویدادهای سامانه'
        ordering = ('-last_at',)

    def __str__(self):
        return f"[{self.get_level_display()}] {self.source} — {self.title[:60]}"

    @property
    def is_open(self) -> bool:
        return self.resolved_at is None

    @staticmethod
    def group_key(source: str, title: str) -> str:
        import hashlib

        return hashlib.sha1(f"{source}|{title[:180]}".encode('utf-8')).hexdigest()[:40]

    @classmethod
    def record(
        cls, *, source: str, title: str, level: str = LEVEL_ERROR, message: str = '',
        path: str = '', method: str = '', status_code: int | None = None,
        user=None, visitor_key: str = '', context: dict | None = None,
    ) -> 'SystemLogEntry | None':
        """Add one occurrence, opening a row the first time it is seen.

        Returns ``None`` rather than raising: a log that can itself break the
        request it is describing would turn a fault into an outage.
        """
        from ..capacity import redact

        try:
            entry, created = cls.objects.get_or_create(
                group=cls.group_key(source, title[:200]),
                defaults={
                    'level': level,
                    'source': source[:70],
                    'title': title[:200],
                    'message': message[:4000],
                    'path': path[:200],
                    'method': method[:8],
                    'status_code': status_code,
                    'user': user if getattr(user, 'pk', None) else None,
                    'user_label': (user.get_username() if getattr(user, 'pk', None) else '')[:120],
                    'visitor_key': visitor_key[:64],
                    'context': redact(context or {}),
                },
            )
            if not created:
                cls.objects.filter(pk=entry.pk).update(
                    count=F('count') + 1,
                    last_at=timezone.now(),
                    # A resolved problem that came back must not stay closed.
                    resolved_at=None,
                    level=level,
                    message=message[:4000] or entry.message,
                    path=path[:200] or entry.path,
                )
                entry.refresh_from_db()
            return entry
        except Exception:  # pragma: no cover - logging must never break a request
            return None

