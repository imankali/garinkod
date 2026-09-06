import uuid
from datetime import time, timedelta

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse
from django.conf import settings
from django.db.models import Q, Sum, F
from django.db.models.functions import Lower
from simple_history.models import HistoricalRecords

from .levels import (
    LEVEL_ADMIN,
    LEVEL_BUYER,
    LEVEL_CHOICES,
    LEVEL_DESK_AGENT,
    LEVEL_GUEST,
    LEVEL_MODERATOR,
    LEVEL_OWNER,
    LEVEL_SELLER,
    LEVEL_VERIFIED_BUYER,
    LEVEL_VERIFIED_SELLER,
    MAXIMUM_LEVEL,
    MINIMUM_LEVEL,
    STAFF_LEVELS,
    level_for,
    rank_for,
    label as level_label,
)
from .persian import fa_digits, platform_day_index


# --- Managers ---
class ProductManager(models.Manager):
    def published(self):
        return self.filter(status='published')

    def available(self):
        return self.filter(available=True, stock__gt=0)


# --- Category ---
class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name="نام دسته")
    slug = models.SlugField(unique=True, verbose_name="اسلاگ")
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    description = models.TextField(blank=True, max_length=1000, verbose_name="توضیح سئو")
    seo_title = models.CharField(max_length=70, blank=True, verbose_name="عنوان سئو")
    seo_description = models.CharField(max_length=170, blank=True, verbose_name="توضیح متا")
    history = HistoricalRecords()

    class Meta:
        verbose_name = "دسته"
        verbose_name_plural = "دسته‌ها"
        ordering = ['name']

    def __str__(self):
        return self.name

    def get_products(self):
        return Product.objects.filter(category=self, status='published')

    def get_product_count(self):
        return self.products.filter(status='published').count()


# --- SubCategory ---
class SubCategory(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='subcategories')
    name = models.CharField(max_length=100, verbose_name="نام زیردسته")
    slug = models.SlugField(unique=True)

    class Meta:
        verbose_name = "زیردسته"
        verbose_name_plural = "زیردسته‌ها"

    def __str__(self):
        return self.name


# --- Product ---
class Product(models.Model):
    STATUS_CHOICES = (
        ('draft', 'پیش‌نویس'),
        ('published', 'منتشر شده'),
    )

    title = models.CharField(max_length=250, verbose_name="عنوان")
    slug = models.SlugField(max_length=250, unique=True, verbose_name="اسلاگ")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products', verbose_name="دسته")
    subcategory = models.ForeignKey(SubCategory, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="زیردسته")
    description = models.TextField(verbose_name="توضیحات")
    publish = models.DateTimeField(default=timezone.now, verbose_name="تاریخ انتشار")
    created = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated = models.DateTimeField(auto_now=True, verbose_name="تاریخ بروزرسانی")
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='draft', verbose_name="وضعیت")
    price = models.IntegerField(verbose_name="قیمت")
    stock = models.PositiveIntegerField(default=0, verbose_name="موجودی")
    available = models.BooleanField(default=True, verbose_name="موجود")
    is_featured = models.BooleanField(default=False, verbose_name="ویژه")
    image = models.ImageField(upload_to='products/', blank=True, null=True, verbose_name="تصویر")
    discount_percent = models.PositiveSmallIntegerField(default=0, verbose_name="درصد تخفیف")
    sales_count = models.PositiveIntegerField(default=0, verbose_name="تعداد فروش")
    brand = models.CharField(max_length=120, blank=True, verbose_name="برند")
    # Free-form package size ("۲۵ کیلوگرم", "۱ تن") used by the shop's package
    # filter. Kept as text because suppliers publish it in many units.
    package_weight = models.CharField(max_length=40, blank=True, db_index=True, verbose_name="وزن بسته")
    # Catalogue parity with wholesale suppliers: bulk/quote-only lines carry no
    # price and the storefront shows "تماس بگیرید" instead of an add-to-cart.
    price_on_request = models.BooleanField(default=False, verbose_name="قیمت با تماس")

    sku = models.CharField(max_length=80, blank=True, db_index=True, verbose_name="شناسه کالا")
    gtin = models.CharField(max_length=14, blank=True, db_index=True, verbose_name="GTIN")
    seo_title = models.CharField(max_length=70, blank=True, verbose_name="عنوان سئو")
    seo_description = models.CharField(max_length=170, blank=True, verbose_name="توضیح متا")
    shipping_weight_grams = models.PositiveIntegerField(default=0, verbose_name="وزن ارسال (گرم)")
    shipping_length_cm = models.PositiveSmallIntegerField(default=0, verbose_name="طول بسته (سانتی‌متر)")
    shipping_width_cm = models.PositiveSmallIntegerField(default=0, verbose_name="عرض بسته (سانتی‌متر)")
    shipping_height_cm = models.PositiveSmallIntegerField(default=0, verbose_name="ارتفاع بسته (سانتی‌متر)")

    # Bulk sales of an agricultural input are decided on facts a supplier states
    # per batch: how long the bag has left, the smallest amount we are willing to
    # open a bag for, and whether a small order is filled bulk from a bigger one.
    # These lived inside the description text, where nothing could filter,
    # validate or badge them.
    production_date = models.DateField(null=True, blank=True, verbose_name="تاریخ تولید")
    expiry_date = models.DateField(null=True, blank=True, verbose_name="تاریخ انقضا")
    min_order_quantity = models.PositiveIntegerField(default=1, verbose_name="حداقل سفارش")
    bulk_note = models.TextField(max_length=500, blank=True, verbose_name="توضیح فروش فله")
    video_url = models.URLField(max_length=300, blank=True, verbose_name="ویدئوی معرفی")
    tags = models.ManyToManyField('Tag', blank=True, related_name='products', verbose_name="برچسب‌ها")
    # «پربازدیدترین» needs a column incremented in a single UPDATE, not a value
    # derived per request.
    views = models.PositiveIntegerField(default=0, db_index=True, verbose_name="بازدید")
    # Brand pages are addressable (/brand/<slug>), so the slug a product was filed
    # under has to be a column; deriving it per request from free text would make
    # the brand list and the brand page disagree as soon as a supplier renames one.
    brand_slug = models.SlugField(max_length=140, blank=True, db_index=True, verbose_name="اسلاگ برند")

    objects = ProductManager()
    history = HistoricalRecords()

    class Meta:
        ordering = ('-publish',)
        verbose_name = "محصول"
        verbose_name_plural = "محصولات"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        from .slugs import slugify_fa
        self.brand_slug = slugify_fa(self.brand)
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse('shop:product_detail', args=[self.slug])

    @property
    def brand_url(self) -> str:
        """Address of this product's brand page, when the brand is declared."""
        return f"/brand/{self.brand_slug}" if self.brand_slug else ''

    @property
    def image_url(self):
        if self.image:
            return self.image.url
        return '/images/hero-farm.jpg'

    @property
    def is_in_stock(self):
        return self.stock > 0 and self.available

    @property
    def discounted_price(self) -> int:
        """The price after the site-wide discount, rounded down to تومان."""
        if self.discount_percent and self.discount_percent > 0:
            return max(int(self.price * (100 - self.discount_percent) / 100), 0)
        return self.price



    @property
    def expiry_days_left(self) -> int | None:
        """Days before the earliest declared expiry, product-level or per package.

        An absent date is unknown, not expired, so nothing is claimed here.
        """
        dates = [self.expiry_date] if self.expiry_date else []
        dates += [pkg.expiry_date for pkg in self.packages.all() if pkg.expiry_date]
        if not dates:
            return None
        return (min(dates) - timezone.localdate()).days

    @property
    def is_expiring_soon(self) -> bool:
        """True when a declared batch is inside the 90-day warning window."""
        left = self.expiry_days_left
        return left is not None and left <= 90

    @property
    def gallery(self) -> list:
        """Cover first, then the admin gallery, without repeating the cover."""
        shots = [{'url': self.image_url, 'caption': ''}]
        seen = {self.image.name} if self.image else set()
        for item in self.images.all():
            if item.image and item.image.name not in seen:
                seen.add(item.image.name)
                shots.append({'url': item.image.url, 'caption': item.caption})
        return shots

    @property
    def default_package(self):
        """The package a cart row should be created with, if any is declared."""
        packages = list(self.packages.all())
        if not packages:
            return None
        for package in packages:
            if package.is_default:
                return package
        return packages[0]


class Tag(models.Model):
    """A cross-category label («کود محلول‌پاشی»، «مصرف خاکی»).

    A category answers "what is it", a tag answers "how is it used", so the
    catalogue stays navigable along the axis a farmer actually thinks in. The slug
    is derived from the Persian name with the site's own transliterating helper.
    """

    name = models.CharField(max_length=80, unique=True, verbose_name="نام برچسب")
    slug = models.SlugField(max_length=90, unique=True, verbose_name="اسلاگ")
    description = models.TextField(max_length=1000, blank=True, verbose_name="توضیح")
    image = models.ImageField(upload_to='tags/', blank=True, null=True, verbose_name="تصویر")
    seo_title = models.CharField(max_length=70, blank=True, verbose_name="عنوان سئو")
    seo_description = models.CharField(max_length=170, blank=True, verbose_name="توضیح متا")
    history = HistoricalRecords()

    class Meta:
        ordering = ('name',)
        verbose_name = "برچسب"
        verbose_name_plural = "برچسب‌ها"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            from .slugs import unique_slug
            self.slug = unique_slug(self.__class__, self.name, fallback='tag')
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        # A literal path rather than a named route: the frontend owns these
        # addresses and Django only renders the shell.
        return f'/tag/{self.slug}'


class ProductImage(models.Model):
    """One extra photo in a product's gallery."""

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='images', verbose_name="محصول"
    )
    image = models.ImageField(upload_to='products/gallery/', verbose_name="تصویر")
    caption = models.CharField(max_length=200, blank=True, verbose_name="زیرنویس")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ('order', 'id')
        verbose_name = "تصویر محصول"
        verbose_name_plural = "تصاویر محصول"

    def __str__(self):
        return f"تصویر محصول {self.product_id}"


class ProductPackage(models.Model):
    """A purchasable packaging of a product, with its own price and stock.

    «۱ کیلویی فله» and «کیسه ۲۵ کیلویی» are the same input at two unit
    economics; a single price on the product forces either a wrong number or a
    description that lies. When a product has no package rows at all the
    storefront falls back to the product's own price and stock, so nothing here is
    mandatory and the existing catalogue keeps working untouched.
    """

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name='packages', verbose_name="محصول"
    )
    label = models.CharField(max_length=120, verbose_name="نوع بسته‌بندی")
    weight_kg = models.DecimalField(
        max_digits=10, decimal_places=3, null=True, blank=True, verbose_name="وزن (کیلوگرم)"
    )
    # A null price/stock means "follow the product", which is what a shop that
    # only sells one bag should not have to duplicate.
    price = models.PositiveBigIntegerField(null=True, blank=True, verbose_name="قیمت (خالی = قیمت محصول)")
    stock = models.PositiveIntegerField(null=True, blank=True, verbose_name="موجودی (خالی = موجودی محصول)")
    min_order_quantity = models.PositiveIntegerField(default=1, verbose_name="حداقل سفارش")
    bulk_note = models.TextField(max_length=500, blank=True, verbose_name="توضیح فروش فله")
    production_date = models.DateField(null=True, blank=True, verbose_name="تاریخ تولید")
    expiry_date = models.DateField(null=True, blank=True, verbose_name="تاریخ انقضا")
    is_default = models.BooleanField(default=False, verbose_name="پیش‌فرض")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ('order', 'id')
        verbose_name = "بسته‌بندی محصول"
        verbose_name_plural = "بسته‌بندی‌های محصول"
        constraints = [
            models.UniqueConstraint(fields=['product', 'label'], name='unique_product_package_label'),
        ]

    def __str__(self):
        return f"{self.product.title} — {self.label}"

    @property
    def effective_price(self) -> int:
        return self.price if self.price is not None else self.product.price

    @property
    def discounted_price(self) -> int:
        percent = self.product.discount_percent or 0
        price = self.effective_price
        return max(int(price * (100 - percent) / 100), 0) if percent else price

    @property
    def effective_stock(self) -> int:
        return self.stock if self.stock is not None else self.product.stock

    @property
    def is_in_stock(self) -> bool:
        return self.product.available and self.effective_stock > 0

    @property
    def expiry_days_left(self) -> int | None:
        if not self.expiry_date:
            return self.product.expiry_days_left
        return (self.expiry_date - timezone.localdate()).days

    @property
    def price_per_kg(self) -> int | None:
        """Unit price, when both the weight and a price are known.

        Comparing «۱,۷۵۰,۰۰۰ تومان برای ۵ لیتر» against «۲۹۰,۰۰۰ برای ۵۰ کیلو»
        by eye is how a bulk buyer overpays; the number that matters is per unit.
        """
        if self.weight_kg and self.effective_price and self.weight_kg > 0:
            return int(self.effective_price / float(self.weight_kg))
        return None


# --- مشخصات اختصاصی برای هر دسته ---
# ✅ اصلاح: حذف abstract class و تعریف مستقیم OneToOneField در هر کلاس

class FertilizerDetail(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='fertilizer_detail', verbose_name="محصول")
    fertilizer_type = models.CharField(max_length=100, verbose_name="نوع کود")
    nitrogen = models.CharField(max_length=20, verbose_name="نیتروژن (%)")
    phosphorus = models.CharField(max_length=20, verbose_name="فسفر (%)")
    potassium = models.CharField(max_length=20, verbose_name="پتاسیم (%)")

    class Meta:
        verbose_name = "مشخصات کود"
        verbose_name_plural = "مشخصات کود"

    def __str__(self):
        return f"مشخصات کود: {self.product.title}"


class PesticideDetail(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='pesticide_detail', verbose_name="محصول")
    pesticide_type = models.CharField(max_length=100, verbose_name="نوع سم")
    active_ingredient = models.CharField(max_length=100, verbose_name="مواد فعال")
    concentration = models.CharField(max_length=20, verbose_name="غلظت (%)")

    class Meta:
        verbose_name = "مشخصات سم"
        verbose_name_plural = "مشخصات سم"

    def __str__(self):
        return f"مشخصات سم: {self.product.title}"


class SeedDetail(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='seed_detail', verbose_name="محصول")
    crop_type = models.CharField(max_length=100, verbose_name="نوع گیاه")
    variety = models.CharField(max_length=100, verbose_name="رقم")
    weight = models.CharField(max_length=20, verbose_name="وزن")

    class Meta:
        verbose_name = "مشخصات بذر"
        verbose_name_plural = "مشخصات بذر"

    def __str__(self):
        return f"مشخصات بذر: {self.product.title}"


class EquipmentDetail(models.Model):
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name='equipment_detail', verbose_name="محصول")
    tool_type = models.CharField(max_length=100, verbose_name="نوع ابزار")
    material = models.CharField(max_length=100, verbose_name="جنس")
    weight = models.CharField(max_length=20, verbose_name="وزن")

    class Meta:
        verbose_name = "مشخصات ابزار"
        verbose_name_plural = "مشخصات ابزار"

    def __str__(self):
        return f"مشخصات ابزار: {self.product.title}"


# --- User Account ---
class UserAccount(models.Model):
    GENDER_CHOICES = (
        ('male', 'آقا'),
        ('female', 'خانم'),
    )

    # Access levels: the eight-step ladder in ``shop/levels.py``. The level is
    # authoritative for coarse-grained access (the console, the storefront
    # tools, whether someone may open a ticket at all); Django groups still
    # express the fine-grained "which model may I change" permissions on top of
    # it. Labels and choices live in one place so a gate and the screen that
    # explains it cannot drift apart.
    LEVEL_GUEST = LEVEL_GUEST
    LEVEL_BUYER = LEVEL_BUYER
    LEVEL_VERIFIED_BUYER = LEVEL_VERIFIED_BUYER
    LEVEL_SELLER = LEVEL_SELLER
    LEVEL_VERIFIED_SELLER = LEVEL_VERIFIED_SELLER
    LEVEL_DESK_AGENT = LEVEL_DESK_AGENT
    LEVEL_MODERATOR = LEVEL_MODERATOR
    LEVEL_ADMIN = LEVEL_ADMIN
    LEVEL_OWNER = LEVEL_OWNER
    LEVEL_CHOICES = LEVEL_CHOICES
    STAFF_LEVELS = STAFF_LEVELS
    MINIMUM_LEVEL = MINIMUM_LEVEL
    MAXIMUM_LEVEL = MAXIMUM_LEVEL

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='account')
    phone = models.CharField(max_length=11, db_index=True, verbose_name="شماره تلفن")
    phone_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="زمان تأیید شماره تلفن",
    )
    gender = models.CharField(max_length=15, choices=GENDER_CHOICES, default='male', verbose_name="جنسیت")
    address = models.TextField(max_length=250, blank=True, null=True, verbose_name="آدرس")
    avatar = models.ImageField(upload_to='avatars/%Y/%m/', blank=True, null=True, verbose_name="تصویر پروفایل")
    level = models.PositiveSmallIntegerField(
        choices=LEVEL_CHOICES,
        default=LEVEL_BUYER,
        db_index=True,
        verbose_name="سطح دسترسی",
    )
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "حساب کاربری"
        verbose_name_plural = "حساب‌های کاربری"
        constraints = [
            models.UniqueConstraint(
                fields=['phone'],
                condition=~Q(phone=''),
                name='unique_nonempty_useraccount_phone',
            ),
        ]

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if self.pk and (update_fields is None or 'phone' in update_fields):
            previous_phone = type(self).objects.filter(pk=self.pk).values_list('phone', flat=True).first()
            verification_is_explicit = update_fields is not None and 'phone_verified_at' in update_fields
            if previous_phone != self.phone and not verification_is_explicit:
                self.phone_verified_at = None
                if update_fields is not None:
                    kwargs['update_fields'] = set(update_fields) | {'phone_verified_at'}
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username}"

    @property
    def avatar_url(self):
        return self.avatar.url if self.avatar else ''

    @property
    def is_staff_level(self) -> bool:
        return self.level in self.STAFF_LEVELS

    @property
    def level_label(self) -> str:
        return level_label(self.level)

    @property
    def rank(self):
        """The ladder row for this account, or None for an unknown value."""
        return rank_for(self.level)

    @property
    def verified_phone(self) -> bool:
        return self.phone_verified_at is not None

    def promote_to(self, level: int, *, save: bool = True) -> 'UserAccount':
        """Raise the level, never silently lowering an existing one."""
        if level > self.level:
            self.level = level
            if save:
                self.save(update_fields=['level', 'updated'])
        return self


def account_level(user) -> int:
    """Resolve a user's level without assuming the profile row exists.

    A thin alias for :func:`shop.levels.level_for`, kept because most of the
    codebase already speaks this name.
    """
    return level_for(user)


# --- Comment ---
class Comment(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100, verbose_name="نام")
    email = models.EmailField(blank=True, null=True, verbose_name="ایمیل")
    body = models.TextField(verbose_name="متن")
    image = models.ImageField(upload_to='comments/%Y/%m/', blank=True, null=True, verbose_name="تصویر")
    sticker = models.CharField(max_length=16, blank=True, verbose_name="استیکر")
    # A 1..5 star score. Optional: a question or a seller answer is still a
    # comment, it just does not rate the product, so it must not join the
    # average. Reviews are the aggregate shown on cards and in Product schema.org.
    rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        verbose_name="امتیاز (۱ تا ۵)",
    )
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    # «مفید بود» lets buyers rank each other's experience; keeping the tally as a
    # column means a review list can be ordered by it in one query.
    helpful_count = models.PositiveIntegerField(default=0, verbose_name="رأی مفید بودن")
    is_reported = models.BooleanField(default=False, verbose_name="گزارش‌شده")
    # A «تجربه خرید مشتریان» page has to be curated: an editor picks which real
    # reviews represent the shop, instead of the newest three at random.
    is_featured = models.BooleanField(default=False, db_index=True, verbose_name="نمایش در تجربه خرید مشتریان")
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=False, verbose_name="فعال")

    class Meta:
        ordering = ('created',)
        verbose_name = "نظر"
        verbose_name_plural = "نظرات"
        indexes = [
            models.Index(fields=['product', 'active'], name='comment_product_active_idx'),
        ]

    def __str__(self):
        return f"کامنت توسط {self.name} روی {self.product}"

    @property
    def is_reply(self):
        return self.parent is not None

    @property
    def is_review(self):
        """Top-level feedback carrying a score, i.e. a counted review."""
        return self.parent_id is None and self.rating is not None

    @property
    def replies_count(self):
        return self.replies.count()


# --- Structured product specifications ---
class ProductAttribute(models.Model):
    """One row of the "ویژگی‌ها" table on a product page.

    Suppliers publish long spec sheets (variety, packaging, germination
    temperature, harvest days, per-hectare rate ...). Modelling them as ordered
    label/value pairs keeps the catalogue usable for any category without
    adding a column per attribute.
    """

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='attributes', verbose_name="محصول")
    label = models.CharField(max_length=80, verbose_name="عنوان ویژگی")
    # Blank on purpose: the admin action seeds the eighteen standard labels and
    # the manager fills the values in over time. Rows without a value are not
    # rendered on the product page.
    value = models.CharField(max_length=300, blank=True, verbose_name="مقدار")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ('order', 'id')
        verbose_name = "ویژگی محصول"
        verbose_name_plural = "ویژگی‌های محصول"

    def __str__(self):
        return f"{self.label}: {self.value}"


class ListingAttribute(models.Model):
    """The same spec table for a storefront listing (optional for sellers)."""

    listing = models.ForeignKey(
        'MarketplaceListing', on_delete=models.CASCADE, related_name='attributes', verbose_name="آگهی"
    )
    label = models.CharField(max_length=80, verbose_name="عنوان ویژگی")
    # Optional like the catalogue's rows, so a seller can save the skeleton and
    # complete the values later; empty rows are never rendered.
    value = models.CharField(max_length=300, blank=True, verbose_name="مقدار")
    order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ('order', 'id')
        verbose_name = "ویژگی آگهی"
        verbose_name_plural = "ویژگی‌های آگهی"
        constraints = [
            models.UniqueConstraint(fields=['listing', 'label', 'order'], name='unique_listing_attribute_row'),
        ]

    def __str__(self):
        return f"{self.label}: {self.value}"


# The eighteen rows the flagship suppliers publish for every variety. Seeded by
# the admin action below so a manager only has to fill in values.
PRODUCT_ATTRIBUTE_TEMPLATE = (
    'نوع رقم',
    'محتوای بسته',
    'نوع بسته‌بندی',
    'کشور سازنده',
    'تاریخ تولید',
    'تاریخ انقضا',
    'شماره بچ',
    'مناسب کشت در',
    'نوع کشت',
    'فصل کشت',
    'عمق کاشت',
    'فاصله کاشت',
    'دمای مناسب جوانه‌زنی',
    'روز تا گلدهی',
    'روز تا برداشت',
    'مصرف در هکتار',
    'نیاز آبی',
    'شرایط نگهداری',
)


# --- Shopping Cart ---
class Cart(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='carts'
    )
    session_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "سبد خرید"
        verbose_name_plural = "سبدهای خرید"

    def __str__(self):
        if self.user:
            return f"سبد {self.user.username}"
        return f"سبد مهمان ({self.session_id})"

    @property
    def total_price(self):
        # Items may reference either a catalogue product or a marketplace
        # listing, so the sum is computed per row rather than in one aggregate.
        return sum(item.total_price for item in self.items.all())

    @property
    def total_items(self):
        result = self.items.aggregate(
            total=Sum('quantity')
        )
        return result['total'] or 0

    @property
    def is_empty(self):
        return self.items.count() == 0


class CartItem(models.Model):
    """A cart row holding either a catalogue product or a storefront listing.

    Exactly one of `product` / `listing` is set. The pair of partial unique
    constraints keeps "one row per product" and "one row per listing" without
    a NULL column defeating a plain unique_together.
    """

    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.CASCADE)
    # Which packaging was picked, so «کیسه ۲۵ کیلویی» and «۱ کیلویی فله» are two
    # rows with two prices instead of one row with a guess.
    product_package = models.ForeignKey(
        'ProductPackage', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='cart_items', verbose_name="بسته‌بندی"
    )
    listing = models.ForeignKey(
        'MarketplaceListing', null=True, blank=True, on_delete=models.CASCADE, related_name='cart_items'
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "آیتم سبد"
        verbose_name_plural = "آیتم‌های سبد"
        constraints = [
            # Two constraints rather than one three-column one: NULL never
            # collides inside a partial unique index, so a row without a chosen
            # packaging needs its own guard to keep «one row per product».
            models.UniqueConstraint(
                fields=['cart', 'product'],
                condition=models.Q(product__isnull=False, product_package__isnull=True),
                name='unique_cart_product_without_package',
            ),
            models.UniqueConstraint(
                fields=['cart', 'product', 'product_package'],
                condition=models.Q(product_package__isnull=False),
                name='unique_cart_product_package',
            ),
            models.UniqueConstraint(
                fields=['cart', 'listing'],
                condition=models.Q(listing__isnull=False),
                name='unique_cart_listing',
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(product__isnull=False, listing__isnull=True) |
                    models.Q(product__isnull=True, listing__isnull=False)
                ),
                name='cart_item_exactly_one_target',
            ),
        ]

    def __str__(self):
        return f"{self.quantity} × {self.title}"

    @property
    def kind(self) -> str:
        return 'listing' if self.listing_id else 'product'

    @property
    def title(self) -> str:
        return self.listing.title if self.listing_id else self.product.title

    @property
    def package(self):
        """The chosen packaging, if the product declares any."""
        return self.product_package

    @property
    def package_label(self) -> str:
        return self.product_package.label if self.product_package_id else ''

    @property
    def unit_price(self) -> int:
        if self.listing_id:
            return int(self.listing.price or 0)
        if self.product_package_id:
            return int(self.product_package.effective_price or 0)
        return int(self.product.price or 0)

    @property
    def total_price(self):
        return self.quantity * self.unit_price

    @property
    def shipping_weight_grams(self) -> int:
        """Weight of one row, taken from the packaging when it declares one."""
        if self.product_package_id and self.product_package.weight_kg:
            return int(float(self.product_package.weight_kg) * 1000)
        return self.product.shipping_weight_grams if self.product_id else 0

    @property
    def available_quantity(self) -> int:
        if self.listing_id:
            return int(self.listing.quantity_available)
        if self.product_package_id:
            return min(int(self.product_package.effective_stock), int(self.product.stock))
        return int(self.product.stock)

    @property
    def is_in_stock(self):
        if self.listing_id:
            return self.listing.is_purchasable and self.quantity <= int(self.listing.quantity_available)
        if self.product_package_id:
            package = self.product_package
            return (
                package.is_in_stock
                and self.quantity <= package.effective_stock
                and self.quantity <= self.product.stock
            )
        return self.product.is_in_stock and self.quantity <= self.product.stock


# --- Orders ---
def create_reference(prefix: str) -> str:
    """Create a short human-readable reference for support and guests."""
    import secrets

    return f"{prefix}-{timezone.now():%y%m%d}-{secrets.token_hex(4).upper()}"


def create_order_code() -> str:
    return create_reference('GK')


def create_service_code() -> str:
    return create_reference('SV')


def create_procurement_code() -> str:
    return create_reference('PR')


class Order(models.Model):
    STATUS_CHOICES = (
        ('awaiting_review', 'در انتظار بررسی'),
        ('confirmed', 'تأیید شده'),
        ('preparing', 'در حال آماده‌سازی'),
        ('shipped', 'ارسال شده'),
        ('delivered', 'تحویل شده'),
        ('cancelled', 'لغو شده'),
    )
    PAYMENT_STATUS_CHOICES = (
        ('unpaid', 'پرداخت نشده'),
        ('pending', 'در انتظار پرداخت'),
        ('paid', 'پرداخت شده'),
        ('refunded', 'بازگشت وجه'),
    )
    PAYMENT_METHOD_CHOICES = (
        ('coordination', 'هماهنگی با کارشناس'),
        ('zarinpal', 'زرین‌پال'),
        ('stripe_card', 'کارت بین‌المللی از طریق Stripe'),
        ('paypal', 'PayPal'),
        ('crypto', 'پرداخت رمزارزی'),
    )

    code = models.CharField(max_length=32, unique=True, db_index=True, default=create_order_code)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='orders')
    customer_name = models.CharField(max_length=150, verbose_name='نام تحویل‌گیرنده')
    phone = models.CharField(max_length=20, db_index=True, verbose_name='شماره تماس')
    email = models.EmailField(blank=True, verbose_name='ایمیل')
    province = models.CharField(max_length=80, verbose_name='استان')
    city = models.CharField(max_length=80, verbose_name='شهر')
    address = models.TextField(max_length=500, verbose_name='نشانی')
    postal_code = models.CharField(max_length=20, blank=True, verbose_name='کد پستی')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    notes = models.TextField(max_length=1000, blank=True, verbose_name='توضیحات مشتری')
    subtotal = models.PositiveBigIntegerField(default=0)
    discount_amount = models.PositiveBigIntegerField(default=0)
    coupon_code = models.CharField(max_length=40, blank=True, db_index=True)
    shipping_price = models.PositiveBigIntegerField(default=0)
    shipping_provider = models.CharField(max_length=30, default='flat')
    shipping_service = models.CharField(max_length=80, default='standard')
    total_price = models.PositiveBigIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='awaiting_review', db_index=True)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid', db_index=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='coordination')
    affiliate_code = models.CharField(max_length=32, blank=True, db_index=True)
    # Which legal text this order was placed under, and when it was accepted.
    # ``terms_accepted`` in the request only proves that a checkbox arrived; the
    # version says *which* promises the buyer saw, so a dispute two years later
    # can be read against the text of that day rather than today's.
    terms_accepted_at = models.DateTimeField(null=True, blank=True, verbose_name='زمان پذیرش شرایط')
    legal_version = models.CharField(max_length=40, blank=True, verbose_name='نسخه متن حقوقی')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'سفارش'
        verbose_name_plural = 'سفارش‌ها'

    def __str__(self):
        return f"{self.code} — {self.customer_name}"

    @property
    def total_items(self):
        return self.items.aggregate(total=Sum('quantity'))['total'] or 0

    def cancel_and_restore_stock(self):
        """Cancel an unpaid order once and atomically restore its reservation."""
        from django.db import transaction

        with transaction.atomic():
            order = Order.objects.select_for_update().get(pk=self.pk)
            if order.status == 'cancelled':
                return order
            if order.payment_status == 'paid':
                raise ValueError('Paid orders require a refund workflow before cancellation.')
            if order.payment_attempts.filter(status__in=['created', 'pending', 'processing']).exists():
                raise ValueError('درخواست پرداخت فعال است؛ ابتدا نتیجه درگاه مشخص شود.')
            if order.status not in {'awaiting_review', 'confirmed'}:
                raise ValueError('This order can no longer be self-cancelled.')

            items = list(order.items.select_related('product', 'listing').all())
            product_ids = [item.product_id for item in items if item.product_id]
            products = {
                product.id: product
                for product in Product.objects.select_for_update().filter(id__in=product_ids)
            }
            for item in items:
                product = products.get(item.product_id)
                if product:
                    product.stock += item.quantity
                    product.available = True
                    product.save(update_fields=['stock', 'available', 'updated'])

            # Storefront listings reserve their own quantity, so release it and
            # unwind any pending seller earnings for the same order.
            from .settlements import restore_listing_quantities, reverse_marketplace_sale

            restore_listing_quantities(order)
            reverse_marketplace_sale(order, reason=f'لغو سفارش {order.code}')

            order.status = 'cancelled'
            order.save(update_fields=['status', 'updated_at'])
            if order.coupon_code:
                coupon = Coupon.objects.select_for_update().filter(code=order.coupon_code).first()
                if coupon and coupon.usage_count > 0:
                    coupon.usage_count -= 1
                    coupon.save(update_fields=['usage_count', 'updated_at'])
            AffiliateConversion.objects.filter(order=order, status='pending').update(status='rejected')
            FinancialLedgerEntry.objects.filter(order=order, status='pending').update(status='reversed')
            return order


class OrderItem(models.Model):
    """A purchased line.

    Product/listing/storefront/seller are all SET_NULL references so history is
    never destroyed by a later deletion, while the denormalised title, slug and
    storefront name keep the invoice readable regardless.
    """

    KIND_CHOICES = (
        ('product', 'محصول فروشگاه'),
        ('listing', 'آگهی غرفه'),
    )

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.SET_NULL, related_name='order_items')
    listing = models.ForeignKey(
        'MarketplaceListing', null=True, blank=True, on_delete=models.SET_NULL, related_name='order_items'
    )
    storefront = models.ForeignKey(
        'Storefront', null=True, blank=True, on_delete=models.SET_NULL, related_name='order_items'
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='sold_items'
    )
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='product', db_index=True)
    product_title = models.CharField(max_length=250)
    product_slug = models.SlugField(max_length=250)
    # The packaging is copied onto the row, because a package can later be
    # relabelled or retired while the invoice must keep saying what was sold.
    package_label = models.CharField(max_length=120, blank=True, verbose_name="بسته‌بندی فروخته‌شده")
    storefront_name = models.CharField(max_length=150, blank=True, verbose_name='نام غرفه')
    storefront_slug = models.SlugField(max_length=180, blank=True)
    unit = models.CharField(max_length=30, blank=True)
    unit_price = models.PositiveBigIntegerField()
    quantity = models.PositiveIntegerField()
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    commission_amount = models.PositiveBigIntegerField(default=0)

    class Meta:
        verbose_name = 'آیتم سفارش'
        verbose_name_plural = 'آیتم‌های سفارش'

    def __str__(self):
        return f"{self.quantity} × {self.product_title}"

    @property
    def total_price(self):
        return self.unit_price * self.quantity

    @property
    def seller_net_amount(self) -> int:
        """What the storefront owner earns once the platform fee is taken."""
        return max(self.total_price - self.commission_amount, 0)


class Shipment(models.Model):
    """A persisted fulfilment record independent of any one carrier API."""

    PROVIDER_CHOICES = (
        ('manual', 'ثبت دستی'),
        ('postex', 'پستکس'),
        ('tipax', 'تیپاکس'),
        ('chapar', 'چاپار'),
    )
    STATUS_CHOICES = (
        ('pending', 'در انتظار آماده‌سازی'),
        ('ready', 'آماده تحویل به حامل'),
        ('picked_up', 'تحویل به حامل'),
        ('in_transit', 'در مسیر'),
        ('out_for_delivery', 'در حال توزیع'),
        ('delivered', 'تحویل‌شده'),
        ('exception', 'نیازمند پیگیری'),
        ('returned', 'مرجوع‌شده'),
        ('cancelled', 'لغوشده'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='shipments')
    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES, default='manual')
    service_name = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending', db_index=True)
    tracking_code = models.CharField(max_length=120, blank=True, db_index=True)
    tracking_url = models.URLField(blank=True)
    external_id = models.CharField(max_length=160, blank=True, db_index=True)
    shipping_cost = models.PositiveBigIntegerField(default=0, help_text='مبلغ به تومان')
    provider_payload = models.JSONField(default=dict, blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    last_event_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'مرسوله'
        verbose_name_plural = 'مرسوله‌ها'
        constraints = [
            models.UniqueConstraint(
                fields=['provider', 'external_id'],
                condition=~Q(external_id=''),
                name='unique_shipment_provider_external_id',
            ),
        ]

    def __str__(self):
        return f'{self.order.code} — {self.get_provider_display()} — {self.get_status_display()}'


class ShipmentTrackingEvent(models.Model):
    """Append-only normalized carrier or manually entered tracking update."""

    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='events')
    provider_event_id = models.CharField(max_length=160, blank=True)
    status = models.CharField(max_length=30, choices=Shipment.STATUS_CHOICES)
    description = models.CharField(max_length=500)
    location = models.CharField(max_length=160, blank=True)
    occurred_at = models.DateTimeField(db_index=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-occurred_at', '-id')
        verbose_name = 'رویداد رهگیری'
        verbose_name_plural = 'رویدادهای رهگیری'
        constraints = [
            models.UniqueConstraint(
                fields=['shipment', 'provider_event_id'],
                condition=~Q(provider_event_id=''),
                name='unique_tracking_provider_event',
            ),
        ]

    def __str__(self):
        return f'{self.shipment_id} — {self.get_status_display()}'


# --- Agricultural service and procurement leads ---
class ServiceRequest(models.Model):
    SERVICE_CHOICES = (
        ('agronomy', 'مشاوره زراعی'),
        ('irrigation', 'طراحی و نصب آبیاری'),
        ('soil', 'آزمایش و بهبود خاک'),
        ('greenhouse', 'گلخانه و کشت کنترل‌شده'),
        ('machinery', 'ماشین‌آلات و تعمیرات'),
        ('other', 'سایر خدمات'),
    )
    STATUS_CHOICES = (
        ('new', 'جدید'),
        ('contacted', 'تماس گرفته شد'),
        ('quoted', 'پیشنهاد ارسال شد'),
        ('closed', 'بسته شده'),
    )

    code = models.CharField(max_length=32, unique=True, db_index=True, default=create_service_code)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='service_requests')
    service_type = models.CharField(max_length=20, choices=SERVICE_CHOICES)
    customer_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    province = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    crop = models.CharField(max_length=120, blank=True)
    farm_area_hectare = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    description = models.TextField(max_length=1500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'درخواست خدمت'
        verbose_name_plural = 'درخواست‌های خدمت'

    def __str__(self):
        return f"{self.code} — {self.get_service_type_display()}"


class ProcurementRequest(models.Model):
    STATUS_CHOICES = (
        ('new', 'جدید'),
        ('reviewing', 'در حال ارزیابی'),
        ('offered', 'پیشنهاد ارسال شد'),
        ('contracted', 'قرارداد شده'),
        ('closed', 'بسته شده'),
    )

    code = models.CharField(max_length=32, unique=True, db_index=True, default=create_procurement_code)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='procurement_requests')
    farmer_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    crop_name = models.CharField(max_length=150)
    variety = models.CharField(max_length=150, blank=True)
    quantity = models.DecimalField(max_digits=14, decimal_places=2)
    unit = models.CharField(max_length=30, default='کیلوگرم')
    requested_price = models.PositiveBigIntegerField(null=True, blank=True)
    province = models.CharField(max_length=80)
    city = models.CharField(max_length=80)
    harvest_date = models.DateField(null=True, blank=True)
    description = models.TextField(max_length=1500, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'درخواست خرید محصول کشاورز'
        verbose_name_plural = 'درخواست‌های خرید محصول کشاورز'

    def __str__(self):
        return f"{self.code} — {self.crop_name}"


# --- Marketplace storefront foundation ---
class Storefront(models.Model):
    SELLER_TYPE_CHOICES = (
        ('farmer', 'کشاورز'),
        ('cooperative', 'تعاونی'),
        ('merchant', 'تاجر'),
        ('company', 'شرکت'),
    )

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='storefront')
    name = models.CharField(max_length=150)
    # Case-insensitive uniqueness is enforced by a functional constraint below so
    # two sellers cannot register visually identical storefront names.
    slug = models.SlugField(max_length=180, unique=True)
    seller_type = models.CharField(max_length=20, choices=SELLER_TYPE_CHOICES, default='farmer')
    bio = models.TextField(max_length=1000, blank=True)
    avatar = models.ImageField(upload_to='storefronts/%Y/%m/', blank=True, null=True, verbose_name='تصویر غرفه')
    cover = models.ImageField(upload_to='storefronts/covers/%Y/%m/', blank=True, null=True, verbose_name='کاور غرفه')
    province = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    location = models.ForeignKey(
        'Location', null=True, blank=True, on_delete=models.SET_NULL, related_name='storefronts'
    )
    is_verified = models.BooleanField(default=False, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=8)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    sales_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'غرفه'
        verbose_name_plural = 'غرفه‌ها'
        constraints = [
            models.UniqueConstraint(
                Lower('name'), name='unique_storefront_name_ci'
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def avatar_url(self):
        return self.avatar.url if self.avatar else ''

    @property
    def cover_url(self):
        return self.cover.url if self.cover else ''

    @property
    def followers_count(self) -> int:
        return self.followers.count()

    @property
    def published_listing_count(self) -> int:
        return self.listings.filter(status='published').count()


class StorefrontFollow(models.Model):
    """A buyer following a storefront, used for the feed and follower counts."""

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='followers')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='followed_storefronts')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'دنبال‌کننده غرفه'
        verbose_name_plural = 'دنبال‌کنندگان غرفه'
        constraints = [
            models.UniqueConstraint(fields=['storefront', 'user'], name='unique_storefront_follow'),
        ]

    def __str__(self):
        return f'{self.user} → {self.storefront}'


class StorefrontHighlight(models.Model):
    """A named, ordered collection of stories kept beyond their expiry."""

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='highlights')
    title = models.CharField(max_length=60)
    cover = models.ImageField(upload_to='storefront-highlights/%Y/%m/', blank=True, null=True)
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('position', 'created_at')
        verbose_name = 'هایلایت غرفه'
        verbose_name_plural = 'هایلایت‌های غرفه'

    def __str__(self):
        return f'{self.storefront.name} — {self.title}'

    @property
    def cover_url(self):
        if self.cover:
            return self.cover.url
        first = self.items.select_related('post').first()
        return first.post.image_url if first else '/images/hero-farm.jpg'


class StorefrontHighlightItem(models.Model):
    highlight = models.ForeignKey(StorefrontHighlight, on_delete=models.CASCADE, related_name='items')
    post = models.ForeignKey('StorefrontPost', on_delete=models.CASCADE, related_name='highlight_items')
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ('position', 'id')
        constraints = [
            models.UniqueConstraint(fields=['highlight', 'post'], name='unique_highlight_post'),
        ]

    def __str__(self):
        return f'{self.highlight.title} #{self.position}'


class MarketplaceListing(models.Model):
    STATUS_CHOICES = (
        ('draft', 'پیش‌نویس'),
        ('pending_review', 'در انتظار تأیید'),
        ('published', 'منتشر شده'),
        ('rejected', 'رد شده'),
        ('sold_out', 'اتمام موجودی'),
        ('archived', 'بایگانی'),
    )

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='listings')
    title = models.CharField(max_length=250)
    slug = models.SlugField(max_length=280, unique=True)
    crop_name = models.CharField(max_length=150)
    description = models.TextField(max_length=3000)
    price = models.PositiveBigIntegerField()
    unit = models.CharField(max_length=30, default='کیلوگرم')
    quantity_available = models.DecimalField(max_digits=14, decimal_places=2)
    min_order_quantity = models.DecimalField(max_digits=14, decimal_places=2, default=1)
    harvest_date = models.DateField(null=True, blank=True)
    image = models.ImageField(upload_to='marketplace/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    discount_percent = models.PositiveSmallIntegerField(default=0, verbose_name='درصد تخفیف')
    sales_count = models.PositiveIntegerField(default=0, verbose_name='تعداد فروش')
    rejection_reason = models.TextField(max_length=1000, blank=True, verbose_name='دلیل رد آگهی')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviewed_listings'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'آگهی بازار کشاورزان'
        verbose_name_plural = 'آگهی‌های بازار کشاورزان'
        indexes = [
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return self.title

    @property
    def image_url(self):
        return self.image.url if self.image else '/images/hero-farm.jpg'

    @property
    def is_purchasable(self) -> bool:
        return self.status == 'published' and self.quantity_available > 0

    @property
    def discounted_price(self) -> int:
        """The price after the storefront's discount, rounded down."""
        if self.discount_percent and self.discount_percent > 0:
            return max(int(self.price * (100 - self.discount_percent) / 100), 0)
        return self.price

    @property
    def minimum_order(self) -> int:
        """The listing's minimum order, never below one whole unit."""
        return max(int(self.min_order_quantity or 1), 1)

    def commission_for(self, amount: int) -> int:
        rate = self.storefront.commission_rate or 0
        return int(amount * rate / 100)


# --- Payments, finance and growth ---
class PaymentAttempt(models.Model):
    PROVIDER_CHOICES = (
        ('coordination', 'هماهنگی با کارشناس'),
        ('zarinpal', 'زرین‌پال'),
        ('stripe_card', 'کارت بین‌المللی از طریق Stripe'),
        ('paypal', 'PayPal'),
        ('crypto', 'پرداخت رمزارزی'),
    )
    STATUS_CHOICES = (
        ('created', 'ایجاد شده'),
        ('pending', 'در انتظار پرداخت'),
        ('processing', 'در حال پردازش'),
        ('paid', 'پرداخت موفق'),
        ('failed', 'ناموفق'),
        ('cancelled', 'لغو شده'),
        ('expired', 'منقضی شده'),
        ('refunded', 'بازگشت وجه'),
    )

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payment_attempts')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='created', db_index=True)
    amount = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=8, default='IRT')
    idempotency_key = models.CharField(max_length=64, unique=True)
    external_reference = models.CharField(max_length=255, blank=True, db_index=True)
    checkout_url = models.URLField(blank=True)
    provider_payload = models.JSONField(default=dict, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'تلاش پرداخت'
        verbose_name_plural = 'تلاش‌های پرداخت'
        constraints = [
            models.UniqueConstraint(
                fields=['order', 'provider'],
                condition=Q(status__in=['created', 'pending', 'processing']),
                name='unique_active_payment_attempt',
            ),
        ]

    def __str__(self):
        return f"{self.order.code} — {self.provider} — {self.status}"


class AffiliateProfile(models.Model):
    STATUS_CHOICES = (
        ('pending', 'در انتظار بررسی'),
        ('active', 'فعال'),
        ('suspended', 'معلق'),
    )

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='affiliate_profile')
    code = models.CharField(max_length=32, unique=True, db_index=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=5)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    payout_details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'همکار فروش'
        verbose_name_plural = 'همکاران فروش'

    def __str__(self):
        return f"{self.code} — {self.user.username}"


class AffiliateConversion(models.Model):
    STATUS_CHOICES = (
        ('pending', 'در انتظار تأیید پرداخت'),
        ('approved', 'تأیید شده'),
        ('rejected', 'رد شده'),
        ('paid_out', 'تسویه شده'),
    )

    affiliate = models.ForeignKey(AffiliateProfile, on_delete=models.PROTECT, related_name='conversions')
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='affiliate_conversion')
    commission_amount = models.PositiveBigIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'تبدیل همکار فروش'
        verbose_name_plural = 'تبدیل‌های همکار فروش'

    def __str__(self):
        return f"{self.affiliate.code} — {self.order.code}"


class FinancialLedgerEntry(models.Model):
    OWNER_TYPE_CHOICES = (
        ('platform', 'پلتفرم'),
        ('seller', 'فروشنده'),
        ('advisor', 'مشاور'),
        ('affiliate', 'همکار فروش'),
    )
    ENTRY_TYPE_CHOICES = (
        ('sale', 'فروش'),
        ('commission', 'کمیسیون'),
        ('consultation', 'مشاوره'),
        ('affiliate_commission', 'کمیسیون همکاری در فروش'),
        ('payout', 'تسویه'),
        ('refund', 'بازگشت وجه'),
        ('adjustment', 'اصلاحیه'),
    )
    STATUS_CHOICES = (
        ('pending', 'در انتظار'),
        ('available', 'قابل تسویه'),
        ('held', 'مسدود برای رسیدگی'),
        ('paid', 'تسویه شده'),
        ('reversed', 'برگشت خورده'),
    )

    owner_type = models.CharField(max_length=20, choices=OWNER_TYPE_CHOICES)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='financial_entries')
    storefront = models.ForeignKey(Storefront, null=True, blank=True, on_delete=models.SET_NULL, related_name='financial_entries')
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.SET_NULL, related_name='ledger_entries')
    affiliate_conversion = models.ForeignKey(AffiliateConversion, null=True, blank=True, on_delete=models.SET_NULL, related_name='ledger_entries')
    entry_type = models.CharField(max_length=30, choices=ENTRY_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    amount = models.BigIntegerField(help_text='Positive for credit, negative for debit.')
    currency = models.CharField(max_length=8, default='IRT')
    description = models.CharField(max_length=500)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    available_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'رکورد دفتر مالی'
        verbose_name_plural = 'دفتر مالی'

    def __str__(self):
        return f"{self.owner_type} {self.amount} {self.currency}"


# --- Trust, feedback and visual-search queue ---
class PlatformFeedback(models.Model):
    KIND_CHOICES = (
        ('suggestion', 'پیشنهاد'),
        ('criticism', 'انتقاد'),
        ('consultation', 'درخواست راهنمایی'),
        ('other', 'سایر'),
    )
    STATUS_CHOICES = (
        ('new', 'جدید'),
        ('reviewing', 'در حال بررسی'),
        ('resolved', 'رسیدگی شد'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='feedback_items')
    name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    subject = models.CharField(max_length=200)
    message = models.TextField(max_length=3000)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'بازخورد پلتفرم'
        verbose_name_plural = 'بازخوردهای پلتفرم'

    def __str__(self):
        return f"{self.get_kind_display()} — {self.subject}"


class StorefrontComplaint(models.Model):
    STATUS_CHOICES = (
        ('new', 'جدید'),
        ('reviewing', 'در حال بررسی'),
        ('awaiting_response', 'در انتظار پاسخ فروشنده'),
        ('resolved', 'حل شده'),
        ('rejected', 'رد شده'),
    )

    complainant = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='submitted_complaints')
    storefront = models.ForeignKey(Storefront, on_delete=models.PROTECT, related_name='complaints')
    listing = models.ForeignKey(MarketplaceListing, null=True, blank=True, on_delete=models.SET_NULL, related_name='complaints')
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.SET_NULL, related_name='storefront_complaints')
    subject = models.CharField(max_length=200)
    description = models.TextField(max_length=4000)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='new', db_index=True)
    resolution_note = models.TextField(max_length=2000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'شکایت از غرفه'
        verbose_name_plural = 'شکایت‌های غرفه'

    def __str__(self):
        return f"{self.storefront.name} — {self.subject}"


class VisualSearchRequest(models.Model):
    TARGET_CHOICES = (
        ('product', 'جستجوی محصول'),
        ('pest', 'تشخیص آفت/بیماری'),
    )
    STATUS_CHOICES = (
        ('pending', 'در انتظار تحلیل'),
        ('processing', 'در حال تحلیل'),
        ('completed', 'تکمیل شده'),
        ('no_match', 'بدون نتیجه'),
        ('rejected', 'رد شده'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='visual_searches')
    image = models.ImageField(upload_to='visual-search/%Y/%m/')
    target = models.CharField(max_length=20, choices=TARGET_CHOICES, default='product')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    result_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'درخواست جستجوی تصویری'
        verbose_name_plural = 'درخواست‌های جستجوی تصویری'

    def __str__(self):
        return f"{self.get_target_display()} — {self.status}"

# --- Promotions, wallet and storefront publishing ---
class Coupon(models.Model):
    DISCOUNT_TYPE_CHOICES = (
        ('percentage', 'درصدی'),
        ('fixed', 'مبلغ ثابت'),
    )

    code = models.CharField(max_length=40, unique=True, db_index=True)
    description = models.CharField(max_length=255)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default='percentage')
    discount_value = models.PositiveBigIntegerField()
    max_discount_amount = models.PositiveBigIntegerField(null=True, blank=True)
    min_order_amount = models.PositiveBigIntegerField(default=0)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    usage_count = models.PositiveIntegerField(default=0)
    issued_to_user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='issued_coupons')
    issued_to_phone = models.CharField(max_length=20, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    valid_from = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'کد تخفیف'
        verbose_name_plural = 'کدهای تخفیف'

    def __str__(self):
        return self.code

    def calculate_discount(self, subtotal: int, *, phone: str = '', user=None) -> int:
        now = timezone.now()
        if not self.is_active or now < self.valid_from or (self.valid_until and now > self.valid_until):
            raise ValueError('این کد تخفیف فعال نیست یا منقضی شده است.')
        if self.usage_limit is not None and self.usage_count >= self.usage_limit:
            raise ValueError('ظرفیت استفاده از این کد تخفیف تمام شده است.')
        if self.issued_to_user_id and (not user or self.issued_to_user_id != user.id):
            raise ValueError('این کد برای حساب کاربری دیگری صادر شده است.')
        if self.issued_to_phone and self.issued_to_phone != phone:
            raise ValueError('این کد برای شماره تماس دیگری صادر شده است.')
        if subtotal < self.min_order_amount:
            raise ValueError('مبلغ سفارش به حداقل لازم برای این کد تخفیف نرسیده است.')
        if self.discount_type == 'percentage':
            discount = int(subtotal * self.discount_value / 100)
            if self.max_discount_amount is not None:
                discount = min(discount, self.max_discount_amount)
            return discount
        return min(subtotal, self.discount_value)


class Wallet(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wallet')
    currency = models.CharField(max_length=8, default='IRT')
    balance = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'کیف پول'
        verbose_name_plural = 'کیف پول‌ها'

    def __str__(self):
        return f'{self.user.username} — {self.balance} {self.currency}'


class WalletTransaction(models.Model):
    TYPE_CHOICES = (
        ('loyalty_reward', 'پاداش وفاداری'),
        ('order_discount', 'تخفیف سفارش'),
        ('refund', 'بازگشت وجه'),
        ('affiliate_payout', 'تسویه همکاری در فروش'),
        ('seller_payout', 'تسویه فروشنده'),
        ('adjustment', 'اصلاحیه'),
    )
    STATUS_CHOICES = (
        ('pending', 'در انتظار'),
        ('available', 'قابل استفاده'),
        ('spent', 'مصرف شده'),
        ('reversed', 'برگشت خورده'),
    )

    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='transactions')
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.SET_NULL, related_name='wallet_transactions')
    amount = models.BigIntegerField(help_text='Positive credits and negative debits.')
    transaction_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    description = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    available_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'تراکنش کیف پول'
        verbose_name_plural = 'تراکنش‌های کیف پول'

    def __str__(self):
        return f'{self.wallet.user.username} {self.amount}'


class StorefrontPost(models.Model):
    POST_TYPE_CHOICES = (
        ('post', 'پست'),
        ('story', 'استوری'),
    )
    STATUS_CHOICES = (
        ('draft', 'پیش‌نویس'),
        ('pending_review', 'در انتظار بررسی'),
        ('published', 'منتشر شده'),
        ('rejected', 'رد شده'),
        ('archived', 'بایگانی'),
    )

    storefront = models.ForeignKey(Storefront, on_delete=models.CASCADE, related_name='posts')
    listing = models.ForeignKey(MarketplaceListing, null=True, blank=True, on_delete=models.SET_NULL, related_name='posts')
    post_type = models.CharField(max_length=12, choices=POST_TYPE_CHOICES, default='post')
    caption = models.TextField(max_length=2200)
    image = models.ImageField(upload_to='storefront-posts/%Y/%m/', blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'پست غرفه'
        verbose_name_plural = 'پست‌ها و استوری‌های غرفه'

    def __str__(self):
        return f'{self.storefront.name} — {self.get_post_type_display()}'

    @property
    def image_url(self):
        return self.image.url if self.image else '/images/hero-farm.jpg'


class StorefrontPostLike(models.Model):
    """One "like" on a storefront post.

    A row per (post, user) with a unique constraint is what makes the like
    idempotent: tapping twice cannot inflate the count, and the current user's
    own state is a cheap existence check rather than a stored flag that could
    drift from the tally.
    """

    post = models.ForeignKey(StorefrontPost, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='liked_storefront_posts'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'پسند پست غرفه'
        verbose_name_plural = 'پسندهای پست غرفه'
        constraints = [
            models.UniqueConstraint(fields=['post', 'user'], name='unique_storefront_post_like'),
        ]

    def __str__(self):
        return f'{self.user} ♥ {self.post_id}'


class StorefrontPostComment(models.Model):
    """A comment on a storefront post, optionally replying to another comment.

    Replies are one level deep by design: `parent` is normalised to the root
    comment in `save()`, so a thread stays a flat list of answers under a top
    comment instead of an unbounded nesting chain no phone screen can show.
    """

    post = models.ForeignKey(StorefrontPost, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='storefront_post_comments'
    )
    parent = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies'
    )
    body = models.TextField(max_length=1000)
    is_hidden = models.BooleanField(default=False, db_index=True, verbose_name='پنهان شده')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('created_at',)
        verbose_name = 'نظر پست غرفه'
        verbose_name_plural = 'نظرات پست غرفه'
        indexes = [models.Index(fields=['post', 'created_at'])]

    def save(self, *args, **kwargs):
        # Flatten deeper nesting: a reply to a reply belongs to the same root.
        if self.parent is not None and self.parent.parent_id is not None:
            self.parent = self.parent.parent
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user}: {self.body[:40]}'


class StorefrontStoryView(models.Model):
    """Records that a viewer has seen a story.

    This is what drives the Instagram-style ring: unseen stories get the
    coloured ring, seen ones the grey one. Keeping it server-side (rather than
    in localStorage) means the state follows the user across devices.
    """

    post = models.ForeignKey(StorefrontPost, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='seen_stories'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'بازدید استوری'
        verbose_name_plural = 'بازدیدهای استوری'
        constraints = [
            models.UniqueConstraint(fields=['post', 'user'], name='unique_story_view'),
        ]

    def __str__(self):
        return f'{self.user} 👁 {self.post_id}'


class StorefrontConversation(models.Model):
    """One thread in the unified inbox.

    Originally this was only "buyer ↔ storefront", and it still is for the
    ``storefront`` channel. It now also carries the other places the platform
    talks to a user — support, agricultural consulting and comment replies —
    because a person wants *one* inbox, not four places to check for a reply.

    ``channel`` is what the UI labels each thread with ("پشتیبانی", "غرفه",
    …) so the reader can always tell where a message came from. ``storefront``
    is therefore nullable: only storefront threads have one.
    """

    CHANNEL_STOREFRONT = 'storefront'
    CHANNEL_SUPPORT = 'support'
    CHANNEL_CONSULTING = 'consulting'
    CHANNEL_COMMENT = 'comment'

    CHANNEL_CHOICES = (
        (CHANNEL_STOREFRONT, 'غرفه'),
        (CHANNEL_SUPPORT, 'پشتیبانی'),
        (CHANNEL_CONSULTING, 'پشتیبانی کشاورزان'),
        (CHANNEL_COMMENT, 'پاسخ به دیدگاه'),
    )

    channel = models.CharField(
        max_length=20, choices=CHANNEL_CHOICES, default=CHANNEL_STOREFRONT, db_index=True,
        verbose_name='کانال',
    )
    storefront = models.ForeignKey(
        Storefront, null=True, blank=True, on_delete=models.CASCADE, related_name='conversations'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='storefront_conversations'
    )
    # Staff side of a support/consulting thread. Left null while unassigned so
    # any authorised operator can pick the thread up.
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='handled_conversations', verbose_name='کارشناس',
    )
    subject = models.CharField(max_length=150, blank=True, verbose_name='موضوع')
    # A thread can be ended by either side. It stays writable — closing is not
    # an archive, it is the signal that starts the satisfaction survey, and a
    # farmer who remembers one more question must be able to ask it.
    STATUS_OPEN = 'open'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = (
        (STATUS_OPEN, 'باز'),
        (STATUS_CLOSED, 'بسته شده'),
    )
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True,
        verbose_name='وضعیت گفتگو',
    )
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name='بسته شد در')
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='closed_conversations', verbose_name='بسته شده توسط',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'گفتگو'
        verbose_name_plural = 'گفتگوها'
        constraints = [
            # Still exactly one storefront thread per (storefront, customer).
            # Scoped to the storefront channel so the other channels — which
            # have no storefront — are not all collapsed into a single row.
            models.UniqueConstraint(
                fields=['storefront', 'customer'],
                condition=Q(channel='storefront'),
                name='unique_storefront_customer_conversation',
            ),
            models.UniqueConstraint(
                fields=['customer', 'channel'],
                condition=Q(channel__in=['support', 'consulting']),
                name='unique_customer_service_conversation',
            ),
            models.CheckConstraint(
                condition=Q(channel='storefront', storefront__isnull=False)
                | (~Q(channel='storefront') & Q(storefront__isnull=True)),
                name='storefront_channel_requires_storefront',
            ),
        ]

    def __str__(self):
        counterpart = self.storefront.name if self.storefront else self.get_channel_display()
        return f'{counterpart} ↔ {self.customer.username}'

    @property
    def channel_label(self) -> str:
        return self.get_channel_display()

    def is_participant(self, user) -> bool:
        """Whether `user` may read and write in this thread.

        Storefront threads are private to the two parties. Support and
        consulting threads are additionally open to staff, which is what lets
        any operator answer without a hand-off step.
        """
        if not user or not user.is_authenticated:
            return False
        if user.id == self.customer_id:
            return True
        if self.storefront_id and user.id == self.storefront.user_id:
            return True
        if self.channel in {self.CHANNEL_SUPPORT, self.CHANNEL_COMMENT}:
            return bool(user.is_superuser or user.has_perm('shop.view_platformfeedback'))
        if self.channel == self.CHANNEL_CONSULTING:
            return bool(user.is_superuser or user.has_perm('shop.view_farmconsultationrequest'))
        return False

    def unread_count_for(self, user) -> int:
        """Messages the given participant has not read yet.

        Notices the platform wrote for the desk side (an out-of-hours line after
        a farmer's message, for instance) are not counted against the farmer:
        they were not addressed to them.
        """
        if not user.is_authenticated:
            return 0
        return self.messages.filter(is_read=False, is_notice=False).exclude(sender=user).count()

    def last_message(self):
        return self.messages.order_by('-created_at').first()

    @property
    def is_closed(self) -> bool:
        return self.status == self.STATUS_CLOSED

    def close(self, *, by=None):
        """End the thread. Idempotent, so two operators tapping «اتمام» cannot fight."""
        if self.status == self.STATUS_CLOSED:
            return self
        self.status = self.STATUS_CLOSED
        self.closed_at = timezone.now()
        self.closed_by = by
        self.save(update_fields=['status', 'closed_at', 'closed_by', 'updated_at'])
        return self

    def reopen(self, *, by=None):
        if self.status == self.STATUS_OPEN:
            return self
        self.status = self.STATUS_OPEN
        self.closed_at = None
        self.closed_by = by
        self.save(update_fields=['status', 'closed_at', 'closed_by', 'updated_at'])
        return self

    def is_open_now(self, moment=None) -> bool:
        """Whether the desk behind this thread answers right now.

        A storefront negotiation or a comment reply is between two people, not a
        staffed queue, so it counts as open: the working hours belong to the two
        service desks only.
        """
        if self.channel not in {self.CHANNEL_SUPPORT, self.CHANNEL_CONSULTING}:
            return True
        return DeskSettings.load().is_open_at(self.channel, moment)

    def latest_agent_message(self):
        """The staff member who answered last, if any.

        The thread has one ``agent`` for assignment, but a queue is shared: when
        a second operator replies, the reader must see *that* person's name and
        photo in the header instead of the original assignee.
        """
        return (
            self.messages.exclude(sender=None)
            .exclude(sender_id=self.customer_id)
            .order_by('-created_at')
            .select_related('sender', 'sender__account')
            .first()
        )


def message_attachment_path(instance, filename):
    """Group attachments by kind and month so the media tree stays navigable."""
    return f'messages/{instance.attachment_type or "file"}/%Y/%m/{filename}'.replace(
        '%Y/%m', timezone.now().strftime('%Y/%m')
    )


class StorefrontMessage(models.Model):
    """One message in a conversation.

    ``listing`` attaches a marketplace product the buyer is asking about, so
    the owner sees exactly which offering the question refers to.

    ``attachment`` carries a voice note, photo or short video. The kind is
    stored explicitly rather than sniffed from the extension at render time,
    so the client always knows which player to mount.
    """

    ATTACHMENT_IMAGE = 'image'
    ATTACHMENT_VIDEO = 'video'
    ATTACHMENT_AUDIO = 'audio'
    ATTACHMENT_CHOICES = (
        (ATTACHMENT_IMAGE, 'تصویر'),
        (ATTACHMENT_VIDEO, 'ویدیو'),
        (ATTACHMENT_AUDIO, 'صدا'),
    )

    conversation = models.ForeignKey(
        StorefrontConversation, on_delete=models.CASCADE, related_name='messages'
    )
    # Nullable because the desk also writes its own notices («گفتگو بسته شد»،
    # «خارج از ساعت کاری»); those have no author, and pretending the farmer sent
    # them would put words in the wrong mouth.
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='sent_storefront_messages',
    )
    body = models.TextField(max_length=2000, blank=True)
    listing = models.ForeignKey(
        MarketplaceListing, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='direct_messages',
    )
    # A farmer sharing their land case file with a consultant: the real record,
    # not a screenshot, so the consultant reads the soil and calendar data that
    # the identification form holds.
    land = models.ForeignKey(
        'FarmLand', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='shared_in_messages', verbose_name='پرونده زمین',
    )
    # A deep link rendered as a button inside the bubble — «مشاهده پست» after a
    # comment reply, or «گفتگو با مشاور» when support hands a question over.
    link_kind = models.CharField(max_length=20, blank=True, verbose_name='نوع لینک')
    link_label = models.CharField(max_length=120, blank=True, verbose_name='متن لینک')
    link_url = models.CharField(max_length=300, blank=True, verbose_name='آدرس لینک')
    # A line the desk wrote for its own bookkeeping («گفتگو بسته شد», «خارج از
    # ساعت کاری»). It is shown, but it is not an unread message: a badge that
    # counts platform notices is a badge the user learns to ignore.
    is_notice = models.BooleanField(default=False, verbose_name='اعلان سیستمی')
    attachment = models.FileField(
        upload_to=message_attachment_path, blank=True, null=True, verbose_name='پیوست'
    )
    attachment_type = models.CharField(
        max_length=10, choices=ATTACHMENT_CHOICES, blank=True, verbose_name='نوع پیوست'
    )
    # Voice notes render a waveform of known length instead of a player that
    # only reveals its duration after the file has downloaded.
    attachment_duration = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='مدت (ثانیه)'
    )
    # Quoted reply, like Telegram/WhatsApp: the message this one answers. It
    # is SET_NULL so deleting the original never takes the reply with it.
    reply_to = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='replies', verbose_name='پاسخ به',
    )
    # Editing keeps the row and stamps it, so the other party can see that the
    # text changed after they may have read it.
    edited_at = models.DateTimeField(null=True, blank=True, verbose_name='ویرایش در')
    # Deletion is a soft delete: the bubble stays in place as "پیام حذف شد" so
    # replies that quote it still make sense, and the body/attachment go away.
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name='حذف در')
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('created_at',)
        verbose_name = 'پیام'
        verbose_name_plural = 'پیام‌ها'
        indexes = [
            models.Index(fields=['conversation', '-created_at']),
        ]

    def __str__(self):
        author = getattr(self.sender, 'username', None)
        if author is None:
            return f'«اعلان»: {self.body[:40]}'
        return f'{author}: {self.body[:40]}'

    @property
    def attachment_url(self) -> str:
        return self.attachment.url if self.attachment else ''

    @property
    def is_system(self) -> bool:
        """A notice written by the platform itself."""
        return self.sender_id is None

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def is_edited(self) -> bool:
        return self.edited_at is not None

    def soft_delete(self):
        """Blank the content but keep the row so quoted replies stay coherent."""
        if self.attachment:
            self.attachment.delete(save=False)
        self.body = ''
        self.listing = None
        self.land = None
        self.link_kind = ''
        self.link_label = ''
        self.link_url = ''
        self.attachment = None
        self.attachment_type = ''
        self.attachment_duration = None
        self.deleted_at = timezone.now()
        self.save(update_fields=[
            'body', 'listing', 'land', 'link_kind', 'link_label', 'link_url',
            'attachment', 'attachment_type',
            'attachment_duration', 'deleted_at',
        ])


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
class Location(models.Model):
    """Provinces and their cities in one self-referencing table.

    A province row has `parent = None`; a city row points at its province. This
    keeps a single endpoint, a single foreign key target and lets the tree grow
    (districts, villages) without another migration.
    """

    KIND_CHOICES = (
        ('province', 'استان'),
        ('city', 'شهر'),
    )

    name = models.CharField(max_length=80, db_index=True)
    slug = models.SlugField(max_length=100)
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, db_index=True)
    parent = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.CASCADE, related_name='children'
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ('kind', 'name')
        verbose_name = 'موقعیت جغرافیایی'
        verbose_name_plural = 'موقعیت‌های جغرافیایی'
        constraints = [
            models.UniqueConstraint(fields=['parent', 'name'], name='unique_location_name_per_parent'),
        ]
        indexes = [
            models.Index(fields=['kind', 'name']),
        ]

    def __str__(self):
        if self.parent_id:
            return f'{self.parent.name} / {self.name}'
        return self.name

    @property
    def province_name(self) -> str:
        return self.parent.name if self.parent_id else self.name


# --- Management audit trail ---
class AdminAuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='management_actions')
    action = models.CharField(max_length=120, db_index=True)
    target_type = models.CharField(max_length=100)
    target_id = models.CharField(max_length=64)
    summary = models.CharField(max_length=500)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'لاگ مدیریتی'
        verbose_name_plural = 'لاگ‌های مدیریتی'

    def __str__(self):
        return f'{self.action} — {self.target_type}:{self.target_id}'


# --- External messaging and mobile OTP ---
class OneTimePassword(models.Model):
    """A single mobile-login challenge.

    Only Django's salted password hash is persisted; the raw code exists in
    memory just long enough to call the selected provider.
    """

    PURPOSE_LOGIN = 'login'
    PURPOSE_CHOICES = ((PURPOSE_LOGIN, 'ورود'),)
    STATUS_PENDING = 'pending'
    STATUS_VERIFIED = 'verified'
    STATUS_EXPIRED = 'expired'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'در انتظار تأیید'),
        (STATUS_VERIFIED, 'تأیید شده'),
        (STATUS_EXPIRED, 'منقضی شده'),
        (STATUS_FAILED, 'ناموفق/مسدود'),
    )

    request_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    phone = models.CharField(max_length=11, db_index=True, verbose_name='شماره موبایل')
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default=PURPOSE_LOGIN)
    code_hash = models.CharField(max_length=128, editable=False)
    delivery_channel = models.CharField(max_length=20, blank=True)
    provider_message_id = models.CharField(max_length=200, blank=True)
    last_error = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    requested_ip = models.GenericIPAddressField(null=True, blank=True)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'کد یک‌بارمصرف'
        verbose_name_plural = 'کدهای یک‌بارمصرف'
        indexes = [
            models.Index(fields=['phone', 'status', '-created_at'], name='otp_phone_status_idx'),
        ]

    def __str__(self):
        return f'{self.phone} — {self.get_status_display()}'


class NotificationTemplate(models.Model):
    """Editable, non-secret copy for one event/audience/channel route."""

    EVENT_ORDER_CREATED = 'order_created'
    EVENT_ORDER_STATUS_CHANGED = 'order_status_changed'
    EVENT_TEST = 'test'
    EVENT_CHOICES = (
        (EVENT_ORDER_CREATED, 'سفارش جدید'),
        (EVENT_ORDER_STATUS_CHANGED, 'تغییر وضعیت سفارش'),
        (EVENT_TEST, 'ارسال آزمایشی'),
    )
    AUDIENCE_OWNER = 'owner'
    AUDIENCE_CUSTOMER = 'customer'
    AUDIENCE_SELLER = 'seller'
    AUDIENCE_CHOICES = (
        (AUDIENCE_OWNER, 'مالک/مدیر'),
        (AUDIENCE_CUSTOMER, 'مشتری'),
        (AUDIENCE_SELLER, 'غرفه‌دار'),
    )
    CHANNEL_SMS = 'sms'
    CHANNEL_BALE = 'bale'
    CHANNEL_TELEGRAM = 'telegram'
    CHANNEL_WHATSAPP = 'whatsapp'
    CHANNEL_WEBPUSH = 'webpush'
    CHANNEL_CHOICES = (
        (CHANNEL_SMS, 'پیامک'),
        (CHANNEL_BALE, 'بله'),
        (CHANNEL_TELEGRAM, 'تلگرام'),
        (CHANNEL_WHATSAPP, 'واتساپ رسمی'),
        (CHANNEL_WEBPUSH, 'اعلان مرورگر'),
    )

    name = models.CharField(max_length=120, verbose_name='نام داخلی')
    event = models.CharField(max_length=40, choices=EVENT_CHOICES, db_index=True)
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    body = models.TextField(
        verbose_name='متن قالب',
        help_text='متغیرها با آکولاد نوشته می‌شوند؛ نمونه: {order_code} و {total_price}.',
    )
    provider_template_name = models.CharField(
        max_length=160,
        blank=True,
        help_text='نام قالب تأییدشده ارائه‌دهنده، مخصوصاً برای WhatsApp Cloud API.',
    )
    language_code = models.CharField(max_length=16, default='fa')
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    history = HistoricalRecords()

    class Meta:
        ordering = ('event', 'audience', 'channel')
        verbose_name = 'قالب پیام‌رسانی'
        verbose_name_plural = 'قالب‌های پیام‌رسانی'
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'audience', 'channel'],
                name='unique_notification_template_route',
            ),
        ]

    def __str__(self):
        return f'{self.get_event_display()} / {self.get_audience_display()} / {self.get_channel_display()}'


class WebPushSubscription(models.Model):
    """One browser push endpoint explicitly opted in by an authenticated user."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='webpush_subscriptions'
    )
    endpoint = models.URLField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    failure_count = models.PositiveSmallIntegerField(default=0)
    last_used_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-updated_at',)
        verbose_name = 'اشتراک اعلان مرورگر'
        verbose_name_plural = 'اشتراک‌های اعلان مرورگر'

    def __str__(self):
        return f'{self.user.username} — {str(self.id)[:8]}'

    @property
    def subscription_info(self) -> dict:
        return {
            'endpoint': self.endpoint,
            'keys': {'p256dh': self.p256dh, 'auth': self.auth},
        }


class NotificationRecipient(models.Model):
    """A fixed administrative destination; API credentials remain in env."""

    name = models.CharField(max_length=120)
    channel = models.CharField(max_length=20, choices=NotificationTemplate.CHANNEL_CHOICES)
    destination = models.CharField(
        max_length=200,
        help_text='شناسه چت برای تلگرام/بله یا شماره E.164 برای پیامک/واتساپ.',
    )
    receive_order_created = models.BooleanField(default=True)
    receive_order_status_changed = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('name',)
        verbose_name = 'گیرنده پیام مدیریتی'
        verbose_name_plural = 'گیرندگان پیام مدیریتی'
        constraints = [
            models.UniqueConstraint(
                fields=['channel', 'destination'],
                name='unique_notification_recipient',
            ),
        ]

    def clean(self):
        super().clean()
        from .phone_numbers import normalize_iranian_mobile

        if self.channel in {'sms', 'whatsapp'}:
            try:
                self.destination = normalize_iranian_mobile(self.destination)
            except ValueError as exc:
                raise ValidationError({'destination': str(exc)}) from exc
        elif self.channel == 'bale' and self.destination.startswith('phone:'):
            try:
                phone = normalize_iranian_mobile(self.destination.removeprefix('phone:'))
            except ValueError as exc:
                raise ValidationError({'destination': str(exc)}) from exc
            self.destination = f'phone:{phone}'

    def __str__(self):
        return f'{self.name} — {self.get_channel_display()}'


class NotificationDelivery(models.Model):
    """Durable transactional outbox row and its complete delivery history."""

    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_RETRY = 'retry'
    STATUS_SENT = 'sent'
    STATUS_DELIVERED = 'delivered'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = (
        (STATUS_PENDING, 'در صف'),
        (STATUS_PROCESSING, 'در حال ارسال'),
        (STATUS_RETRY, 'منتظر تلاش مجدد'),
        (STATUS_SENT, 'ارسال شده'),
        (STATUS_DELIVERED, 'تحویل شده'),
        (STATUS_FAILED, 'ناموفق نهایی'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='notification_deliveries',
    )
    template = models.ForeignKey(
        NotificationTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='deliveries',
    )
    event = models.CharField(max_length=40, choices=NotificationTemplate.EVENT_CHOICES, db_index=True)
    audience = models.CharField(max_length=20, choices=NotificationTemplate.AUDIENCE_CHOICES)
    channel = models.CharField(max_length=20, choices=NotificationTemplate.CHANNEL_CHOICES)
    recipient = models.CharField(max_length=200)
    rendered_content = models.TextField()
    payload = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=160, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=6)
    next_attempt_at = models.DateTimeField(default=timezone.now, db_index=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    provider_message_id = models.CharField(max_length=200, blank=True)
    provider_response = models.JSONField(default=dict, blank=True)
    last_error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'ارسال پیام'
        verbose_name_plural = 'صف و تاریخچه ارسال پیام‌ها'
        indexes = [
            models.Index(fields=['status', 'next_attempt_at'], name='notify_due_idx'),
            models.Index(fields=['event', '-created_at'], name='notify_event_idx'),
            models.Index(
                fields=['channel', 'provider_message_id'],
                name='notify_provider_msg_idx',
            ),
        ]

    def __str__(self):
        return f'{self.get_event_display()} / {self.get_channel_display()} / {self.get_status_display()}'


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
            from .slugs import unique_slug
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
        from .capacity import redact

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
