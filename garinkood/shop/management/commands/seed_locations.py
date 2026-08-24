"""Load Iran's provinces and cities into the Location table.

Idempotent: rerunning updates existing rows instead of duplicating them, so the
command is safe to include in a deployment step.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from shop.data.iran_locations import IRAN_PROVINCES
from shop.models import Location
from shop.slugs import slugify_fa


class Command(BaseCommand):
    help = "Seed the Location table with every Iranian province and its cities."

    def add_arguments(self, parser):
        parser.add_argument(
            '--prune',
            action='store_true',
            help='Deactivate locations that are no longer present in the dataset.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        seen_ids = []
        created_provinces = created_cities = 0

        for province_name, cities in IRAN_PROVINCES.items():
            province, created = Location.objects.update_or_create(
                name=province_name,
                parent=None,
                defaults={'kind': 'province', 'slug': slugify_fa(province_name), 'is_active': True},
            )
            created_provinces += int(created)
            seen_ids.append(province.id)

            for city_name in cities:
                city, created = Location.objects.update_or_create(
                    name=city_name,
                    parent=province,
                    defaults={
                        'kind': 'city',
                        # City slugs are prefixed with their province so two
                        # provinces can both contain e.g. "زرند".
                        'slug': slugify_fa(f'{province_name}-{city_name}'),
                        'is_active': True,
                    },
                )
                created_cities += int(created)
                seen_ids.append(city.id)

        if options['prune']:
            stale = Location.objects.exclude(id__in=seen_ids).update(is_active=False)
            self.stdout.write(self.style.WARNING(f'{stale} موقعیت قدیمی غیرفعال شد.'))

        total = Location.objects.filter(is_active=True).count()
        self.stdout.write(self.style.SUCCESS(
            f'{created_provinces} استان و {created_cities} شهر جدید ثبت شد. '
            f'مجموع موقعیت‌های فعال: {total}'
        ))
