"""Payments domain models for the shop app (split from models.py)."""

from simple_history.models import HistoricalRecords
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from .orders import Order
from .marketplace import Storefront



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
    # Loyalty program: points are redeemed in units of LOYALTY_POINTS_UNIT
    # against an order's payable amount, one unit worth LOYALTY_UNIT_VALUE
    # toman (100 points = 10,000). Points deliberately do NOT live in
    # `balance` — that integer is real money with its own WalletTransaction
    # ledger, and mixing a gamification ledger into it would blur accounting.
    # The Order row records loyalty_discount/loyalty_points_used as the audit
    # trail for every redemption.
    loyalty_points = models.PositiveIntegerField(default=0, verbose_name='امتیاز وفاداری')
    updated_at = models.DateTimeField(auto_now=True)

    LOYALTY_POINTS_UNIT = 100
    LOYALTY_UNIT_VALUE = 10_000

    def loyalty_discount_for(self, payable: int) -> int:
        """The most discount (toman) redeemable against a payable amount.

        Always a whole number of units and never more than the payable —
        an order must not go negative through loyalty redemption."""
        if payable <= 0:
            return 0
        units = self.loyalty_points // self.LOYALTY_POINTS_UNIT
        return min(units * self.LOYALTY_UNIT_VALUE, payable)

    def redeem_loyalty(self, discount: int) -> int:
        """Deduct the points backing a discount, race-safe.

        Runs only inside the checkout transaction; the ``__gte`` guard means
        that if another redemption shrank the balance after the quote, this
        one silently redeems nothing instead of going negative. Returns the
        discount actually applied (``0`` when nothing was deducted)."""
        if discount <= 0:
            return 0
        points = (discount // self.LOYALTY_UNIT_VALUE) * self.LOYALTY_POINTS_UNIT
        if points == 0:
            return 0
        updated = type(self).objects.filter(
            pk=self.pk, loyalty_points__gte=points
        ).update(loyalty_points=models.F('loyalty_points') - points)
        if not updated:
            return 0
        self.loyalty_points -= points
        return points * self.LOYALTY_UNIT_VALUE // self.LOYALTY_POINTS_UNIT

    class Meta:
        verbose_name = 'کیف پول'
        verbose_name_plural = 'کیف پول‌ها'

    def __str__(self):
        return f'{self.user.username} — {self.balance} {self.currency}'


class WalletTransaction(models.Model):
    TYPE_CHOICES = (
        ('loyalty_reward', 'پاداش وفاداری'),
        ('loyalty_refund', 'بازگشت امتیاز وفاداری'),
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

