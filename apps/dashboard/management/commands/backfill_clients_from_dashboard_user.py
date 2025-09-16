from __future__ import annotations
from django.core.management.base import BaseCommand
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.contrib.auth.hashers import make_password
from apps.dashboard.models import Client, Table2, Table9, Table10


class Command(BaseCommand):
    help = (
        "Backfill Clients from dashboard_user (Table2) non-destructively, and backfill optional client FKs "
        "in bookings (Table9) and messages (Table10) by phone/email."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Only print what would happen.")

    def handle(self, *args, **options):
        dry_run: bool = options.get("dry_run", False)

        created = 0
        skipped = 0
        matched_fk_bookings = 0
        matched_fk_messages = 0

        # Phase 1: Copy dashboard_user -> Client
        users = Table2.objects.all().only("unique_id", "name", "phone", "city")
        total = users.count()
        self.stdout.write(f"Found {total} dashboard_user rows to consider.")

        for u in users:
            full_name = (u.name or "").strip() or "Unknown"
            phone = (u.phone or "").strip()
            email = None  # Table2 has no email column; keep as None initially
            location = (u.city or None)
            password_hash = make_password(None)  # unusable password
            if not phone:
                skipped += 1
                self.stdout.write(f"SKIP (no phone): id={u.unique_id} name='{full_name}'")
                continue
            if dry_run:
                # Simulate uniqueness checks
                dupe = Client.objects.filter(phone=phone).exists()
                if dupe:
                    skipped += 1
                    self.stdout.write(f"SKIP (duplicate phone exists): phone={phone}")
                else:
                    created += 1
                continue
            try:
                Client.objects.get_or_create(
                    phone=phone,
                    defaults={
                        "full_name": full_name,
                        "email": email,
                        "password": password_hash,
                        "location": location,
                        "status": "Active",
                    },
                )
                created += 1
            except IntegrityError:
                skipped += 1
                self.stdout.write(f"SKIP (integrity error, likely duplicate): phone={phone}")

        # Phase 2: Backfill optional client FK on bookings/messages
        # Strategy: match by phone exact; if no phone or no match, try email exact (currently None in backfill).
        # We keep conservative behavior and do not abort on errors.
        if dry_run:
            # Estimate matches by phone
            phones = set(Client.objects.values_list("phone", flat=True))
            matched_fk_bookings = Table9.objects.filter(phone__in=phones).count()
            matched_fk_messages = Table10.objects.filter(phone__in=phones).count()
        else:
            # Bookings
            for b in Table9.objects.exclude(phone__isnull=True).exclude(phone=""):
                client = Client.objects.filter(phone=b.phone).only("client_id").first()
                if client and b.client_id is None:
                    b.client_id = client.client_id
                    try:
                        b.save(update_fields=["client"])
                        matched_fk_bookings += 1
                    except Exception:
                        pass
            # Messages
            for m in Table10.objects.exclude(phone__isnull=True).exclude(phone=""):
                client = Client.objects.filter(phone=m.phone).only("client_id").first()
                if client and m.client_id is None:
                    m.client_id = client.client_id
                    try:
                        m.save(update_fields=["client"])
                        matched_fk_messages += 1
                    except Exception:
                        pass

        # Summary
        self.stdout.write("")
        self.stdout.write("Backfill summary:")
        self.stdout.write(f" - created_clients: {created}")
        self.stdout.write(f" - skipped_clients: {skipped}")
        self.stdout.write(f" - matched_fk_bookings: {matched_fk_bookings}")
        self.stdout.write(f" - matched_fk_messages: {matched_fk_messages}")
        if dry_run:
            self.stdout.write("NOTE: Dry run mode; no database writes were performed.")
