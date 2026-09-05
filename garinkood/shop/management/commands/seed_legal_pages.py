"""Publish the site's legal documents as editable pages.

The text ships with the code (``shop/legal.py``) so a fresh deployment already
answers a buyer, and this command copies it into ``SitePage`` so the team can
edit the wording from the admin panel without a deploy. It is safe to run
repeatedly: existing blocks are never overwritten unless ``--force`` is passed,
because an admin's careful edit must not be erased by a routine seed run.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from shop import legal
from shop.models import SitePage, SitePageBlock


class Command(BaseCommand):
    help = 'ساخت صفحات حقوقی (قوانین، حریم خصوصی، بازگشت کالا و بقیه) در بخش «صفحات سایت».'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='بلوک‌های موجود را با متن پیش‌فرض بازنویسی کن (ویرایش پنل از می‌رود).',
        )
        parser.add_argument('--dry-run', action='store_true', help='فقط گزارش بده؛ چیزی ننویس.')

    @transaction.atomic
    def handle(self, *args, **options):
        force = options['force']
        dry = options['dry_run']
        talkative = options['verbosity'] > 0

        def say(message, style=None):
            if talkative:
                self.stdout.write(style(message) if style else message)
        created_pages = 0
        written_blocks = 0
        skipped = 0

        for doc in legal.documents():
            page = SitePage.objects.filter(slug=doc.slug).first()
            if page is None:
                created_pages += 1
                if dry:
                    say(f'خواهد ساخت: {doc.title}')
                    continue
                page = SitePage.objects.create(
                    slug=doc.slug,
                    kind=SitePage.KIND_PAGE,
                    title=doc.title,
                    hero_text=doc.summary,
                    badge='حقوقی',
                    published=True,
                    seo_title=doc.title[:70],
                    seo_description=doc.summary[:170],
                )
            elif not page.published:
                # Drafting in the admin is legitimate; the seeder only reports it.
                say(f'منتشر نشده: {doc.title}', self.style.WARNING)

            existing = SitePageBlock.objects.filter(page=page)
            if existing.exists() and not force:
                skipped += existing.count()
                continue

            blocks = [
                {
                    'block_type': 'text',
                    'title': heading,
                    'text': body,
                    'position': (index + 1) * 10,
                }
                for index, (heading, body) in enumerate(doc.sections)
            ]
            written_blocks += len(blocks)
            if dry:
                continue
            existing.delete()
            SitePageBlock.objects.bulk_create([SitePageBlock(page=page, **block) for block in blocks])

        say(
            f'{created_pages} صفحه و {written_blocks} بلوک حقوقی ثبت شد؛ '
            f'{skipped} بلوک موجود دست‌نخورده ماند.',
            self.style.SUCCESS,
        )
        say(f'نسخه متن پس از این اجرا: {legal.legal_version()}')
