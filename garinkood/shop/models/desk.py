"""Desk domain models for the shop app (split from models.py)."""

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db.models import Sum
from datetime import time
from ..persian import fa_digits, platform_day_index
from .catalog import Comment
from .social import StorefrontConversation



# ========================================
# Service desks: consultants, support, working hours, satisfaction
# ========================================

class DeskSettings(models.Model):
    """Working hours and canned notices for the two service desks.

    One editable row rather than settings hard-coded in the theme: whether the
    farm-desk answers at 6am or 9am is a business decision of whoever runs the
    deployment, and the auto-reply that tells a farmer "we are closed" has to be
    worded by them too.

    Times are compared in the project timezone (``Asia/Tehran``), so the desk
    opens at six in the morning *for the farmer reading it*, not for a server in
    another zone.
    """

    DAY_CHOICES = (
        (0, 'شنبه'), (1, 'یکشنبه'), (2, 'دوشنبه'), (3, 'سه‌شنبه'),
        (4, 'چهارشنبه'), (5, 'پنجشنبه'), (6, 'جمعه'),
    )

    consulting_start = models.TimeField(default=time(6, 0), verbose_name='شروع مشاوره')
    consulting_end = models.TimeField(default=time(22, 0), verbose_name='پایان مشاوره')
    support_start = models.TimeField(default=time(6, 0), verbose_name='شروع پشتیبانی')
    support_end = models.TimeField(default=time(22, 0), verbose_name='پایان پشتیبانی')
    work_days = models.CharField(
        max_length=40, default='0,1,2,3,4,5,6',
        help_text='روزهای کاری با ایندکس شنبه=۰ تا جمعه=۶، جدا شده با کاما.',
        verbose_name='روزهای کاری',
    )
    presence_minutes = models.PositiveSmallIntegerField(
        default=10, help_text='چند دقیقه فعالیت آخر یک کارشناس «آنلاین» حساب شود.',
        verbose_name='بازه حضور (دقیقه)',
    )
    out_of_hours_note = models.TextField(
        max_length=400,
        default=(
            'الان خارج از ساعت کاری هستیم. درخواستتان را همین‌جا بنویسید؛ '
            'در اولین بازه کاری بعدی پاسخ می‌دهیم.'
        ),
        verbose_name='پیام خارج از ساعت کاری',
    )
    is_active = models.BooleanField(
        default=True, verbose_name='نمایش وضعیت میز خدمت',
        help_text='خاموش کردن، نشانگر آنلاین/ساعت کاری را از چت حذف می‌کند.',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'تنظیمات میز خدمت'
        verbose_name_plural = 'تنظیمات میز خدمت'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return 'تنظیمات میز خدمت'

    @classmethod
    def load(cls) -> 'DeskSettings':
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def work_day_indexes(self) -> list[int]:
        days = []
        for part in (self.work_days or '').split(','):
            part = part.strip()
            if part.isdigit() and 0 <= int(part) <= 6:
                days.append(int(part))
        return sorted(set(days)) or list(range(7))

    def window_for(self, channel: str) -> tuple[time, time]:
        if channel == 'consulting':
            return self.consulting_start, self.consulting_end
        return self.support_start, self.support_end

    @staticmethod
    def platform_day_index(moment) -> int:
        """Map Python's Monday=0 weekday onto the site's Saturday=0 index."""
        return platform_day_index(moment)

    def is_open_at(self, channel: str, moment=None) -> bool:
        """Whether the desk answers right now, in the project timezone."""
        if not self.is_active:
            return True
        moment = moment or timezone.localtime()
        start, end = self.window_for(channel)
        if self.platform_day_index(moment) not in self.work_day_indexes:
            return False
        current = moment.timetz().replace(tzinfo=None)
        if start <= end:
            return start <= current < end
        # A night shift (۲۲ تا ۶) is open before midnight *and* after it.
        return current >= start or current < end

    def hours_label(self, channel: str) -> str:
        start, end = self.window_for(channel)
        return f'{fa_digits(start.strftime("%H:%M"))} تا {fa_digits(end.strftime("%H:%M"))}'


class DeskAgent(models.Model):
    """A named consultant or support operator, with their own duty window.

    The platform's permission system decides *who may answer*; this row decides
    what the farmer sees and who the work is spread over. Without it a reply
    from the desk is signed «پشتیبانی» and nobody knows whom they are talking
    to — which is exactly what the user asked to fix.
    """

    ROLE_CONSULTING = 'consulting'
    ROLE_SUPPORT = 'support'
    ROLE_CHOICES = (
        (ROLE_CONSULTING, 'مشاور کشاورزی'),
        (ROLE_SUPPORT, 'پشتیبانی'),
    )

    # A foreign key rather than a one-to-one on purpose: on a small team the same
    # person does cover both desks, and each desk needs its own name, photo,
    # shift and rating average. ``(user, role)`` is what has to be unique.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='desk_profiles',
        verbose_name='کاربر کارشناس',
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_SUPPORT, verbose_name='میز')
    display_name = models.CharField(max_length=120, blank=True, verbose_name='نام نمایشی')
    title = models.CharField(max_length=120, blank=True, verbose_name='سمت', help_text='مثلاً «کارشناس ارشد تغذیه گیاه»')
    photo = models.ImageField(upload_to='desk/', blank=True, null=True, verbose_name='تصویر')
    bio = models.TextField(max_length=400, blank=True, verbose_name='تخصص‌ها و سوابق')
    specialties = models.CharField(
        max_length=200, blank=True, verbose_name='حوزه‌ها (با کاما)',
        help_text='مثلاً «سم‌پاشی، تغذیه، آبیاری» — برای تقسیم کار در صف.',
    )
    work_days = models.CharField(max_length=40, blank=True, verbose_name='روزهای کاری شخصی')
    work_start = models.TimeField(null=True, blank=True, verbose_name='شروع شیفت')
    work_end = models.TimeField(null=True, blank=True, verbose_name='پایان شیفت')
    max_open_threads = models.PositiveSmallIntegerField(
        default=0, verbose_name='سقف گفتگوی باز', help_text='۰ یعنی بدون سقف.',
    )
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='عضو فعال')
    order = models.PositiveSmallIntegerField(default=0, verbose_name='ترتیب')
    last_seen_at = models.DateTimeField(null=True, blank=True, verbose_name='آخرین فعالیت')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'کارشناس میز خدمت'
        verbose_name_plural = 'کارشناسان میز خدمت'
        ordering = ('order', 'display_name', 'id')
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'role'], name='unique_desk_agent_user_role',
            ),
        ]

    def __str__(self):
        return f'{self.display_label} — {self.get_role_display()}'

    @classmethod
    def for_user(cls, user, role: str | None = None) -> 'DeskAgent | None':
        """The profile this user shows on a desk, preferring the desk's role.

        Reads the prefetch cache when the queryset provided one (a thread
        serialises one message per reply, and one query per reply would be
        absurd), and falls back to a single lookup otherwise.
        """
        if user is None:
            return None
        profiles = None
        cache = getattr(getattr(user, '_prefetched_objects_cache', None), 'get', None)
        if cache is not None:
            profiles = cache('desk_profiles')
        rows = list(user.desk_profiles.all()) if profiles is not None else list(
            cls.objects.filter(user=user)
        )
        active = [row for row in rows if row.is_active]
        if role:
            for row in active:
                if row.role == role:
                    return row
        return active[0] if active else None

    @property
    def display_label(self) -> str:
        return (
            self.display_name
            or self.user.get_full_name()
            or self.user.username
        )

    @property
    def photo_url(self) -> str:
        if self.photo:
            return self.photo.url
        account = getattr(self.user, 'account', None)
        return account.avatar_url if account else ''

    @property
    def specialty_list(self) -> list[str]:
        return [item.strip() for item in (self.specialties or '').split(',') if item.strip()]

    def duty_window(self, settings_row: DeskSettings) -> tuple[time, time]:
        default = settings_row.window_for(self.role)
        return (self.work_start or default[0], self.work_end or default[1])

    def is_on_duty(self, settings_row: DeskSettings | None = None, moment=None) -> bool:
        """This person's own shift, not merely the desk's published hours."""
        settings_row = settings_row or DeskSettings.load()
        moment = moment or timezone.localtime()
        if not self.is_active:
            return False
        days = [
            int(part) for part in (self.work_days or '').split(',')
            if part.strip().isdigit() and 0 <= int(part.strip()) <= 6
        ]
        if days and settings_row.platform_day_index(moment) not in days:
            return False
        start, end = self.duty_window(settings_row)
        current = moment.timetz().replace(tzinfo=None)
        if start <= end:
            return start <= current < end
        return current >= start or current < end

    def is_present(self, settings_row: DeskSettings | None = None, moment=None) -> bool:
        """Online = the operator touched the desk very recently."""
        settings_row = settings_row or DeskSettings.load()
        if not self.last_seen_at:
            return False
        moment = moment or timezone.now()
        window = max(1, settings_row.presence_minutes) * 60
        return (moment - self.last_seen_at).total_seconds() <= window

    def open_threads(self):
        return StorefrontConversation.objects.filter(
            agent=self.user, status=StorefrontConversation.STATUS_OPEN,
        )

    @property
    def rating_average(self) -> float:
        rows = self.ratings.aggregate(total=Sum('score'), count=models.Count('id'))
        count = rows['count'] or 0
        if not count:
            return 0.0
        return round(rows['total'] / count, 2)

    @property
    def rating_count(self) -> int:
        return self.ratings.count()


class QuickReply(models.Model):
    """One tap-to-send line in a chat.

    Two audiences, because the ask was symmetrical: a farmer opening a
    consulting thread wants the questions other farmers ask («دوز مصرف را چطور
    حساب کنم؟»), while the operator answering 40 threads a day wants their own
    stock replies. Both are editable in the admin instead of being frozen in the
    front-end bundle.
    """

    AUDIENCE_CUSTOMER = 'customer'
    AUDIENCE_STAFF = 'staff'
    AUDIENCE_CHOICES = (
        (AUDIENCE_CUSTOMER, 'کاربر / کشاورز'),
        (AUDIENCE_STAFF, 'کارشناس میز'),
    )
    CHANNEL_CHOICES = (
        ('any', 'همه میزها'),
        (DeskAgent.ROLE_CONSULTING, 'مشاوره کشاورزی'),
        (DeskAgent.ROLE_SUPPORT, 'پشتیبانی'),
    )

    audience = models.CharField(max_length=10, choices=AUDIENCE_CHOICES, default=AUDIENCE_CUSTOMER)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='any', verbose_name='میز')
    label = models.CharField(
        max_length=60, blank=True, verbose_name='برچسب کوتاه',
        help_text='متن دکمه؛ خالی بمانید خود متن استفاده می‌شود.',
    )
    text = models.CharField(max_length=400, verbose_name='متن پیام')
    is_first_message_only = models.BooleanField(
        default=False, verbose_name='فقط برای اولین پیام',
        help_text='برای سؤالات متداولی که فقط بار اول لازم است.',
    )
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'پاسخ آماده'
        verbose_name_plural = 'پاسخ‌های آماده'
        ordering = ('order', 'id')

    def __str__(self):
        return f'[{self.get_audience_display()}/{self.get_channel_display()}] {self.label or self.text[:40]}'


class ConversationRating(models.Model):
    """The satisfaction survey a user leaves when a desk thread ends.

    Kept on its own rather than as a ``Comment.rating`` because it rates *the
    person who answered*, and the management panel needs to average it per
    operator to see whether a desk is actually helping.
    """

    conversation = models.ForeignKey(
        StorefrontConversation, on_delete=models.CASCADE, related_name='ratings',
    )
    rater = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversation_ratings',
        verbose_name='ثبت‌کننده',
    )
    agent = models.ForeignKey(
        DeskAgent, null=True, blank=True, on_delete=models.SET_NULL, related_name='ratings',
        verbose_name='کارشناس',
    )
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], verbose_name='امتیاز (۱ تا ۵)',
    )
    solved = models.BooleanField(
        null=True, blank=True, verbose_name='مشکل حل شد؟',
    )
    comment = models.TextField(max_length=1000, blank=True, verbose_name='توضیح')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'رضایت از گفتگو'
        verbose_name_plural = 'نظرسنجی گفتگوها'
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(
                fields=['conversation', 'rater'], name='unique_rating_per_conversation',
            ),
        ]

    def __str__(self):
        return f'{self.score}★ — گفتگوی {self.conversation_id}'


class CommentVote(models.Model):
    """One «مفید بود» per visitor per comment.

    Votes are anonymous-friendly on purpose (many buyers read reviews without
    logging in), but the row is keyed so a refresh cannot inflate a review, and it
    can be withdrawn.
    """

    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name='votes', verbose_name="نظر"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True,
        related_name='comment_votes',
    )
    visitor_key = models.CharField(max_length=64, blank=True, verbose_name="کلید بازدیدکننده")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "رأی مفید بودن"
        verbose_name_plural = "رأی‌های مفید بودن"
        constraints = [
            models.UniqueConstraint(fields=['comment', 'user'], name='unique_helpful_vote_per_user'),
        ]

    def __str__(self):
        return f"مفید بودنِ نظر {self.comment_id}"


class ReturnPolicySettings(models.Model):
    """How long a buyer has to send goods back, decided by the operator.

    A shop of this kind prints «۷ روز ضمانت بازگشت» in its footer and then
    answers questions differently on the phone. The number belongs in one record
    that both the badge and the legal text read, and it is left empty on purpose
    here: an unset window shows no number anywhere rather than an invented one.
    """

    window_days = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="مهلت بازگشت (روز)"
    )
    conditions = models.TextField(
        max_length=1500, blank=True,
        help_text='شرایطی که در همان صفحه حقوقی و زیر بنر پاورقی نمایش داده می‌شود.',
        verbose_name="شرایط بازگشت کالا",
    )
    express_shipping_enabled = models.BooleanField(
        default=False,
        help_text='گزینه «تحویل فوری» را در انتخاب روش ارسال فعال می‌کند.',
        verbose_name="ارسال فوری در سبد خرید",
    )
    express_shipping_fee = models.PositiveIntegerField(
        default=0, verbose_name="هزینه اضافی ارسال فوری (تومان)"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تنظیمات سیاست بازگشت کالا"
        verbose_name_plural = "تنظیمات سیاست بازگشت کالا"

    def __str__(self):
        if self.window_days:
            return f"بازگشت کالا تا {self.window_days} روز"
        return "سیاست بازگشت هنوز اعلام نشده"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def window_label(self) -> str:
        return f"{fa_digits(self.window_days)} روز ضمانت بازگشت کالا" if self.window_days else ""


# ========================================
# Operations: capacity, presence, admission and the system log
# ========================================

