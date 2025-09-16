from __future__ import annotations
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.authentication.models import SuperAdmin


class Command(BaseCommand):
    help = (
        "Sync Django User flags for SuperAdmins: set is_superuser=True and is_staff=True "
        "for all users linked to apps.authentication.models.SuperAdmin."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing to the database.",
        )
        parser.add_argument(
            "--unset",
            action="store_true",
            help="Revert flags (set is_superuser=False and/or is_staff=False) for users linked to SuperAdmin. Use with caution.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run: bool = options.get("dry_run", False)
        unset: bool = options.get("unset", False)

        count = 0
        changed = 0
        details: list[str] = []

        for sa in SuperAdmin.objects.select_related("user"):
            count += 1
            user = sa.user
            before = (user.is_superuser, user.is_staff)
            if unset:
                new_is_superuser = False
                new_is_staff = False
            else:
                new_is_superuser = True
                new_is_staff = True

            if user.is_superuser != new_is_superuser or user.is_staff != new_is_staff:
                changed += 1
                details.append(
                    f"{user.username}: is_superuser {user.is_superuser} -> {new_is_superuser}, "
                    f"is_staff {user.is_staff} -> {new_is_staff}"
                )
                if not dry_run:
                    user.is_superuser = new_is_superuser
                    user.is_staff = new_is_staff
                    user.save(update_fields=["is_superuser", "is_staff"])

        summary = (
            f"SuperAdmin sync complete. total_superadmins={count}, "
            f"changed={changed}, dry_run={dry_run}, unset={unset}"
        )
        self.stdout.write(summary)
        if details:
            self.stdout.write("\nChanged users:")
            for line in details:
                self.stdout.write(f" - {line}")

        if dry_run:
            self.stdout.write("\nNo changes were written due to --dry-run.")
