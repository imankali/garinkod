"""Catalog domain models for the shop app (split from models.py)."""

from simple_history.models import HistoricalRecords
from django.contrib.auth.models import User
from django.db import models
from django.urls import reverse
from django.utils import timezone
from django.core.validators import MaxValueValidator, MinValueValidator

from .mixins import ImageVariantsMixin

class ProductManager(models.Manager):
    def published(self):
        return self.filter(status='published')

    def available(self):
        return self.filter(available=True, stock__gt=0)


# --- Category ---


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


# --- Product ---
class Product(ImageVariantsMixin):
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
        indexes = [
            # Hot catalogue list: WHERE status = 'published' ORDER BY publish
            # DESC — the composite (status, -publish) form lets SQLite/MySQL
            # answer directly from the index instead of scan-then-sort.
            models.Index(fields=('status', '-publish'), name='product_status_publish_idx'),
            # Ops dashboard low-stock counter: WHERE status = %s AND stock < n.
            models.Index(fields=('status', 'stock'), name='product_status_stock_idx'),
        ]
        verbose_name = "محصول"
        verbose_name_plural = "محصولات"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        from ..slugs import slugify_fa
        self.brand_slug = slugify_fa(self.brand)
        image_changed = self._image_has_changed()
        super().save(*args, **kwargs)
        if image_changed:
            self._refresh_image_variants()

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
        """Cover first, then the admin gallery, without repeating the cover.

        Every shot carries its own ``srcset`` (from the shared image pipeline)
        so the storefront gallery can render real <picture> elements."""
        shots = [{'url': self.image_url, 'caption': '', 'srcset': self.get_image_srcset()}]
        seen = {self.image.name} if self.image else set()
        for item in self.images.all():
            if item.image and item.image.name not in seen:
                seen.add(item.image.name)
                shots.append({
                    'url': item.image.url,
                    'caption': item.caption,
                    'srcset': item.get_image_srcset(),
                })
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
            from ..slugs import unique_slug
            self.slug = unique_slug(self.__class__, self.name, fallback='tag')
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        # A literal path rather than a named route: the frontend owns these
        # addresses and Django only renders the shell.
        return f'/tag/{self.slug}'


class ProductImage(ImageVariantsMixin):
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

    def save(self, *args, **kwargs):
        image_changed = self._image_has_changed()
        super().save(*args, **kwargs)
        if image_changed:
            self._refresh_image_variants()


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

