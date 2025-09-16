"""
Client Portal activity logging utilities.

- Centralizes creation of ActivityLog entries for client-facing events
- Redacts PII in row_details to avoid leaking raw phone/email
- Broadcasts over Channels 'notifications' group to drive live updates on the dashboard

Safe in development without Redis when settings.USE_INMEMORY_CHANNEL_LAYER is True.
"""
from __future__ import annotations
from typing import Any, Dict, Optional

from django.utils import timezone


def _safe_imports():
    """Lazy imports to avoid circular deps at import time."""
    from asgiref.sync import async_to_sync  # type: ignore
    from channels.layers import get_channel_layer  # type: ignore
    from apps.dashboard.models import ActivityLog  # type: ignore
    from django.contrib.auth.models import User  # type: ignore

    return async_to_sync, get_channel_layer, ActivityLog, User


def _redact(value: Optional[str], kind: str) -> str:
    """Best-effort PII redaction.
    - phone: keep first/last 2 digits if possible
    - email: keep first 2 chars of local part and full domain
    - default: mask fully
    """
    s = (value or "").strip()
    if not s:
        return ""
    if kind == "phone":
        return (s[:2] + "****" + s[-2:]) if len(s) > 4 else "****"
    if kind == "email":
        try:
            user, dom = s.split("@", 1)
            safe_user = (user[:2] + "****") if user else "****"
            return f"{safe_user}@{dom}"
        except Exception:
            return "****"
    return "****"


def log_client_activity(action: str, *, client: Any = None, details: Optional[Dict[str, Any]] = None) -> None:
    """Create a standardized ActivityLog entry and broadcast it.

    Parameters
    - action: e.g. 'CREATE', 'LOGIN', 'LOGOUT', 'FORGOT_PASSWORD', 'PASSWORD_RESET', 'ARTIST_APPLY'
    - client: optional Client instance; if provided, minimal redacted details are included
    - details: additional context dictionary (must be JSON-serializable)

    Defensive:
    - Silently swallow non-critical errors (logging should never block UX)
    - Redact PII
    """
    try:
        async_to_sync, get_channel_layer, ActivityLog, User = _safe_imports()
        row_details: Dict[str, Any] = {}
        if details:
            # Shallow copy to avoid mutating caller data
            row_details.update(details)
        # Include safe client summary
        if client is not None:
            try:
                row_details.setdefault("full_name", getattr(client, "full_name", "") or "")
                row_details.setdefault("phone", _redact(getattr(client, "phone", None), "phone"))
                row_details.setdefault("email", _redact(getattr(client, "email", None), "email"))
            except Exception:
                pass
        # Tag source for auditability (non-breaking)
        row_details.setdefault("source", "portal")
        # Compute a safe integer row_id from client's UUID (or 0 when absent)
        rid = 0
        try:
            cid = getattr(client, "client_id", None)
            if cid is not None and hasattr(cid, "int"):
                # Map to signed 32-bit range for DB IntegerField safety
                rid = int(cid.int % 2147483647)
        except Exception:
            rid = 0

        # Choose a fallback admin_user since ActivityLog.admin_user is non-nullable
        # Prefer a superuser; otherwise any user; as last resort, the earliest user
        admin_user = None
        try:
            admin_user = User.objects.filter(is_superuser=True).order_by("id").first() or User.objects.order_by("id").first()
        except Exception:
            admin_user = None

        if admin_user is not None:
            ActivityLog.objects.create(
                table_name="Client",
                action=action,
                row_id=rid,
                row_details=row_details,
                admin_user=admin_user,
            )
        else:
            # If no User exists yet (rare in dev), skip DB write silently
            return
        # Broadcast (dashboard listens on 'notifications').
        # Strict rule: portal client LOGIN/SIGNUP must NOT appear in notifications dropdown,
        # but MUST remain in Recent Client Activity table. We therefore suppress WebSocket
        # notifications for those actions while keeping the ActivityLog entry above.
        try:
            # Normalize action for robust comparison
            act = (action or "").strip().upper()
            src = (row_details.get("source") or "").strip().lower()
            is_portal = (src == "portal")
            is_login_or_signup = act in {"LOGIN", "CREATE", "SIGNUP"}
            if is_portal and is_login_or_signup:
                # Do not broadcast to bell notifications
                return
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    "notifications",
                    {
                        "type": "notify",
                        "payload": {
                            "table_name": "Client",
                            "action": action,
                            "row_id": getattr(client, "client_id", None),
                            "row_details": row_details,
                            "admin_user": "portal",
                            "timestamp": timezone.now().isoformat(),
                        },
                    },
                )
        except Exception:
            # Non-fatal if Channels is not configured
            pass
    except Exception:
        # Never raise from logging
        pass
