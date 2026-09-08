"""Content domain models for the shop app (split from models.py)."""

from simple_history.models import HistoricalRecords
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone
from django.db.models import Q
from django.core.exceptions import ValidationError
from .catalog import Product



# ========================================
# Site content: articles, growing guides, services, landing pages, trust pages
# ========================================
class SiteArticle(models.Model):
    """A site-wide editorial article or a per-crop growing guide.

    ``guide`` articles are the "راهنمای کشت گل کلم" style pages: climate, soil,
    planting, care, harvest and storage, linked to the catalogue products and
    storefront listings that belong to that crop.
    """

    KIND_ARTICLE = 'article'
    KIND_GUIDE = 'guide'
    KIND_CHOICES = (
        (KIND_ARTICLE, 'مقاله'),
        (KIND_GUIDE, 'راهنمای کشت'),
    )

    title = models.CharField(max_length=220, verbose_name="عنوان")
    slug = models.SlugField(max_length=240, unique=True, verbose_name="اسلاگ")
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default=KIND_ARTICLE, db_index=True)
    excerpt = models.TextField(max_length=500, blank=True, verbose_name="چکیده")
    body = models.TextField(verbose_name="متن مقاله")
    cover = models.ImageField(upload_to='articles/%Y/%m/', blank=True, null=True, verbose_name="تصویر جلد")
    crop = models.CharField(max_length=120, blank=True, db_index=True, verbose_name="محصول/گیاه")
    author = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='articles', verbose_name="نویسنده"
    )
    products = models.ManyToManyField(Product, blank=True, related_name='articles', verbose_name="محصولات مرتبط")
    listings = models.ManyToManyField(
        'MarketplaceListing', blank=True, related_name='articles', verbose_name="آگهی‌های مرتبط"
    )
    related_articles = models.ManyToManyField('self', blank=True, symmetrical=False, verbose_name="مقالات مرتبط")
    reading_minutes = models.PositiveSmallIntegerField(default=0, verbose_name="زمان مطالعه (دقیقه)")
    views = models.PositiveIntegerField(default=0, verbose_name="بازدید")
    is_published = models.BooleanField(default=False, db_index=True, verbose_name="منتشر شده")
    published_at = models.DateTimeField(null=True, blank=True, verbose_name="تاریخ انتشار")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ به‌روزرسانی")
    is_featured = models.BooleanField(default=False, verbose_name="نمایش در صفحه اصلی")
    seo_title = models.CharField(max_length=70, blank=True, verbose_name="عنوان سئو")
    seo_description = models.CharField(max_length=170, blank=True, verbose_name="توضیح متا")
    created_at = models.DateTimeField(auto_now_add=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ('-published_at', '-id')
        verbose_name = "مقاله سایت"
        verbose_name_plural = "مقالات سایت"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.is_published and not self.published_at:
            self.published_at = timezone.now()
        if not self.reading_minutes:
            # Rough Persian reading speed (~180 words per minute).
            words = len((self.body or '').split())
            self.reading_minutes = max(1, round(words / 180)) if words else 0
        super().save(*args, **kwargs)

    @property
    def cover_url(self):
        return self.cover.url if self.cover else '/images/hero-farm.jpg'

    def get_absolute_url(self):
        prefix = '/guides' if self.kind == self.KIND_GUIDE else '/blog'
        return f"{prefix}/{self.slug}"


class Service(models.Model):
    """A purchasable/quotable farm service with its own detail page."""

    # ``code`` mirrors ServiceRequest.service_type so a service page can deep
    # link straight into the request form with the right option preselected.
    title = models.CharField(max_length=150, verbose_name="عنوان خدمت")
    slug = models.SlugField(max_length=170, unique=True, verbose_name="اسلاگ")
    code = models.CharField(max_length=30, verbose_name="کد خدمت")
    summary = models.TextField(max_length=400, verbose_name="خلاصه")
    body = models.TextField(blank=True, verbose_name="توضیحات کامل")
    highlights = models.TextField(
        blank=True,
        verbose_name="مزایا (هر خط یک مورد)",
        help_text="یک مورد در هر خط؛ در صفحه جزئیات خدمت به‌صورت فهرست نمایش داده می‌شود.",
    )
    icon = models.CharField(max_length=40, default='sprout', verbose_name="آیکون")
    image = models.ImageField(upload_to='services/', blank=True, null=True, verbose_name="تصویر")
    price_note = models.CharField(max_length=160, blank=True, verbose_name="یادداشت هزینه")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="فعال")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")
    seo_title = models.CharField(max_length=70, blank=True, verbose_name="عنوان سئو")
    seo_description = models.CharField(max_length=170, blank=True, verbose_name="توضیح متا")

    class Meta:
        ordering = ('order', 'title')
        verbose_name = "خدمت"
        verbose_name_plural = "خدمات"

    def __str__(self):
        return self.title

    @property
    def image_url(self):
        return self.image.url if self.image else '/images/hero-farm.jpg'

    @property
    def highlight_list(self) -> list[str]:
        return [line.strip() for line in (self.highlights or '').splitlines() if line.strip()]


class SitePage(models.Model):
    """Admin-editable page: an info page (bank accounts, environment) or a
    product landing page (the vermicompost-style flagship page)."""

    KIND_PAGE = 'page'
    KIND_LANDING = 'landing'
    KIND_CHOICES = (
        (KIND_PAGE, 'صفحه اطلاعاتی'),
        (KIND_LANDING, 'لندینگ محصول'),
    )

    title = models.CharField(max_length=200, verbose_name="عنوان")
    slug = models.CharField(max_length=200, unique=True, verbose_name="اسلاگ")
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default=KIND_PAGE, db_index=True)
    hero_text = models.TextField(max_length=600, blank=True, verbose_name="متن هدر")
    hero_image = models.ImageField(upload_to='pages/heroes/', blank=True, null=True, verbose_name="تصویر هدر")
    badge = models.CharField(max_length=60, blank=True, verbose_name="برچسب")
    product = models.ForeignKey(
        Product, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='landing_pages', verbose_name="محصول مرتبط"
    )
    cta_label = models.CharField(max_length=60, blank=True, verbose_name="متن دکمه")
    cta_url = models.CharField(max_length=300, blank=True, verbose_name="لینک دکمه")
    published = models.BooleanField(default=False, db_index=True, verbose_name="منتشر شده")
    published_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    seo_title = models.CharField(max_length=70, blank=True, verbose_name="عنوان سئو")
    seo_description = models.CharField(max_length=170, blank=True, verbose_name="توضیح متا")
    history = HistoricalRecords()

    class Meta:
        ordering = ('title',)
        verbose_name = "صفحه سایت"
        verbose_name_plural = "صفحات سایت"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.published and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def hero_image_url(self):
        return self.hero_image.url if self.hero_image else ''

    def get_absolute_url(self):
        prefix = '/offer' if self.kind == self.KIND_LANDING else '/page'
        return f"{prefix}/{self.slug}"


class SitePageBlock(models.Model):
    """One ordered section of a SitePage, so a landing page can be rebuilt from
    the admin without a code change."""

    BLOCK_CHOICES = (
        ('heading', 'سرتیتر'),
        ('text', 'متن'),
        ('bullets', 'فهرست موردی'),
        ('image', 'تصویر'),
        ('spec_table', 'جدول مشخصات'),
        ('price_table', 'جدول قیمت'),
        ('video', 'ویدئو'),
        ('products', 'شبکه محصولات'),
        ('articles', 'شبکه مقالات'),
        ('cta', 'دکمه اقدام'),
        ('quote', 'نقل‌قول'),
        ('faq', 'پرسش و پاسخ'),
    )

    page = models.ForeignKey(SitePage, on_delete=models.CASCADE, related_name='blocks', verbose_name="صفحه")
    block_type = models.CharField(max_length=15, choices=BLOCK_CHOICES, default='text', verbose_name="نوع بلوک")
    title = models.CharField(max_length=200, blank=True, verbose_name="عنوان بلوک")
    text = models.TextField(
        blank=True,
        verbose_name="متن",
        help_text="در بلوک «فهرست موردی» هر خط یک مورد است؛ در بلوک متن، خط خالی پاراگراف را جدا می‌کند.",
    )
    rows = models.TextField(
        blank=True,
        verbose_name="ردیف‌های جدول",
        help_text="هر خط یک ردیف؛ ستون‌ها را با «|» جدا کنید. مثال: «گرید A | ۱۲۰,۰۰۰ تومان | هر کیلوگرم»",
    )
    image = models.ImageField(upload_to='pages/blocks/', blank=True, null=True, verbose_name="تصویر")
    video = models.FileField(upload_to='pages/video/', blank=True, null=True, verbose_name="فایل ویدئو")
    link = models.CharField(max_length=300, blank=True, verbose_name="لینک")
    data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="پارامترهای تکمیلی",
        help_text='مثال برای شبکه محصولات: {"category": "fertilizer", "limit": 8, "ordering": "-discount_percent"}',
    )
    position = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ('position', 'id')
        verbose_name = "بلوک صفحه"
        verbose_name_plural = "بلوک‌های صفحه"

    def __str__(self):
        return f'{self.page.title} — {self.get_block_type_display()}'

    @property
    def image_url(self):
        return self.image.url if self.image else ''

    @property
    def video_url(self):
        return self.video.url if self.video else ''

    @property
    def table_rows(self) -> list[list[str]]:
        """``rows`` split into cells; empty cells are tolerated."""
        table = []
        for line in (self.rows or '').splitlines():
            if not line.strip():
                continue
            table.append([cell.strip() for cell in line.split('|')])
        return table


class TeamMember(models.Model):
    """About-page team, shown with role and photo to build buyer trust."""

    name = models.CharField(max_length=120, verbose_name="نام")
    role = models.CharField(max_length=120, verbose_name="سمت")
    bio = models.TextField(max_length=600, blank=True, verbose_name="بیوگرافی")
    photo = models.ImageField(upload_to='team/', blank=True, null=True, verbose_name="تصویر")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="نمایش")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('order', 'name')
        verbose_name = "عضو تیم"
        verbose_name_plural = "تیم گرین کود"

    def __str__(self):
        return f'{self.name} — {self.role}'

    @property
    def photo_url(self):
        return self.photo.url if self.photo else ''


class BrandPartner(models.Model):
    """A brand or partner the site represents (logo wall on the about page)."""

    name = models.CharField(max_length=120, verbose_name="نام برند/شرکت")
    # The catalogue is matched to a represented brand by slug rather than by
    # string equality, so «ایکس گرین» and «XGREEN» in a supplier sheet can be
    # reconciled once, in the admin, instead of in code.
    slug = models.SlugField(max_length=140, unique=True, blank=True, verbose_name="اسلاگ")
    logo = models.ImageField(upload_to='brands/', blank=True, null=True, verbose_name="لوگو")
    website = models.URLField(max_length=300, blank=True, verbose_name="وب‌سایت")
    description = models.CharField(max_length=300, blank=True, verbose_name="توضیح کوتاه")
    since_year = models.PositiveSmallIntegerField(null=True, blank=True, verbose_name="از سال")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="نمایش")

    class Meta:
        ordering = ('order', 'name')
        verbose_name = "برند و شریک"
        verbose_name_plural = "برندها و شرکا"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            from ..slugs import unique_slug
            self.slug = unique_slug(self.__class__, self.name, fallback='brand')
        super().save(*args, **kwargs)

    @property
    def logo_url(self):
        return self.logo.url if self.logo else ''

    def get_absolute_url(self):
        return f'/brand/{self.slug}'

    def product_count(self) -> int:
        return Product.objects.filter(status='published', brand_slug=self.slug).count()


class SiteContact(models.Model):
    """Single, admin-editable source of the company's contact channels."""

    address = models.TextField(max_length=400, blank=True, verbose_name="نشانی مرکزی")
    provinces_note = models.CharField(max_length=300, blank=True, verbose_name="توضیح شعب/بسته")
    phones = models.TextField(blank=True, verbose_name="تلفن‌ها (هر خط یک شماره)")
    emails = models.TextField(blank=True, verbose_name="ایمیل‌ها (هر خط یک ایمیل)")
    working_hours = models.CharField(max_length=200, blank=True, verbose_name="ساعات کاری")
    whatsapp_number = models.CharField(max_length=20, blank=True, verbose_name="شماره واتساپ")
    telegram_url = models.CharField(max_length=300, blank=True, verbose_name="لینک تلگرام")
    instagram_url = models.CharField(max_length=300, blank=True, verbose_name="لینک اینستاگرام")
    eitaa_url = models.CharField(max_length=300, blank=True, verbose_name="لینک ایتا")
    map_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="عرض جغرافیایی")
    map_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="طول جغرافیایی")
    map_note = models.CharField(max_length=200, blank=True, verbose_name="راهنمای نشانی در نقشه")
    expert_name = models.CharField(max_length=120, blank=True, verbose_name="نام کارشناس مشاوره")
    expert_role = models.CharField(max_length=120, blank=True, verbose_name="سمت کارشناس")
    expert_photo = models.ImageField(upload_to='site/expert/', blank=True, null=True, verbose_name="تصویر کارشناس")
    expert_note = models.CharField(max_length=200, blank=True, verbose_name="یادداشت کارت مشاوره")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "اطلاعات تماس شرکت"
        verbose_name_plural = "اطلاعات تماس شرکت"

    def save(self, *args, **kwargs):
        # A singleton: always edit the same row instead of creating new ones.
        self.pk = 1
        super().save(*args, **kwargs)

    def __str__(self):
        return "اطلاعات تماس شرکت"

    @classmethod
    def load(cls) -> 'SiteContact':
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def phone_list(self) -> list[str]:
        return [line.strip() for line in (self.phones or '').splitlines() if line.strip()]

    @property
    def email_list(self) -> list[str]:
        return [line.strip() for line in (self.emails or '').splitlines() if line.strip()]

    @property
    def expert_photo_url(self):
        return self.expert_photo.url if self.expert_photo else ''


class NewsletterSubscriber(models.Model):
    """Opt-in mailing list for offers and new growing guides."""

    email = models.EmailField(blank=True, verbose_name="ایمیل")
    mobile = models.CharField(max_length=15, blank=True, verbose_name="موبایل")
    topics = models.CharField(max_length=200, blank=True, verbose_name="علایق")
    source = models.CharField(max_length=60, default='site-footer', verbose_name="منبع ثبت‌نام")
    is_active = models.BooleanField(default=True, db_index=True, verbose_name="عضو فعال")
    subscribed_at = models.DateTimeField(auto_now_add=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-subscribed_at',)
        verbose_name = "عضو خبرنامه"
        verbose_name_plural = "اعضای خبرنامه"
        constraints = [
            models.UniqueConstraint(
                fields=['email'],
                condition=Q(email__gt='') & Q(is_active=True),
                name='unique_active_newsletter_email',
            ),
            models.UniqueConstraint(
                fields=['mobile'],
                condition=Q(mobile__gt='') & Q(is_active=True),
                name='unique_active_newsletter_mobile',
            ),
        ]

    def __str__(self):
        return self.email or self.mobile

    def clean(self):
        super().clean()
        if not (self.email or self.mobile):
            raise ValidationError('برای عضویت در خبرنامه ایمیل یا موبایل لازم است.')


# ========================================
# Service desks: consultants, support, working hours, satisfaction
# ========================================

