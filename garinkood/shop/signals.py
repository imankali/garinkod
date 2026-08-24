"""Signals keeping user access levels consistent with what a user owns.

Levels are derived facts, not something a client can post:

* every user gets a level-1 profile the moment the account exists;
* opening a storefront promotes the owner to level 2;
* levels 3-5 are granted deliberately by an owner through the management API.

Promotion never lowers an existing level, so a moderator who also happens to
run a storefront does not get demoted to level 2.
"""

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Storefront, UserAccount

User = get_user_model()


@receiver(post_save, sender=User, dispatch_uid='shop_create_user_account')
def ensure_user_account(sender, instance, created, **kwargs):
    """Guarantee a profile row exists so level lookups never fall back blindly."""
    if not created:
        return
    level = UserAccount.LEVEL_OWNER if instance.is_superuser else UserAccount.LEVEL_BUYER
    UserAccount.objects.get_or_create(user=instance, defaults={'phone': '', 'level': level})


@receiver(post_save, sender=Storefront, dispatch_uid='shop_promote_storefront_owner')
def promote_storefront_owner(sender, instance, created, **kwargs):
    """A user who opens a storefront becomes a level-2 seller."""
    if not created:
        return
    account, _ = UserAccount.objects.get_or_create(user=instance.user, defaults={'phone': ''})
    account.promote_to(UserAccount.LEVEL_SELLER)
