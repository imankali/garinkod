"""Create a small, realistic marketplace fixture for local development.

This is a development convenience only — it is never run in production. It
gives the storefront pages something to render: a few sellers with avatars,
published listings, posts and stories.
"""

from datetime import timedelta

from django.contrib.auth.models import Permission, User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from shop.models import DeskAgent, MarketplaceListing, Storefront, StorefrontPost, UserAccount
from shop.slugs import slugify_fa

DEMO_SELLERS = [
    {
        'username': 'bagh-sabz',
        'name': 'باغ سبز شیراز',
        'seller_type': 'farmer',
        'province': 'فارس',
        'city': 'شیراز',
        'bio': 'تولیدکننده مرکبات و صیفی‌جات ارگانیک در دشت شیراز. ارسال مستقیم از باغ.',
        'verified': True,
        'listings': [
            ('پرتقال تامسون درجه یک', 'پرتقال', 45_000, 'کیلوگرم', 1200, 20),
            ('لیمو شیرین تازه', 'لیمو', 38_000, 'کیلوگرم', 600, 10),
        ],
    },
    {
        'username': 'taavoni-gorgan',
        'name': 'تعاونی کشاورزان گرگان',
        'seller_type': 'cooperative',
        'province': 'گلستان',
        'city': 'گرگان',
        'bio': 'تعاونی ۴۰ کشاورز گلستانی؛ عرضه گندم، جو و کلزا با قیمت درب مزرعه.',
        'verified': True,
        'listings': [
            ('گندم دوروم', 'گندم', 22_000, 'کیلوگرم', 50_000, 500),
            ('جو دامی', 'جو', 18_000, 'کیلوگرم', 30_000, 500),
        ],
    },
    {
        'username': 'pesteh-rafsanjan',
        'name': 'پسته رفسنجان',
        'seller_type': 'merchant',
        'province': 'کرمان',
        'city': 'رفسنجان',
        'bio': 'صادرکننده پسته اکبری و احمدآقایی؛ بسته‌بندی صادراتی.',
        'verified': False,
        'listings': [
            ('پسته اکبری صادراتی', 'پسته', 890_000, 'کیلوگرم', 800, 5),
        ],
    },
    {
        'username': 'golkhane-esfahan',
        'name': 'گلخانه بهاران اصفهان',
        'seller_type': 'company',
        'province': 'اصفهان',
        'city': 'اصفهان',
        'bio': 'گلخانه هیدروپونیک ۳ هکتاری؛ گوجه و خیار گلخانه‌ای تمام‌سال.',
        'verified': True,
        'listings': [
            ('گوجه گلخانه‌ای', 'گوجه‌فرنگی', 32_000, 'کیلوگرم', 4000, 50),
            ('خیار گلخانه‌ای', 'خیار', 28_000, 'کیلوگرم', 3000, 50),
        ],
    },
    {
        'username': 'zaferan-torbat',
        'name': 'زعفران تربت',
        'seller_type': 'farmer',
        'province': 'خراسان رضوی',
        'city': 'تربت حیدریه',
        'bio': 'زعفران سرگل درجه یک، برداشت امسال، با برگه آزمایشگاه.',
        'verified': False,
        'listings': [],
    },
]


class Command(BaseCommand):
    help = "Seed demo storefronts, listings and posts for local development."

    # Development-only credential so the owner/buyer flows can be exercised
    # locally without a manual password reset.
    DEMO_PASSWORD = 'demo-12345'

    @transaction.atomic
    def handle(self, *args, **options):
        created_sellers = created_listings = created_posts = 0

        # A demo consultant on the service desk: level 5 (کارشناس میز خدمات), which is the
        # rank that opens the queue — deliberately *not* a content moderator, so the
        # sample data shows what the ladder actually separates.
        consultant, _ = User.objects.get_or_create(
            username='moshaver',
            defaults={'email': 'moshaver@example.com', 'first_name': 'کارشناس', 'last_name': 'گرین کود'},
        )
        if not consultant.check_password(self.DEMO_PASSWORD):
            consultant.set_password(self.DEMO_PASSWORD)
            consultant.save(update_fields=['password'])
        consultant_account, _ = UserAccount.objects.get_or_create(user=consultant)
        if consultant_account.level < UserAccount.LEVEL_DESK_AGENT:
            consultant_account.level = UserAccount.LEVEL_DESK_AGENT
            consultant_account.save(update_fields=['level'])
        consultant.user_permissions.add(*Permission.objects.filter(
            content_type__app_label='shop',
            codename__in=('view_farmconsultationrequest', 'change_farmconsultationrequest'),
        ))
        if not consultant.is_staff:
            consultant.is_staff = True
            consultant.save(update_fields=['is_staff'])
        DeskAgent.objects.get_or_create(
            user=consultant,
            defaults={
                'role': DeskAgent.ROLE_CONSULTING,
                'display_name': 'کارشناس گرین کود',
                'title': 'مشاور ارشد کشاورزی',
                'is_active': True,
            },
        )

        for entry in DEMO_SELLERS:
            user, _ = User.objects.get_or_create(
                username=entry['username'],
                defaults={'email': f"{entry['username']}@example.com"},
            )
            # Local demo credential: resetting it every run keeps the sample
            # sellers signable after any fixture change. Never run in production.
            if not user.check_password(self.DEMO_PASSWORD):
                user.set_password(self.DEMO_PASSWORD)
                user.save(update_fields=['password'])
            storefront, created = Storefront.objects.get_or_create(
                user=user,
                defaults={
                    'name': entry['name'],
                    'slug': slugify_fa(entry['name']),
                    'seller_type': entry['seller_type'],
                    'province': entry['province'],
                    'city': entry['city'],
                    'bio': entry['bio'],
                    'is_verified': entry['verified'],
                    'commission_rate': 8,
                },
            )
            created_sellers += int(created)

            for index, (title, crop, price, unit, quantity, minimum) in enumerate(entry['listings']):
                _, listing_created = MarketplaceListing.objects.get_or_create(
                    storefront=storefront,
                    title=title,
                    defaults={
                        'slug': slugify_fa(f'{entry["name"]}-{title}'),
                        'crop_name': crop,
                        'description': f'{title} از {entry["name"]}؛ کیفیت تضمین‌شده و ارسال مستقیم.',
                        'price': price,
                        'unit': unit,
                        'quantity_available': quantity,
                        'min_order_quantity': minimum,
                        'status': 'published',
                        'discount_percent': (0, 10, 15, 20, 30, 25)[index % 6],
                        'sales_count': (9 + index * 23) % 180,
                    },
                )
                created_listings += int(listing_created)

            _, post_created = StorefrontPost.objects.get_or_create(
                storefront=storefront,
                post_type='post',
                caption=f'به غرفه {entry["name"]} خوش آمدید.',
                defaults={'status': 'published'},
            )
            created_posts += int(post_created)

            _, story_created = StorefrontPost.objects.get_or_create(
                storefront=storefront,
                post_type='story',
                caption='برداشت امروز',
                defaults={
                    'status': 'published',
                    'expires_at': timezone.now() + timedelta(hours=24),
                },
            )
            created_posts += int(story_created)

        self.stdout.write(self.style.SUCCESS(
            f'{created_sellers} غرفه، {created_listings} آگهی و {created_posts} پست/استوری نمونه ساخته شد.'
        ))
