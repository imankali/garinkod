"""Run the durable transactional messaging worker."""

import time

from django.core.management.base import BaseCommand

from shop.messaging.worker import process_due_deliveries


class Command(BaseCommand):
    help = 'ارسال پیام‌های در صف با تلاش مجدد محدود و ثبت تاریخچه'

    def add_arguments(self, parser):
        parser.add_argument(
            '--watch',
            action='store_true',
            help='پس از خالی شدن صف، منتظر بمان و پردازش را ادامه بده.',
        )
        parser.add_argument('--interval', type=float, default=3.0, help='فاصله polling بر حسب ثانیه')
        parser.add_argument('--limit', type=int, default=100, help='حداکثر ردیف در هر نوبت')

    def handle(self, *args, **options):
        watch = options['watch']
        interval = max(options['interval'], 0.25)
        limit = min(max(options['limit'], 1), 1000)
        self.stdout.write(self.style.SUCCESS('Messaging outbox worker started.'))
        while True:
            processed = process_due_deliveries(limit=limit)
            if processed:
                self.stdout.write(f'Processed {processed} notification(s).')
            if not watch:
                break
            time.sleep(interval)
