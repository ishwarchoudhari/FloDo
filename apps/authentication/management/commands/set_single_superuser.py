from __future__ import annotations
import sys
import getpass
from typing import Any
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.authentication.models import SuperAdmin


class Command(BaseCommand):
    help = "Set the sole Django superuser by username. Demotes all others and syncs SuperAdmin."

    def add_arguments(self, parser):
        parser.add_argument("--username", required=True, help="Target username to promote as the ONLY superuser")
        parser.add_argument("--email", help="Email to set when creating a new user (with --create)")
        parser.add_argument("--create", action="store_true", help="Create the user if it does not exist")
        parser.add_argument("--password", help="Optional password when creating a new user (plain text)")
        parser.add_argument("--delete-others", action="store_true", help="Delete all other superusers (instead of demoting)")

    @transaction.atomic
    def handle(self, *args: Any, **options: Any):
        User = get_user_model()
        username = options["username"]
        email = options.get("email")
        do_create = bool(options.get("create"))
        password = options.get("password")
        delete_others = bool(options.get("delete_others"))

        try:
            user = User.objects.filter(username=username).first()
            if not user:
                if not do_create:
                    raise CommandError(
                        f"User '{username}' not found. Use --create to create a new user or provide an existing username."
                    )
                # create user
                if not password:
                    self.stdout.write(self.style.WARNING("No --password provided; you will be prompted now."))
                    try:
                        password = getpass.getpass("Password: ")
                    except Exception:  # pragma: no cover
                        raise CommandError("Failed to read password from input.")
                if not password:
                    raise CommandError("Password is required to create a new superuser.")
                user = User.objects.create_user(username=username, email=email or "", password=password)
                self.stdout.write(self.style.SUCCESS(f"Created user '{username}'."))

            # Promote target
            user.is_superuser = True
            user.is_staff = True
            user.save(update_fields=["is_superuser", "is_staff"])

            # If a password was provided and the user existed, update it
            if password:
                user.set_password(password)
                user.save(update_fields=["password"]) 

            # Demote or delete all others
            others_qs = User.objects.exclude(pk=user.pk).filter(is_superuser=True)
            count_others = others_qs.count()
            if delete_others:
                others_qs.delete()
                self.stdout.write(self.style.WARNING(f"Deleted {count_others} other superuser(s)."))
            else:
                updated = others_qs.update(is_superuser=False)
                if updated:
                    self.stdout.write(self.style.WARNING(f"Demoted {updated} other superuser(s)."))

            # Ensure single SuperAdmin row
            SuperAdmin.objects.get_or_create(user=user, defaults={"is_super_admin": True})
            removed = SuperAdmin.objects.exclude(user=user).delete()
            if removed and isinstance(removed, tuple):
                self.stdout.write(self.style.WARNING(f"Removed {removed[0]} extra SuperAdmin row(s)."))

            self.stdout.write(self.style.SUCCESS(f"'{username}' is now the ONLY Django superuser and SuperAdmin."))
        except CommandError:
            raise
        except Exception as e:
            raise CommandError(str(e))
