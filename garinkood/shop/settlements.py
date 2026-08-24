"""Seller settlement: commission, ledger entries and wallet credits.

Every marketplace sale produces a matching, auditable pair of records:

* a ``seller`` ledger entry for the net amount the storefront owner earns, and
* a ``platform`` ledger entry for the commission the platform retains.

Nothing is credited to a wallet until the order is actually paid, and every
credit references the order that produced it so the books can always be
reconciled. Reversals never delete rows; they add compensating ones.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from .models import FinancialLedgerEntry, Order, OrderItem, Wallet, WalletTransaction

# Marketplace funds stay pending for this long after payment so complaints and
# refunds can be resolved before a seller withdraws.
SELLER_HOLD_DAYS = 7


def record_marketplace_sale(order: Order) -> list[FinancialLedgerEntry]:
    """Create the pending seller/platform ledger entries for an order.

    Called at checkout. Amounts are pending — they only become withdrawable
    once :func:`release_seller_earnings` runs after payment.
    """
    entries: list[FinancialLedgerEntry] = []
    items = (
        OrderItem.objects.filter(order=order, kind='listing')
        .select_related('storefront', 'seller')
    )
    for item in items:
        if not item.storefront_id:
            continue
        net = item.seller_net_amount
        if net:
            entries.append(FinancialLedgerEntry(
                owner_type='seller',
                user=item.seller,
                storefront=item.storefront,
                order=order,
                entry_type='sale',
                status='pending',
                amount=net,
                currency='IRR',
                description=f'فروش «{item.product_title}» در سفارش {order.code}',
                metadata={
                    'order_item_id': item.id,
                    'quantity': item.quantity,
                    'unit_price': item.unit_price,
                    'gross_amount': item.total_price,
                },
            ))
        if item.commission_amount:
            entries.append(FinancialLedgerEntry(
                owner_type='platform',
                storefront=item.storefront,
                order=order,
                entry_type='commission',
                status='pending',
                amount=item.commission_amount,
                currency='IRR',
                description=f'کمیسیون {item.commission_rate}٪ فروش «{item.product_title}»',
                metadata={'order_item_id': item.id, 'rate': str(item.commission_rate)},
            ))
    if entries:
        FinancialLedgerEntry.objects.bulk_create(entries)
    return entries


def release_seller_earnings(order: Order) -> int:
    """Move an order's seller entries from pending to available and credit wallets.

    Idempotent: entries already released are skipped, so replaying a payment
    webhook cannot pay a seller twice.
    """
    released_total = 0
    available_at = timezone.now() + timedelta(days=SELLER_HOLD_DAYS)
    with transaction.atomic():
        entries = list(
            FinancialLedgerEntry.objects
            .select_for_update()
            .filter(order=order, owner_type='seller', entry_type='sale', status='pending')
        )
        for entry in entries:
            entry.status = 'available'
            entry.available_at = available_at
            entry.save(update_fields=['status', 'available_at'])
            released_total += entry.amount

            if entry.user_id:
                wallet, _ = Wallet.objects.select_for_update().get_or_create(user_id=entry.user_id)
                WalletTransaction.objects.create(
                    wallet=wallet,
                    order=order,
                    amount=entry.amount,
                    transaction_type='seller_payout',
                    status='pending',
                    description=entry.description,
                    available_at=available_at,
                )

        FinancialLedgerEntry.objects.filter(
            order=order, owner_type='platform', entry_type='commission', status='pending'
        ).update(status='available', available_at=timezone.now())

        # Reflect the completed sale on the storefronts involved.
        storefront_ids = {entry.storefront_id for entry in entries if entry.storefront_id}
        for storefront_id in storefront_ids:
            sold = OrderItem.objects.filter(
                order=order, storefront_id=storefront_id
            ).aggregate(total=Sum('quantity'))['total'] or 0
            if sold:
                from .models import Storefront

                Storefront.objects.filter(pk=storefront_id).update(
                    sales_count=F('sales_count') + sold
                )
    return released_total


def reverse_marketplace_sale(order: Order, *, reason: str = '') -> int:
    """Reverse an order's marketplace money: ledger, wallet and listing stock.

    Used for cancellation and refund. Available wallet credits are debited with
    a compensating transaction rather than edited, keeping the trail intact.
    """
    reversed_total = 0
    with transaction.atomic():
        entries = list(
            FinancialLedgerEntry.objects
            .select_for_update()
            .filter(order=order, owner_type__in=['seller', 'platform'])
            .exclude(status='reversed')
        )
        for entry in entries:
            previous_status = entry.status
            entry.status = 'reversed'
            entry.save(update_fields=['status'])
            reversed_total += entry.amount

            if entry.owner_type == 'seller' and entry.user_id and previous_status == 'available':
                wallet, _ = Wallet.objects.select_for_update().get_or_create(user_id=entry.user_id)
                WalletTransaction.objects.create(
                    wallet=wallet,
                    order=order,
                    amount=-entry.amount,
                    transaction_type='refund',
                    status='reversed',
                    description=reason or f'برگشت مبلغ سفارش {order.code}',
                )
                # Only balances that were actually credited are debited back.
                spendable = WalletTransaction.objects.filter(
                    wallet=wallet, order=order, transaction_type='seller_payout', status='available'
                ).aggregate(total=Sum('amount'))['total'] or 0
                if spendable:
                    wallet.balance = max(wallet.balance - spendable, 0)
                    wallet.save(update_fields=['balance', 'updated_at'])
                WalletTransaction.objects.filter(
                    wallet=wallet, order=order, transaction_type='seller_payout'
                ).exclude(status='reversed').update(status='reversed')
    return reversed_total


def restore_listing_quantities(order: Order) -> None:
    """Return reserved listing quantity to its storefront listing."""
    from django.db.models import F

    from .models import MarketplaceListing

    items = OrderItem.objects.filter(order=order, kind='listing', listing__isnull=False)
    for item in items:
        MarketplaceListing.objects.filter(pk=item.listing_id).update(
            quantity_available=F('quantity_available') + item.quantity,
            status='published',
            updated_at=timezone.now(),
        )
