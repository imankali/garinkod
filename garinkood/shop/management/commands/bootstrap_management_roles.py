from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

from shop.management_roles import ROLE_PERMISSIONS


class Command(BaseCommand):
    help = "Create/update the standard GarinKood management groups and permissions."

    def handle(self, *args, **options):
        for role_name, codenames in ROLE_PERMISSIONS.items():
            group, _ = Group.objects.get_or_create(name=role_name)
            permissions = Permission.objects.filter(codename__in=codenames)
            group.permissions.set(permissions)
            missing = sorted(set(codenames) - set(permissions.values_list('codename', flat=True)))
            self.stdout.write(self.style.SUCCESS(f"{role_name}: {permissions.count()} permission(s) assigned"))
            if missing:
                self.stdout.write(self.style.WARNING(f"  Missing permissions: {', '.join(missing)}"))
