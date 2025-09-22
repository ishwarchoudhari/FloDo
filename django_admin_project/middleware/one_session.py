"""
OneSessionPerUserMiddleware

Enforces a single active session per Client (portal user).
- If a request carries a session client_id whose session key does not match
  the Client.active_session_key in DB, the middleware force-logs out the user.
- Public/anonymous routes, static/media, and Super-Admin routes are skipped.

Safe, reversible, and guarded with try/except to avoid breaking requests.
"""
from __future__ import annotations
from typing import Callable
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.conf import settings

# Import Client model from apps.dashboard
try:
    from apps.dashboard.models import Client  # type: ignore
except Exception:  # pragma: no cover
    Client = None  # type: ignore


class OneSessionPerUserMiddleware:
    """Middleware to ensure only the stored active session key remains valid.

    Placement: after SessionMiddleware & AuthenticationMiddleware is fine.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        try:
            # Fast-path: if Client model unavailable or no session support, bypass
            if Client is None:
                return self.get_response(request)

            # Skip for static/media and admin routes to avoid loops
            path = request.path or "/"
            if path.startswith("/static/") or path.startswith("/media/"):
                return self.get_response(request)
            # Skip Super-Admin and API routes outside portal
            if path.startswith("/Super-Admin/") or path.startswith("/admin/"):
                return self.get_response(request)

            # Read portal client_id from session (set in client_portal views)
            cid = request.session.get("client_id")
            if not cid:
                return self.get_response(request)

            # Read current session key and enforce match against DB
            current_key = request.session.session_key
            if not current_key:
                # Ensure session has a key (rare case). Save and move on.
                try:
                    request.session.save()
                    current_key = request.session.session_key
                except Exception:
                    return self.get_response(request)

            # Look up client and compare with stored active_session_key
            try:
                client = Client.objects.only("active_session_key").get(client_id=cid)
            except Client.DoesNotExist:
                # Unknown client in session -> flush session
                try:
                    request.session.flush()
                except Exception:
                    request.session.pop("client_id", None)
                    request.session.pop("client_full_name", None)
                # Added: include reason so UI can show a user-friendly toast
                return redirect("client_portal:client_auth")  # No reason for unknown client

            if client.active_session_key and client.active_session_key != current_key:
                # Active session changed elsewhere: invalidate this stale session
                try:
                    request.session.flush()
                except Exception:
                    request.session.pop("client_id", None)
                    request.session.pop("client_full_name", None)
                # Include reason so the UI can show a helpful message
                from django.urls import reverse
                url = reverse("client_portal:client_auth") + "?reason=session_ended"
                return redirect(url)

        except Exception:
            # Never break the request due to middleware errors
            pass

        return self.get_response(request)
