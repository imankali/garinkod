import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse
from django.conf import settings
from django.db.models import Q, Sum, F
from django.db.models.functions import Lower
from simple_history.models import HistoricalRecords


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
    sku = models.CharField(max_length=80, blank=True, db_index=True, verbose_name="شناسه کالا")
    gtin = models.CharField(max_length=14, blank=True, db_index=True, verbose_name="GTIN")
    seo_title = models.CharField(max_length=70, blank=True, verbose_name="عنوان سئو")
    seo_description = models.CharField(max_length=170, blank=True, verbose_name="توضیح متا")
    shipping_weight_grams = models.PositiveIntegerField(default=0, verbose_name="وزن ارسال (گرم)")
    shipping_length_cm = models.PositiveSmallIntegerField(default=0, verbose_name="طول بسته (سانتی‌متر)")
    shipping_width_cm = models.PositiveSmallIntegerField(default=0, verbose_name="عرض بسته (سانتی‌متر)")
    shipping_height_cm = models.PositiveSmallIntegerField(default=0, verbose_name="ارتفاع بسته (سانتی‌متر)")

    objects = ProductManager()
    history = HistoricalRecords()

    class Meta:
        ordering = ('-publish',)
        verbose_name = "محصول"
        verbose_name_plural = "محصولات"

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse('shop:product_detail', args=[self.slug])

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

    # Access levels 1..5.  The level is authoritative for coarse-grained access
    # (for example the /poshtiban console); Django groups still express the
    # fine-grained "which model may I change" permissions on top of it.
    LEVEL_BUYER = 1
    LEVEL_SELLER = 2
    LEVEL_MODERATOR = 3
    LEVEL_ADMIN = 4
    LEVEL_OWNER = 5
    LEVEL_CHOICES = (
        (LEVEL_BUYER, 'سطح ۱ — خریدار'),
        (LEVEL_SELLER, 'سطح ۲ — غرفه‌دار'),
        (LEVEL_MODERATOR, 'سطح ۳ — ناظر محتوا'),
        (LEVEL_ADMIN, 'سطح ۴ — مدیر'),
        (LEVEL_OWNER, 'سطح ۵ — مالک سیستم'),
    )
    STAFF_LEVELS = (LEVEL_MODERATOR, LEVEL_ADMIN, LEVEL_OWNER)

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

    def promote_to(self, level: int, *, save: bool = True) -> 'UserAccount':
        """Raise the level, never silently lowering an existing one."""
        if level > self.level:
            self.level = level
            if save:
                self.save(update_fields=['level', 'updated'])
        return self


def account_level(user) -> int:
    """Resolve a user's level without assuming the profile row exists.

    Superusers are always owners so a fresh `createsuperuser` account can
    reach the console before any profile row has been written.
    """
    if not user or not user.is_authenticated:
        return 0
    if user.is_superuser:
        return UserAccount.LEVEL_OWNER
    account = getattr(user, 'account', None)
    if account:
        return account.level
    return UserAccount.LEVEL_BUYER


# --- Comment ---
class Comment(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100, verbose_name="نام")
    email = models.EmailField(blank=True, null=True, verbose_name="ایمیل")
    body = models.TextField(verbose_name="متن")
    image = models.ImageField(upload_to='comments/%Y/%m/', blank=True, null=True, verbose_name="تصویر")
    sticker = models.CharField(max_length=16, blank=True, verbose_name="استیکر")
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=False, verbose_name="فعال")

    class Meta:
        ordering = ('created',)
        verbose_name = "نظر"
        verbose_name_plural = "نظرات"

    def __str__(self):
        return f"کامنت توسط {self.name} روی {self.product}"

    @property
    def is_reply(self):
        return self.parent is not None

    @property
    def replies_count(self):
        return self.replies.count()


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
    listing = models.ForeignKey(
        'MarketplaceListing', null=True, blank=True, on_delete=models.CASCADE, related_name='cart_items'
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = "آیتم سبد"
        verbose_name_plural = "آیتم‌های سبد"
        constraints = [
            models.UniqueConstraint(
                fields=['cart', 'product'],
                condition=models.Q(product__isnull=False),
                name='unique_cart_product',
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
    def unit_price(self) -> int:
        source = self.listing if self.listing_id else self.product
        return int(getattr(source, 'price', 0) or 0)

    @property
    def total_price(self):
        return self.quantity * self.unit_price

    @property
    def available_quantity(self) -> int:
        if self.listing_id:
            return int(self.listing.quantity_available)
        return int(self.product.stock)

    @property
    def is_in_stock(self):
        if self.listing_id:
            return self.listing.is_purchasable and self.quantity <= int(self.listing.quantity_available)
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
        """Messages the given participant has not read yet."""
        if user.is_authenticated:
            return self.messages.filter(is_read=False).exclude(sender=user).count()
        return 0

    def last_message(self):
        return self.messages.order_by('-created_at').first()


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
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_storefront_messages'
    )
    body = models.TextField(max_length=2000, blank=True)
    listing = models.ForeignKey(
        MarketplaceListing, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='direct_messages',
    )
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
        return f'{self.sender.username}: {self.body[:40]}'

    @property
    def attachment_url(self) -> str:
        return self.attachment.url if self.attachment else ''


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
