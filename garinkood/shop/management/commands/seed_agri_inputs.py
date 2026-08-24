"""Load the fertiliser/pesticide reference doses used by the calculator.

Idempotent: rows are matched on their slug and updated in place, so rerunning
after a data correction fixes the existing records instead of duplicating them.
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from shop.data.agri_inputs import AGRI_INPUTS
from shop.models import AgriInput, AgriInputDose
from shop.slugs import slugify_fa


class Command(BaseCommand):
    help = "Seed agricultural inputs and their registered dose rates."

    @transaction.atomic
    def handle(self, *args, **options):
        created_inputs = created_doses = 0

        for entry in AGRI_INPUTS:
            agri_input, created = AgriInput.objects.update_or_create(
                slug=slugify_fa(entry['name']),
                defaults={
                    'name': entry['name'],
                    'kind': entry['kind'],
                    'active_ingredient': entry.get('active_ingredient', ''),
                    'formulation': entry.get('formulation', ''),
                    'unit': entry.get('unit', 'کیلوگرم'),
                    'safety_notes': entry.get('safety_notes', ''),
                    'preharvest_interval_days': entry.get('preharvest_interval_days'),
                    'is_active': True,
                },
            )
            created_inputs += int(created)

            for crop, target, basis, min_rate, max_rate, rate_unit, notes in entry['doses']:
                _, dose_created = AgriInputDose.objects.update_or_create(
                    agri_input=agri_input,
                    crop_name=crop,
                    target=target,
                    basis=basis,
                    defaults={
                        'min_rate': Decimal(str(min_rate)),
                        'max_rate': Decimal(str(max_rate)),
                        'rate_unit': rate_unit,
                        'notes': notes,
                    },
                )
                created_doses += int(dose_created)

        self.stdout.write(self.style.SUCCESS(
            f'{created_inputs} نهاده و {created_doses} دوز جدید ثبت شد. '
            f'مجموع نهاده‌های فعال: {AgriInput.objects.filter(is_active=True).count()} '
            f'و مجموع دوزها: {AgriInputDose.objects.count()}'
        ))
