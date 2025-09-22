from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from apps.dashboard.models import Table6 as ArtistApplication, Client


class Command(BaseCommand):
    help = (
        "Backfill dashboard_artist_application.client for existing rows by matching Client "
        "via email (case-insensitive) or phone or name. Dry-run by default."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Persist changes. Without this flag, the command runs in dry-run mode.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=1000,
            help="Max number of applications to process in this run (default: 1000).",
        )
        parser.add_argument(
            "--logfile",
            type=str,
            default="",
            help="Optional path to write ambiguous matches for manual review.",
        )

    def handle(self, *args, **options):
        apply_changes = bool(options.get("apply"))
        limit = int(options.get("limit") or 1000)
        logfile = options.get("logfile") or ""

        ambiguous_log = []
        updated = 0
        examined = 0

        qs = (
            ArtistApplication.objects
            .filter(client__isnull=True)
            .order_by("-created_at")
        )
        total = qs.count()
        self.stdout.write(self.style.NOTICE(f"Applications missing client: {total}"))

        to_process = list(qs[:limit])
        if not to_process:
            self.stdout.write(self.style.SUCCESS("Nothing to process."))
            return

        @transaction.atomic
        def apply_update(app_obj, client_obj):
            app_obj.client = client_obj
            app_obj.save(update_fields=["client", "updated_at"])

        for app in to_process:
            examined += 1
            candidates = []

            email = (app.email or "").strip()
            phone = (app.phone or "").strip()
            name = (app.name or "").strip()

            try:
                if email:
                    # Case-insensitive exact match for email
                    match = Client.objects.filter(email__iexact=email)
                    for c in match:
                        candidates.append(("email", c))
                if phone:
                    match = Client.objects.filter(phone=phone)
                    for c in match:
                        candidates.append(("phone", c))
                # As a last resort, name equality. This can be noisy, so only accept if exactly one unique client.
                if name:
                    match = Client.objects.filter(full_name__iexact=name)
                    for c in match:
                        candidates.append(("name", c))
            except Exception as e:
                self.stderr.write(self.style.WARNING(f"Lookup failed for application #{app.pk}: {e}"))
                continue

            # Deduplicate candidate clients, preferring email > phone > name
            ranked = []
            seen_ids = set()
            for source in ("email", "phone", "name"):
                for s, c in candidates:
                    if s == source and c.client_id not in seen_ids:
                        ranked.append((s, c))
                        seen_ids.add(c.client_id)

            if not ranked:
                continue

            # If more than one unique client remains, log as ambiguous
            unique_clients = {c.client_id for _, c in ranked}
            if len(unique_clients) > 1:
                ambiguous_log.append({
                    "application_id": app.pk,
                    "artist_application_id": str(app.artist_application_id or ""),
                    "email": email,
                    "phone": phone,
                    "name": name,
                    "candidates": [str(cid) for cid in unique_clients],
                })
                continue

            # Exactly one client
            client_obj = ranked[0][1]
            self.stdout.write(f"Linking application #{app.pk} -> client {client_obj.client_id} ({client_obj.full_name})")
            if apply_changes:
                try:
                    apply_update(app, client_obj)
                    updated += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Failed to update application #{app.pk}: {e}"))

        # Write ambiguous if requested
        if logfile and ambiguous_log:
            try:
                import json, os
                os.makedirs(os.path.dirname(logfile) or ".", exist_ok=True)
                with open(logfile, "w", encoding="utf-8") as fh:
                    json.dump(ambiguous_log, fh, indent=2)
                self.stdout.write(self.style.NOTICE(f"Ambiguous matches written to {logfile}"))
            except Exception as e:
                self.stderr.write(self.style.WARNING(f"Could not write logfile {logfile}: {e}"))

        self.stdout.write(self.style.SUCCESS(
            f"Examined: {examined}, Updated: {updated}, Ambiguous: {len(ambiguous_log)}, Dry-run: {not apply_changes}"
        ))
