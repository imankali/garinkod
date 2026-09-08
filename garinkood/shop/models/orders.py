"""Orders domain models for the shop app (split from models.py)."""

import uuid
from simple_history.models import HistoricalRecords
from django.db import models
from django.utils import timezone
from django.conf import settings
import uuid
from django.db.models import Q, Sum
from .catalog import Product



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
        ('returned', 'مرجوع شده'),
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
    # Loyalty redemption folded into the total at checkout (see Wallet):
    # the audit trail for how many points turned into how much discount.
    loyalty_discount = models.PositiveBigIntegerField(default=0)
    loyalty_points_used = models.PositiveIntegerField(default=0)
    # Audit anchor for the auto-refund: set the moment redeemed loyalty
    # points travelled BACK to the buyer's wallet — never reset afterwards,
    # so the refund path is provably single-fire (see save()/_refund_*).
    loyalty_refunded_at = models.DateTimeField(null=True, blank=True)
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

    # Transitioning INTO either terminal refund status hands the redeemed
    # loyalty points back to the buyer — exactly once (loyalty_refunded_at).
    LOYALTY_REFUND_STATUSES = frozenset({'cancelled', 'returned'})

    def save(self, *args, **kwargs):
        """Every save passes one choke point: if the order just TRANSITIONED
        into a terminal refund status and it consumed loyalty points, the
        points return to the wallet in the same atomic unit of work that
        recorded the status flip — admin clicks, self-service cancels and
        ops scripts all share this single implementation."""
        previous_status = None
        if (
            self.pk
            and self.loyalty_points_used
            and not self.loyalty_refunded_at
            and self.status in self.LOYALTY_REFUND_STATUSES
        ):
            previous_status = (
                type(self).objects.filter(pk=self.pk)
                .values_list('status', flat=True)
                .first()
            )
        super().save(*args, **kwargs)
        if previous_status and previous_status != self.status:
            self._refund_loyalty_points()

    def _refund_loyalty_points(self) -> None:
        """Credit redeemed loyalty points back to the buyer's wallet.

        Single-fire by construction: the order row is re-locked inside the
        refund transaction, so two racing saves (support retry + webhook)
        cannot double-credit. Every credit lands with a WalletTransaction
        ('loyalty_refund') audit row that explains itself in the ledger.
        Money refunds (gateway etc.) deliberately live elsewhere.
        """
        from django.db import transaction
        from django.db.models import F
        from django.utils import timezone

        points = int(self.loyalty_points_used or 0)
        if not points or not self.user_id or self.loyalty_refunded_at:
            return
        from .payments import Wallet, WalletTransaction

        with transaction.atomic():
            locked = type(self).objects.select_for_update().get(pk=self.pk)
            if locked.loyalty_refunded_at:
                return  # arrived second — the first racer already refunded
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user_id=self.user_id)
            Wallet.objects.filter(pk=wallet.pk).update(
                loyalty_points=F('loyalty_points') + points
            )
            wallet.refresh_from_db(fields=['loyalty_points'])
            WalletTransaction.objects.create(
                wallet=wallet,
                order=self,
                amount=points,
                transaction_type='loyalty_refund',
                status='available',
                description=(
                    f'بازگشت {points:,} امتیاز وفاداری سفارش {self.code} '
                    f'به‌دلیل {self.get_status_display()}'
                ),
            )
            stamped = timezone.now()
            type(self).objects.filter(pk=self.pk).update(loyalty_refunded_at=stamped)
            self.loyalty_refunded_at = stamped

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
            from ..settlements import restore_listing_quantities, reverse_marketplace_sale

            restore_listing_quantities(order)
            reverse_marketplace_sale(order, reason=f'لغو سفارش {order.code}')

            order.status = 'cancelled'
            order.save(update_fields=['status', 'updated_at'])
            # Imported lazily: the payments domain module imports Order from
            # this module, so a top-level import here would close a cycle.
            from .payments import AffiliateConversion, Coupon, FinancialLedgerEntry

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

