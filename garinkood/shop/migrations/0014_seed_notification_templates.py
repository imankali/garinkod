from django.db import migrations


SYSTEM_PREFIX = 'پیش‌فرض سیستم — '

TEMPLATES = [
    (
        'سفارش جدید مدیر (تلگرام)', 'order_created', 'owner', 'telegram',
        '🛒 سفارش جدید {order_code}\nمشتری: {customer_name} ({customer_phone})\nاقلام: {items}\nمبلغ: {total_price} تومان\nشهر: {city}\nپرداخت: {payment_status_label} | وضعیت: {status_label}\n{admin_url}',
    ),
    (
        'سفارش جدید مدیر (بله)', 'order_created', 'owner', 'bale',
        '🛒 سفارش جدید {order_code}\nمشتری: {customer_name} ({customer_phone})\nاقلام: {items}\nمبلغ: {total_price} تومان\nشهر: {city}\nپرداخت: {payment_status_label} | وضعیت: {status_label}\n{admin_url}',
    ),
    (
        'سفارش جدید مدیر (پیامک)', 'order_created', 'owner', 'sms',
        'سفارش جدید {order_code} | {customer_name} | {total_price} تومان | {city} | {status_label}',
    ),
    (
        'سفارش جدید مدیر (واتساپ)', 'order_created', 'owner', 'whatsapp',
        'سفارش جدید {order_code}\n{customer_name}\n{items}\n{total_price} تومان\n{status_label}\n{admin_url}',
    ),
    (
        'تغییر سفارش مدیر (تلگرام)', 'order_status_changed', 'owner', 'telegram',
        'وضعیت سفارش {order_code} تغییر کرد.\nوضعیت: {status_label}\nپرداخت: {payment_status_label}\n{admin_url}',
    ),
    (
        'تغییر سفارش مدیر (بله)', 'order_status_changed', 'owner', 'bale',
        'وضعیت سفارش {order_code} تغییر کرد.\nوضعیت: {status_label}\nپرداخت: {payment_status_label}\n{admin_url}',
    ),
    (
        'تغییر سفارش مدیر (پیامک)', 'order_status_changed', 'owner', 'sms',
        'سفارش {order_code}: {status_label}؛ پرداخت: {payment_status_label}',
    ),
    (
        'تغییر سفارش مدیر (واتساپ)', 'order_status_changed', 'owner', 'whatsapp',
        'سفارش {order_code}: {status_label}؛ پرداخت: {payment_status_label}',
    ),
    (
        'تغییر سفارش مشتری (پیامک)', 'order_status_changed', 'customer', 'sms',
        'گرین کود: وضعیت سفارش {order_code} به «{status_label}» تغییر کرد.',
    ),
    (
        'تغییر سفارش مشتری (بله)', 'order_status_changed', 'customer', 'bale',
        'گرین کود: وضعیت سفارش {order_code} به «{status_label}» تغییر کرد.',
    ),
    (
        'تغییر سفارش مشتری (واتساپ)', 'order_status_changed', 'customer', 'whatsapp',
        'گرین کود: وضعیت سفارش {order_code} به «{status_label}» تغییر کرد.',
    ),
    (
        'آزمایش تلگرام', 'test', 'owner', 'telegram',
        'پیام آزمایشی گرین کود: اتصال تلگرام برقرار است.',
    ),
    (
        'آزمایش بله', 'test', 'owner', 'bale',
        'پیام آزمایشی گرین کود: اتصال بله برقرار است.',
    ),
    (
        'آزمایش پیامک', 'test', 'owner', 'sms',
        'پیام آزمایشی گرین کود: اتصال پیامک برقرار است.',
    ),
    (
        'آزمایش واتساپ', 'test', 'owner', 'whatsapp',
        'پیام آزمایشی گرین کود: اتصال واتساپ برقرار است.',
    ),
]


def seed_templates(apps, schema_editor):
    NotificationTemplate = apps.get_model('shop', 'NotificationTemplate')
    for label, event, audience, channel, body in TEMPLATES:
        NotificationTemplate.objects.get_or_create(
            event=event,
            audience=audience,
            channel=channel,
            defaults={
                'name': f'{SYSTEM_PREFIX}{label}',
                'body': body,
                'is_active': True,
            },
        )


def remove_seeded_templates(apps, schema_editor):
    NotificationTemplate = apps.get_model('shop', 'NotificationTemplate')
    NotificationTemplate.objects.filter(name__startswith=SYSTEM_PREFIX).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('shop', '0013_alter_useraccount_phone'),
    ]

    operations = [
        migrations.RunPython(seed_templates, remove_seeded_templates),
    ]
