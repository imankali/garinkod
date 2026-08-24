"""Backfill derived data introduced by 0007.

Existing rows predate the new columns, so their defaults are not meaningful:

* every order item was a catalogue product, and none carried seller data;
* user levels must reflect what each account already owns (superuser → 5,
  storefront owner → 2, everyone else → 1);
* accounts missing entirely are created so level lookups are total.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    UserAccount = apps.get_model('shop', 'UserAccount')
    Storefront = apps.get_model('shop', 'Storefront')
    OrderItem = apps.get_model('shop', 'OrderItem')
    User = apps.get_model('auth', 'User')

    # Historic order items are all catalogue products.
    OrderItem.objects.filter(kind='').update(kind='product')

    seller_ids = set(Storefront.objects.values_list('user_id', flat=True))

    existing = {account.user_id: account for account in UserAccount.objects.all()}
    missing = []
    for user in User.objects.all().only('id', 'is_superuser', 'is_staff'):
        account = existing.get(user.id)
        if user.is_superuser:
            level = 5
        elif user.is_staff:
            level = 3
        elif user.id in seller_ids:
            level = 2
        else:
            level = 1
        if account is None:
            missing.append(UserAccount(user_id=user.id, phone='', level=level))
        elif account.level != level and account.level < level:
            account.level = level
            account.save(update_fields=['level'])

    if missing:
        UserAccount.objects.bulk_create(missing, ignore_conflicts=True)


def noop(apps, schema_editor):
    """Levels and item kinds are derived; nothing to undo on reverse."""


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0007_agriinput_agriinputdose_location_storefrontfollow_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
