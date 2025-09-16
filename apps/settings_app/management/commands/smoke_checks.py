from __future__ import annotations
from django.core.management.base import BaseCommand, CommandError
from django.test import Client


class Command(BaseCommand):
    help = (
        "Run lightweight smoke checks: GET /admin/login/ and GET /portal/ (read-only). "
        "Exits non-zero on failure."
    )

    def add_arguments(self, parser):
        parser.add_argument("--print-bodies", action="store_true", help="Print short response bodies for debugging")

    def handle(self, *args, **options):
        client = Client()
        failures: list[str] = []
        print_bodies = bool(options.get("print_bodies"))

        checks = [
            ("/admin/login/", 200),
            ("/portal/", 200),
        ]

        for path, expected in checks:
            # Force host header to avoid DisallowedHost('testserver') in some envs
            resp = client.get(path, follow=False, HTTP_HOST="localhost")
            status = resp.status_code
            ok = status == expected or (path == "/admin/login/" and status in (200, 302))
            # Some environments may redirect admin login; accept 200 or 302 for admin.
            if ok:
                self.stdout.write(self.style.SUCCESS(f"OK  {path} -> {status}"))
                if print_bodies:
                    body = (resp.content or b"").decode(errors="ignore")
                    self.stdout.write(body[:500])
            else:
                msg = f"FAIL {path} -> {status} (expected {expected})"
                self.stderr.write(self.style.ERROR(msg))
                failures.append(msg)

        if failures:
            raise CommandError("; ".join(failures))
        self.stdout.write(self.style.SUCCESS("Smoke checks passed."))
