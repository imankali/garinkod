"""Compliant loyalty and wallet operations.

All credits are recorded as auditable ledger records. They are not a mechanism
for hiding revenue, avoiding tax, or moving funds off-book.
"""

from datetime import timedelta
from secrets import token_hex

from django.db import transaction
from django.utils import timezone

from .models import (
    AffiliateConversion,
    Coupon,
    FinancialLedgerEntry,
    Order,
    Wallet,
    WalletTransaction,
)
from .settlements import release_seller_earnings

LOYALTY_PERCENT = 2
LOYALTY_MAX_REWARD = 100_000
NEXT_ORDER_COUPON_PERCENT = 5
NEXT_ORDER_COUPON_MAX = 150_000


def _unique_coupon_code(prefix: str = 'NEXT') -> str:
    while True:
        code = f"{prefix}-{token_hex(4).upper()}"
        if not Coupon.objects.filter(code=code).exists():
            return code


def mark_order_paid_and_reward(order: Order) -> tuple[Order, Coupon | None]:
    """Mark a verified payment paid once and issue auditable loyalty rewards."""
    with transaction.atomic():
        order = Order.objects.select_for_update().get(pk=order.pk)
        if order.payment_status == 'paid':
            coupon = Coupon.objects.filter(issued_to_user=order.user, description__startswith=f'پاداش سفارش {order.code}').first()
            return order, coupon
        if order.status == 'cancelled':
            raise ValueError('سفارش لغوشده قابل پرداخت نیست.')

        order.payment_status = 'paid'
        if order.status == 'awaiting_review':
            order.status = 'confirmed'
        order.save(update_fields=['payment_status', 'status', 'updated_at'])

        # Marketplace and affiliate earnings become valid only after verified
        # money arrival. Conditional updates keep callback replay idempotent.
        release_seller_earnings(order)
        AffiliateConversion.objects.filter(order=order, status='pending').update(status='approved')
        FinancialLedgerEntry.objects.filter(
            order=order,
            owner_type='affiliate',
            entry_type='affiliate_commission',
            status='pending',
        ).update(status='available', available_at=timezone.now())

        reward = min(int(order.subtotal * LOYALTY_PERCENT / 100), LOYALTY_MAX_REWARD)
        if order.user and reward:
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=order.user)
            WalletTransaction.objects.create(
                wallet=wallet,
                order=order,
                amount=reward,
                transaction_type='loyalty_reward',
                status='available',
                description=f'پاداش وفاداری سفارش {order.code}',
                available_at=timezone.now(),
            )
            wallet.balance += reward
            wallet.save(update_fields=['balance', 'updated_at'])

        coupon = Coupon.objects.create(
            code=_unique_coupon_code(),
            description=f'پاداش سفارش {order.code} برای خرید بعدی',
            discount_type='percentage',
            discount_value=NEXT_ORDER_COUPON_PERCENT,
            max_discount_amount=NEXT_ORDER_COUPON_MAX,
            min_order_amount=0,
            usage_limit=1,
            issued_to_user=order.user,
            issued_to_phone=order.phone,
            valid_until=timezone.now() + timedelta(days=30),
        )
        return order, coupon
