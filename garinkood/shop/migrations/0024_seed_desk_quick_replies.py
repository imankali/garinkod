"""Seed the tap-to-send replies each desk needs on day one.

These are rows, not constants: the wording of «کالا آسیب‌دیده رسیده است» is a
support script, and the support manager should be able to rewrite it in the
admin without a deploy. A deployment that deletes every row simply gets an
empty chip row — which is the honest answer to "no canned replies configured".
"""

from django.db import migrations


CUSTOMER_CONSULTING = [
    ('چه زمانی سم‌پاشی کنم؟', 'سلام، می‌خواهم بدانم در این مرحله از کشت بهترین زمان سم‌پاشی چه وقت است.'),
    ('دوز مصرف زمین من', 'برای زمینم چند کیلوگرم یا چند لیتر لازم است؟ مساحت و نوع زمین را می‌نویسم.'),
    ('نشانه کمبود تغذیه‌ای', 'روی برگ‌ها لکه‌زردی و زردی بین رگبرگ دیده می‌شود؛ کمبود چه عنصری است؟'),
    ('اختلاط کود و سم', 'این کود را می‌توان همزمان با سم دیگری مصرف کرد یا نه؟'),
    ('زمان کاشت رقم', 'بهترین زمان کاشت این رقم در منطقه من چه وقتی است؟'),
    ('برنامه آبیاری', 'با توجه به نوع خاک زمینم، فاصله آبیاری‌ها چقدر باشد؟'),
]

CUSTOMER_SUPPORT = [
    ('وضعیت سفارش', 'سلام، می‌خواهم بدانم سفارشم در چه مرحله‌ای است و چه زمانی ارسال می‌شود.'),
    ('اصلاح آدرس', 'آدرس تحویل سفارش اشتباه است؛ می‌شود اصلاحش کرد؟'),
    ('کالای آسیب‌دیده', 'بسته کالا آسیب‌دیده یا مغایر رسیده است؛ عکس می‌فرستم.'),
    ('فاکتور رسمی', 'برای سفارشم فاکتور رسمی نیاز دارم.'),
    ('مرجوعی و بازگشت وجه', 'می‌خواهم کالا را مرجوع کنم و وجه را پس بگیرم.'),
    ('کد تخفیف باشگاه', 'کد تخفیف باشگاه مشتریان را چطور روی این خرید استفاده کنم؟'),
]

STAFF_CONSULTING = [
    ('پرونده زمین', 'برای دوز دقیق، پرونده زمین (نوع خاک، آبیاری و تقویم کشت) را در همین گفتگو بفرستید.'),
    ('دوره کارتن', 'پیش از سم‌پاشی دوره کارتن را از روی برچسب محصول بررسی کنید؛ عدد همین صفحه مرجع نیست.'),
    ('مبنای محاسبه', 'مقادری که می‌گویم برای ۱۰۰۰ متر است؛ مساحت واقعی زمینتان را بفرستید تا تبدیل کنم.'),
    ('نمونه خاک', 'برای اطمینان، یک نمونه خاک یا برگ به آزمایشگاه بفرستید و پاسخ را همین‌جا بگذارید.'),
    ('پیگیری', 'وضعیت را تا دو روز دیگر دوباره بررسی می‌کنیم؛ عکس تازه از برگ‌ها بفرستید.'),
]

STAFF_SUPPORT = [
    ('مرحله سفارش', 'سفارش شما تایید شده و در مرحله بسته‌بندی است؛ کد رهگیری پیامک می‌شود.'),
    ('درخواست تصویر', 'لطفاً تصویر بسته‌بندی و برچسب کالا را بفرستید تا با کارخانه هماهنگ کنیم.'),
    ('فاکتور', 'فاکتور رسمی از بخش «سفارش‌ها» قابل دریافت است؛ در صورت نیاز فایل را برایتان می‌فرستیم.'),
    ('بازگشت وجه', 'درخواست بازگشت وجه ثبت شد؛ نتیجه حداکثر تا ۲۴ ساعت در همین گفتگو اعلام می‌شود.'),
    ('ارجاع به مشاور', 'این مورد تخصصی است؛ کارشناس مشاوره در گفتگوی «مشاوره کشاورزی» پاسخ می‌دهد.'),
]


QUICK_REPLIES = {
    'consulting': CUSTOMER_CONSULTING,
    'support': CUSTOMER_SUPPORT,
}
STAFF_REPLIES = {
    'consulting': STAFF_CONSULTING,
    'support': STAFF_SUPPORT,
}


def seed(apps, schema_editor):
    quick_reply = apps.get_model('shop', 'QuickReply')
    order = 0
    for channel, rows in QUICK_REPLIES.items():
        for label, text in rows:
            order += 1
            quick_reply.objects.create(
                audience='customer', channel=channel, label=label, text=text,
                is_first_message_only=(order <= 3), order=order, is_active=True,
            )
    order = 0
    for channel, rows in STAFF_REPLIES.items():
        for label, text in rows:
            order += 1
            quick_reply.objects.create(
                audience='staff', channel=channel, label=label, text=text,
                order=order, is_active=True,
            )


def unseed(apps, schema_editor):
    quick_reply = apps.get_model('shop', 'QuickReply')
    quick_reply.objects.filter(text__in=[row[1] for rows in QUICK_REPLIES.values() for row in rows]).delete()
    quick_reply.objects.filter(text__in=[row[1] for rows in STAFF_REPLIES.values() for row in rows]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0023_desksettings_quickreply_and_more'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
