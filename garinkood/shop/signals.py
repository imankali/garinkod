"""Signals keeping user access levels consistent with what a user owns.

Levels are derived facts, not something a client can post:

* every user gets a level-1 profile the moment the account exists;
* verifying the phone number promotes them to level 2 — the platform has proven
  the person behind the account, so their name now carries the verified badge;
* opening a storefront promotes the owner to level 3;
* an operator verifying that storefront promotes the owner to level 4, which is
  what puts the storefront in front of buyers («غرفه‌های منتخب»);
* levels 5-8 are appointments and are granted deliberately through the
  management API — nothing here ever hands one out by accident.

Promotion never lowers an existing level, so a moderator who also runs a
storefront does not get demoted to level 3, and un-verifying a storefront takes
the *badge* away (the model field) without silently stripping a person's rank.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import (
    Order,
    Shipment,
    ShipmentTrackingEvent,
    Storefront,
    UserAccount,
)

User = get_user_model()


@receiver(post_save, sender=User, dispatch_uid='shop_create_user_account')
def ensure_user_account(sender, instance, created, **kwargs):
    """Guarantee a profile row exists so level lookups never fall back blindly."""
    if not created:
        return
    level = UserAccount.LEVEL_OWNER if instance.is_superuser else UserAccount.LEVEL_BUYER
    UserAccount.objects.get_or_create(user=instance, defaults={'phone': '', 'level': level})


@receiver(post_save, sender=UserAccount, dispatch_uid='shop_promote_verified_phone')
def promote_verified_buyer(sender, instance, created, **kwargs):
    """A confirmed phone number is the difference between level 1 and level 2."""
    if created or instance.phone_verified_at is None:
        return
    if instance.level < UserAccount.LEVEL_VERIFIED_BUYER:
        instance.promote_to(UserAccount.LEVEL_VERIFIED_BUYER)


@receiver(post_save, sender=Storefront, dispatch_uid='shop_promote_storefront_owner')
def promote_storefront_owner(sender, instance, created, **kwargs):
    """A user who opens a storefront becomes a seller; a verified storefront
    makes them a *verified* seller."""
    target = UserAccount.LEVEL_VERIFIED_SELLER if instance.is_verified else UserAccount.LEVEL_SELLER
    account = getattr(instance.user, 'account', None)
    if account is None:
        account, _ = UserAccount.objects.get_or_create(user=instance.user, defaults={'phone': ''})
    if account.level < target:
        account.promote_to(target)


@receiver(pre_save, sender=Order, dispatch_uid='shop_capture_order_notification_state')
def capture_order_notification_state(sender, instance, **kwargs):
    """Remember state before save so post_save can emit only real transitions."""

    if not instance.pk:
        instance._notification_previous_state = None
        return
    instance._notification_previous_state = (
        Order.objects.filter(pk=instance.pk)
        .values_list('status', 'payment_status')
        .first()
    )


@receiver(post_save, sender=Order, dispatch_uid='shop_enqueue_order_status_notification')
def enqueue_order_status_notification(sender, instance, created, **kwargs):
    """Persist status alerts in the same transaction; never call providers here."""

    if created:
        return
    previous = getattr(instance, '_notification_previous_state', None)
    if previous and previous != (instance.status, instance.payment_status):
        from .messaging.outbox import enqueue_order_event

        enqueue_order_event(instance, 'order_status_changed')


@receiver(post_save, sender=ShipmentTrackingEvent, dispatch_uid='shop_apply_tracking_event')
def apply_tracking_event(sender, instance, created, **kwargs):
    """Apply new carrier/admin events without letting older events regress state."""
    if not created:
        return
    with transaction.atomic():
        shipment = Shipment.objects.select_for_update().select_related('order').get(
            pk=instance.shipment_id
        )
        if shipment.last_event_at and instance.occurred_at < shipment.last_event_at:
            return
        shipment.status = instance.status
        shipment.last_event_at = instance.occurred_at
        update_fields = ['status', 'last_event_at', 'updated_at']
        if instance.status in {'picked_up', 'in_transit', 'out_for_delivery'} and not shipment.shipped_at:
            shipment.shipped_at = instance.occurred_at
            update_fields.append('shipped_at')
        if instance.status == 'delivered' and not shipment.delivered_at:
            shipment.delivered_at = instance.occurred_at
            update_fields.append('delivered_at')
        shipment.save(update_fields=update_fields)

        order = shipment.order
        next_status = None
        if instance.status in {'picked_up', 'in_transit', 'out_for_delivery'} and order.status not in {'delivered', 'cancelled'}:
            next_status = 'shipped'
        elif instance.status == 'delivered' and order.status != 'cancelled':
            next_status = 'delivered'
        if next_status and next_status != order.status:
            order.status = next_status
            order.save(update_fields=['status', 'updated_at'])
