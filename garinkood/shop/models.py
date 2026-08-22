from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User
from django.urls import reverse
from django.conf import settings
from django.db.models import Sum, F


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
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='account')
    phone = models.CharField(max_length=11, verbose_name="شماره تلفن")
    gender = models.CharField(max_length=15, choices=GENDER_CHOICES, default='male', verbose_name="جنسیت")
    address = models.TextField(max_length=250, blank=True, null=True, verbose_name="آدرس")
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "حساب کاربری"
        verbose_name_plural = "حساب‌های کاربری"

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username}"


# --- Comment ---
class Comment(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    name = models.CharField(max_length=100, verbose_name="نام")
    email = models.EmailField(blank=True, null=True, verbose_name="ایمیل")
    body = models.TextField(verbose_name="متن")
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
        result = self.items.aggregate(
            total=Sum(F('quantity') * F('product__price'))
        )
        return result['total'] or 0

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
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('cart', 'product')
        verbose_name = "آیتم سبد"
        verbose_name_plural = "آیتم‌های سبد"

    def __str__(self):
        return f"{self.quantity} × {self.product.title}"

    @property
    def total_price(self):
        return self.quantity * (self.product.price or 0)

    @property
    def is_in_stock(self):
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

            items = list(order.items.select_related('product').all())
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

            order.status = 'cancelled'
            order.save(update_fields=['status', 'updated_at'])
            AffiliateConversion.objects.filter(order=order, status='pending').update(status='rejected')
            FinancialLedgerEntry.objects.filter(order=order, status='pending').update(status='reversed')
            return order


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.SET_NULL, related_name='order_items')
    product_title = models.CharField(max_length=250)
    product_slug = models.SlugField(max_length=250)
    unit_price = models.PositiveBigIntegerField()
    quantity = models.PositiveIntegerField()

    class Meta:
        verbose_name = 'آیتم سفارش'
        verbose_name_plural = 'آیتم‌های سفارش'

    def __str__(self):
        return f"{self.quantity} × {self.product_title}"

    @property
    def total_price(self):
        return self.unit_price * self.quantity


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
    slug = models.SlugField(max_length=180, unique=True)
    seller_type = models.CharField(max_length=20, choices=SELLER_TYPE_CHOICES, default='farmer')
    bio = models.TextField(max_length=1000, blank=True)
    province = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, blank=True)
    is_verified = models.BooleanField(default=False, db_index=True)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=8)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'غرفه'
        verbose_name_plural = 'غرفه‌ها'

    def __str__(self):
        return self.name


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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'آگهی بازار کشاورزان'
        verbose_name_plural = 'آگهی‌های بازار کشاورزان'

    def __str__(self):
        return self.title

    @property
    def image_url(self):
        return self.image.url if self.image else '/images/hero-farm.jpg'


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