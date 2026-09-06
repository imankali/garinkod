"""Eight-step access ladder: renumber the ranks and hand people the step they earned.

The ladder used to jump from «غرفه‌دار» (۲) straight to «ناظر محتوا» (۳), which
made hiring a support operator mean handing over content moderation, and left a
phone-verified buyer indistinguishable from a fresh registration. The new ladder
adds «خریدار تأییدشده» (۲), «غرفه‌دار تأییدشده» (۴) and «کارشناس میز خدمات» (۵).

Stored levels are renumbered first (highest to lowest, so no value is visited
twice), then the two derived steps are granted from the rows that already prove
them: a verified phone number and a verified storefront. Promotion is only ever
upward — nobody loses a rank in this migration.
"""

from django.db import migrations, models

# old level -> new level, applied from the top down.
RENUMBER = (
    (5, 8),  # مالک سیستم
    (4, 7),  # مدیر
    (3, 6),  # ناظر محتوا
    (2, 3),  # غرفه‌دار
    # 1 stays 1 (خریدار)
)


def renumber_levels(apps, schema_editor):
    UserAccount = apps.get_model('shop', 'UserAccount')
    for old, new in RENUMBER:
        UserAccount.objects.filter(level=old).update(level=new)


def restore_levels(apps, schema_editor):
    UserAccount = apps.get_model('shop', 'UserAccount')
    for old, new in reversed(RENUMBER):
        UserAccount.objects.filter(level=new).update(level=old)


def grant_derived_ranks(apps, schema_editor):
    """Tier ۲ for verified phone numbers, tier ۴ for verified storefronts."""
    UserAccount = apps.get_model('shop', 'UserAccount')
    Storefront = apps.get_model('shop', 'Storefront')

    verified = UserAccount.objects.filter(
        level=1, phone_verified_at__isnull=False,
    ).values_list('id', flat=True)
    UserAccount.objects.filter(id__in=list(verified)).update(level=2)

    owner_ids = list(
        Storefront.objects.filter(is_verified=True).values_list('user_id', flat=True),
    )
    # promote, never demote: only a rank-۳ seller steps up to rank ۴.
    UserAccount.objects.filter(user_id__in=owner_ids, level=3).update(level=4)


def drop_derived_ranks(apps, schema_editor):
    UserAccount = apps.get_model('shop', 'UserAccount')
    UserAccount.objects.filter(level=4).update(level=3)
    UserAccount.objects.filter(level=2).update(level=1)


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0032_capacitysettings_queueticket_resourcesample_and_more'),
    ]

    operations = [
        migrations.RunPython(renumber_levels, restore_levels),
        migrations.AlterField(
            model_name='useraccount',
            name='level',
            field=models.PositiveSmallIntegerField(
                choices=[
                    (1, 'سطح ۱ — خریدار'),
                    (2, 'سطح ۲ — خریدار تأییدشده'),
                    (3, 'سطح ۳ — غرفه‌دار'),
                    (4, 'سطح ۴ — غرفه‌دار تأییدشده'),
                    (5, 'سطح ۵ — کارشناس میز خدمات'),
                    (6, 'سطح ۶ — ناظر محتوا'),
                    (7, 'سطح ۷ — مدیر'),
                    (8, 'سطح ۸ — مالک سیستم'),
                ],
                db_index=True,
                default=1,
                verbose_name='سطح دسترسی',
            ),
        ),
        migrations.RunPython(grant_derived_ranks, drop_derived_ranks),
    ]
