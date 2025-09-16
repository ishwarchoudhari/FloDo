from __future__ import annotations
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from apps.authentication.models import SuperAdmin


class Command(BaseCommand):
    help = "Print the current Django superuser and SuperAdmin record (if any)."

    def handle(self, *args, **options):
        User = get_user_model()
        supers = list(User.objects.filter(is_superuser=True).values("id", "username", "email", "is_active"))
        if not supers:
            self.stdout.write(self.style.WARNING("No Django superuser exists."))
        else:
            self.stdout.write(self.style.SUCCESS("Current Django superuser(s):"))
            for u in supers:
                self.stdout.write(f" - id={u['id']} username={u['username']} email={u['email']} active={u['is_active']}")
        sa = SuperAdmin.objects.select_related("user").first()
        if sa:
            self.stdout.write(self.style.SUCCESS("SuperAdmin row:"))
            self.stdout.write(f" - user_id={sa.user_id} username={sa.user.username} is_super_admin={sa.is_super_admin}")
        else:
            self.stdout.write(self.style.WARNING("No SuperAdmin row found."))
