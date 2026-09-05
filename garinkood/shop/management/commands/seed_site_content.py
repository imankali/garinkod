"""Seed the service pages, information pages and (optionally) a product landing.

Idempotent: rows are matched on their slug and rewritten, so rerunning after a
copy edit updates the existing record instead of duplicating it. Admin-created
overrides are replaced by the seed on purpose — this command is for the first
bring-up of a new environment, not for ongoing edits.

``--with-landing`` builds a flagship landing page for the site's own featured
product, so an operator can see how blocks compose a page before writing one.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from shop.data.site_content import PAGES, SERVICES
from shop.models import Product, Service, SitePage, SitePageBlock
from shop.slugs import slugify_fa


class Command(BaseCommand):
    help = "Seed services and information pages so the content routes have real data."

    def add_arguments(self, parser):
        parser.add_argument(
            '--with-landing',
            action='store_true',
            help='ساخت یک صفحه فرود نمونه برای اولین محصول ویژه.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        services = 0
        for entry in SERVICES:
            Service.objects.update_or_create(
                slug=slugify_fa(entry['title']),
                defaults={
                    'code': entry['code'],
                    'title': entry['title'],
                    'summary': entry['summary'],
                    'body': entry['body'],
                    'highlights': entry['highlights'],
                    'icon': entry['icon'],
                    'price_note': entry['price_note'],
                    'is_active': True,
                    'order': SERVICES.index(entry),
                },
            )
            services += 1

        pages = 0
        for entry in PAGES:
            page, _ = SitePage.objects.update_or_create(
                slug=entry['slug'],
                defaults={
                    'title': entry['title'],
                    'kind': entry['kind'],
                    'badge': entry.get('badge', ''),
                    'hero_text': entry.get('hero_text', ''),
                    'published': True,
                },
            )
            self._rewrite_blocks(page, entry.get('blocks', []))
            pages += 1

        self.stdout.write(
            self.style.SUCCESS(f'{services} خدمت و {pages} صفحه اطلاعاتی ساخته/به‌روزرسانی شد.')
        )

        if options['with_landing']:
            self._seed_landing()

    @staticmethod
    def _rewrite_blocks(page, blocks):
        page.blocks.all().delete()
        for index, block in enumerate(blocks):
            SitePageBlock.objects.create(
                page=page,
                block_type=block['block_type'],
                title=block.get('title', ''),
                text=block.get('text', ''),
                rows=block.get('rows', ''),
                link=block.get('link', ''),
                data=block.get('data', {}) or {},
                position=index,
            )

    def _seed_landing(self):
        product = (
            Product.objects.filter(status='published', is_featured=True).order_by('-sales_count').first()
            or Product.objects.filter(status='published').order_by('-sales_count').first()
        )
        if product is None:
            self.stdout.write(
                self.style.WARNING('محصول انتشاریافته‌ای وجود ندارد؛ صفحه فرود نمونه ساخته نشد.')
            )
            return
        page, _ = SitePage.objects.update_or_create(
            slug=f"offer-{product.slug}",
            defaults={
                'title': f'پیشنهاد ویژه: {product.title}',
                'kind': SitePage.KIND_LANDING,
                'badge': 'پیشنهاد ویژه',
                'hero_text': product.description[:400],
                'product': product,
                'cta_label': 'مشاوره و ثبت سفارش',
                'cta_url': f'/products/{product.slug}',
                # Draft on purpose: prices and grades must be confirmed by the
                # operator before a promotional page goes live.
                'published': False,
            },
        )
        blocks = [
            {'block_type': 'heading', 'title': 'چرا این محصول؟'},
            {'block_type': 'text', 'text': product.description[:900]},
        ]
        specs = [
            f'{attribute.label} | {attribute.value}'
            for attribute in product.attributes.exclude(value='').order_by('order', 'id')
        ]
        if specs:
            # The landing page reuses the product's own spec sheet rather than
            # repeating numbers that could drift apart.
            blocks.append({'block_type': 'spec_table', 'title': 'مشخصات فنی', 'rows': '\n'.join(specs)})
        blocks.append({
            'block_type': 'price_table',
            'title': 'قیمت بسته‌ها',
            'rows': (
                f'بسته {product.package_weight or "معمول"} | {product.discounted_price:,} تومان | هر بسته\n'
                'خرید عمده | با تماس | قیمت تنی پس از استعلام موجودی'
            ),
        })
        blocks.extend([
            {'block_type': 'products', 'title': 'همراه این محصول', 'data': {'limit': 4}},
            {
                'block_type': 'cta',
                'title': 'برای قیمت عمده تماس بگیرید',
                'text': 'کارشناس فروش، قیمت روز و زمان تحویل را اعلام می‌کند.',
                'link': '/support',
            },
        ])
        self._rewrite_blocks(page, blocks)
        self.stdout.write(
            self.style.SUCCESS(f'صفحه فرود «{page.title}» به‌صورت پیش‌نویس ساخته شد (از پنل منتشر کنید).')
        )
