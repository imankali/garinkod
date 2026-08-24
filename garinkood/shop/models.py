from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse
from django.conf import settings
from django.db.models import Sum, F
from django.db.models.functions import Lower


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

    objects = ProductManager()

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
    phone = models.CharField(max_length=11, verbose_name="شماره تلفن")
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
    notes = models.TextField(max_length=1000, blank=True, verbose_name='توضیحات مشتری')
    subtotal = models.PositiveBigIntegerField(default=0)
    discount_amount = models.PositiveBigIntegerField(default=0)
    coupon_code = models.CharField(max_length=40, blank=True, db_index=True)
    shipping_price = models.PositiveBigIntegerField(default=0)
    total_price = models.PositiveBigIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='awaiting_review', db_index=True)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid', db_index=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='coordination')
    affiliate_code = models.CharField(max_length=32, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    currency = models.CharField(max_length=8, default='IRR')
    idempotency_key = models.CharField(max_length=64, unique=True)
    external_reference = models.CharField(max_length=255, blank=True, db_index=True)
    checkout_url = models.URLField(blank=True)
    provider_payload = models.JSONField(default=dict, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'تلاش پرداخت'
        verbose_name_plural = 'تلاش‌های پرداخت'

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
    currency = models.CharField(max_length=8, default='IRR')
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
    currency = models.CharField(max_length=8, default='IRR')
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
