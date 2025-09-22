from __future__ import annotations

def _kill_session(session_key: str) -> None:
    """Low-level: remove a session by key regardless of backend (DB/cache/file).

    Uses the configured SESSION_ENGINE's SessionStore API.
    """
    if not session_key:
        return
    try:
        engine = import_module(settings.SESSION_ENGINE)  # Added
        store = engine.SessionStore(session_key)  # Added
        store.delete()  # Added: delete session by key
    except Exception:
        # Do not propagate errors; best-effort cleanup only
        pass


def _enforce_single_session(request: HttpRequest, client: dm.Client) -> None:
    """Ensure the client has only one active session.

    - If client.active_session_key exists and is different from current, kill the old session.
    - Save the current session key as active_session_key on the client.
    """
    try:
        current_key = request.session.session_key or ""
        old_key = getattr(client, "active_session_key", None) or ""
        if old_key and old_key != current_key:
            _kill_session(old_key)  # Added: invalidate previous session
            try:
                # Added: log a concurrent-login invalidation (no PII beyond client_id)
                logging.getLogger("security.session").warning(
                    "Concurrent session invalidated for client_id=%s", str(client.client_id)
                )
            except Exception:
                pass
        if current_key and old_key != current_key:
            dm.Client.objects.filter(pk=client.pk).update(active_session_key=current_key)  # Added: atomic DB update
    except Exception:
        pass

# Added: conservative honeypot logging with per-IP throttling (max 3 logs/minute per IP).
def _honeypot_log(request: HttpRequest) -> None:
    """Security: Record a minimal log entry when the hidden honeypot field is tripped.

    Notes:
    - Logs only IP and path (no PII).
    - Throttled via the default cache to at most 3 entries per IP per minute.
    - Never raises; never alters normal flow for legitimate users.
    """
    try:
        # Extract a best-effort client IP without storing PII beyond IP (no headers recorded).
        ip = (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0] or request.META.get("REMOTE_ADDR") or "?")  # Added
        path = request.path  # Added: endpoint path only (no query/body to avoid PII)
        cache = caches["default"]  # Added: use default cache for throttling
        # Build a throttle key scoped by minute window and IP.  # Added
        window = timezone.now().strftime("%Y%m%d%H%M")  # Added: current minute bucket
        key = f"hp_log:{ip}:{window}"  # Added
        try:
            count = int(cache.get(key) or 0)  # Added
        except Exception:
            count = 0  # Added
        if count < 3:  # Added: log at most 3 entries per IP per minute
            logging.getLogger("security.honeypot").warning("Honeypot hit: ip=%s path=%s", ip, path)  # Added
            try:
                cache.set(key, count + 1, timeout=70)  # Added: ~1 minute window
            except Exception:
                pass  # Added: never raise from logging
    except Exception:
        # Never allow logging to break request flow.  # Added
        pass
def _normalize_phone(val: str | None) -> str:
    """Normalize a phone input by trimming whitespace. No formatting is assumed."""
    return (val or "").strip()


def _normalize_email(val: str | None) -> str | None:
    """Normalize an email input by trimming whitespace and lowercasing."""
    s = (val or "").strip()
    return s.lower() if s else None


def _password_policy_ok(pw: str) -> bool:
    """Server-side password policy: >=8 chars, letters, digits, and a special char.

    This complements Django's validators and ensures parity for portal flows.
    """
    try:
        s = pw or ""
        if len(s) < 8:
            return False
        import re as _re
        has_letter = bool(_re.search(r"[A-Za-z]", s))
        has_digit = bool(_re.search(r"\d", s))
        has_special = bool(_re.search(r"[^A-Za-z0-9]", s))
        return has_letter and has_digit and has_special
    except Exception:
        return False

# pyright: reportMissingImports=false
from django.shortcuts import render, redirect
from django.http import HttpRequest, HttpResponse, Http404, JsonResponse
from django.db import transaction
from django.contrib.auth.models import AnonymousUser
from django.core.paginator import Paginator
from django.utils import timezone
from apps.dashboard import models as dm
from apps.settings_app.models import AppSettings
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.hashers import make_password, check_password
from django.core import signing
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.utils import IntegrityError
from django.urls import reverse
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .logging import log_client_activity  # centralized client activity logging (redacts PII, broadcasts)
from types import SimpleNamespace
import logging  # Added: for conservative security logging of honeypot hits
from django.core.cache import caches  # Added: lightweight per-IP throttle for honeypot logs
from importlib import import_module  # Added: to access session store backend generically
try:  # optional: production-only per-IP rate limiting
    from ratelimit.decorators import ratelimit as rl_decorator  # type: ignore
except Exception:  # safe no-op fallback if not installed
    def rl_decorator(*args, **kwargs):
        def _wrap(f):
            return f
        return _wrap

# Public Client Portal (no authentication). Uses existing dashboard tables.
# SOC: templates render-only; all logic lives here.


def _records_per_page() -> int:
    """Read preferred page size from AppSettings, falling back to a safe default."""
    try:
        s = AppSettings.objects.order_by("-updated_at").first()
        if s and int(s.records_per_page) > 0:
            return int(s.records_per_page)
    except Exception:
        pass
    return 20


def _visitor_fp(request: HttpRequest) -> str:
    """Anonymous visitor fingerprint for non-auth pages (derived from session key)."""
    try:
        if not request.session.session_key:
            request.session.save()
        return f"anon-{request.session.session_key}"
    except Exception:
        return "anon-unknown"


def portal_home(request: HttpRequest) -> HttpResponse:
    """Public landing page for the client portal (no authentication)."""
    fp = _visitor_fp(request)
    has_application = dm.Table6.objects.filter(name=fp).exists()
    is_verified_artist = dm.Table3.objects.filter(name=fp).exists()
    return render(request, "client_portal/home.html", {
        "has_application": has_application,
        "is_verified_artist": is_verified_artist,
    })


def customer_dashboard(request: HttpRequest) -> HttpResponse:
    """Public customer dashboard showing recent bookings for the fingerprint."""
    fp = _visitor_fp(request)
    recent = dm.Table9.objects.filter(name=fp).order_by("-created_at")[:10]
    return render(request, "client_portal/customer_dashboard.html", {"recent_bookings": recent})


def browse_artists(request: HttpRequest) -> HttpResponse:
    """Browse artists with basic query, city, service filters (no authentication)."""
    q = (request.GET.get("q") or "").strip()
    city = (request.GET.get("city") or "").strip()
    svc = (request.GET.get("service") or "").strip()
    qs = dm.Table3.objects.all().order_by("name")
    if q:
        qs = qs.filter(name__icontains=q)
    if city:
        qs = qs.filter(city__icontains=city)
    if svc:
        svc_names = dm.Table5.objects.filter(name__icontains=svc).values_list("name", flat=True)
        qs = qs.filter(name__in=list(svc_names))
    paginator = Paginator(qs, _records_per_page())
    page_obj = paginator.get_page(request.GET.get("page") or 1)
    return render(request, "client_portal/browse_artists.html", {
        "page_obj": page_obj, "q": q, "city": city, "service": svc
    })


@transaction.atomic
def _can_current_client_apply(request: HttpRequest) -> bool:
    """Return True if the logged-in client can submit a new artist application.

    Policy: One application per client unless super-admin sets Client.allow_reapply=True.
    We check by session Client, and correlate existing applications by phone/email/name.
    """
    try:
        _require_client_auth_enabled()
        client = _current_client(request)
        if not client:
            return False
        # If override is enabled, allow applying
        if getattr(client, "allow_reapply", False):
            return True
        # Find any prior application by correlating on phone/email/name fingerprint
        fp = _visitor_fp(request)
        name_hints = [fp]
        try:
            if client.full_name:
                name_hints.append(client.full_name)
        except Exception:
            pass
        from django.db.models import Q
        cond = Q()
        try:
            if getattr(client, "phone", None):
                cond |= Q(phone=client.phone)
        except Exception:
            pass
        try:
            if getattr(client, "email", None):
                cond |= Q(email=client.email)
        except Exception:
            pass
        for n in name_hints:
            cond |= Q(name=n)
        exists = dm.Table6.objects.filter(cond).exists()
        return not exists
    except Exception:
        # Fail closed to status page on any unexpected error
        return False


def artist_apply(request: HttpRequest) -> HttpResponse:
    """Authenticated clients can submit an artist application (Table6 + certificates)."""
    # Require client login
    if not _current_client(request):
        return redirect("client_portal:client_auth")
    fp = _visitor_fp(request)
    # If already verified or already applied, show status
    if dm.Table3.objects.filter(name=fp).exists():
        return redirect("client_portal:artist_dashboard")
    # Guard form availability by server policy
    can_apply = _can_current_client_apply(request)
    if request.method == "GET" and not can_apply:
        messages.info(request, "Your previous application is under review or complete. You cannot reapply unless approved by admin.")
        return redirect("client_portal:artist_application_status")
    # Prefill initial values from client profile
    initial = {}
    try:
        cli = _current_client(request)
        if cli:
            initial = {
                "email": getattr(cli, "email", "") or "",
                "phone": getattr(cli, "phone", "") or "",
                "city": getattr(cli, "location", "") or "",
            }
    except Exception:
        initial = {}
    if request.method == "POST":
        # Collect fields
        city = (request.POST.get("city") or "").strip() or "Unknown"
        phone = (request.POST.get("phone") or "").strip() or ""
        email = (request.POST.get("email") or "").strip()
        try:
            years_experience = int((request.POST.get("years_experience") or "0").strip() or 0)
        except ValueError:
            years_experience = 0
        # New optional metadata fields (sanitize inputs)
        gender = (request.POST.get("gender") or "").strip() or None
        dob_raw = (request.POST.get("dob") or "").strip()
        from datetime import datetime
        dob = None
        if dob_raw:
            try:
                dob = datetime.strptime(dob_raw, "%Y-%m-%d").date()
            except Exception:
                dob = None
        specialization = (request.POST.get("specialization") or "").strip() or None
        beauty_studio_location = (request.POST.get("beauty_studio_location") or "").strip() or None
        additional_notes = (request.POST.get("additional_notes") or "").strip() or None
        reapply_reason = (request.POST.get("reapply_reason") or "").strip() or None
        instagram_url = (request.POST.get("instagram_url") or "").strip() or None
        instagram_username = (request.POST.get("instagram_username") or "").strip() or None
        if instagram_url and not (instagram_url.startswith("http://") or instagram_url.startswith("https://")):
            instagram_url = None

        # Derive user-aware identity
        user = request.user if getattr(request, "user", None) and not isinstance(request.user, AnonymousUser) and request.user.is_authenticated else None
        name = (getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "") or fp).strip() or fp
        if not phone and user and hasattr(user, "profile"):
            try:
                phone = getattr(user.profile, "phone", "") or phone
            except Exception:
                pass

        # Enforce server policy just before create
        if not _can_current_client_apply(request):
            try:
                logging.getLogger("security.application").warning("Duplicate or unauthorized artist application attempt")
            except Exception:
                pass
            return redirect("client_portal:artist_application_status")
        app = dm.Table6.objects.create(
            name=name,
            city=city,
            phone=phone,
            email=email or (getattr(user, "email", None) or ""),
            years_experience=max(0, years_experience),
            user=user,
            application_status="pending",
            approved=False,
            client=_current_client(request) or None,
            gender=gender,
            dob=dob,
            specialization=specialization,
            instagram_url=instagram_url,
            instagram_username=instagram_username,
            beauty_studio_location=beauty_studio_location,
            additional_notes=additional_notes,
            reapply_reason=reapply_reason,
        )
        # Profile picture (optional): save to model and also record in certificate table as profile_picture
        try:
            ppic = request.FILES.get("profile_picture")
            if ppic:
                app.profile_picture = ppic
                app.save(update_fields=["profile_picture", "updated_at"])  # safe partial update
                try:
                    dm.ArtistApplicationCertificate.objects.create(application=app, file=ppic, category='profile_picture', uploaded_by_client=_current_client(request))
                except Exception:
                    pass
        except Exception:
            pass

        # Reset one-shot override if it was used
        try:
            client = _current_client(request)
            if client and getattr(client, "allow_reapply", False):
                dm.Client.objects.filter(pk=client.pk).update(allow_reapply=False)
        except Exception:
            pass
        # Certificates (multiple)
        files = request.FILES.getlist("certificates")[:10]
        for f in files:
            try:
                dm.ArtistApplicationCertificate.objects.create(application=app, file=f, category='certificate', uploaded_by_client=_current_client(request))
            except Exception:
                # ignore invalid files; validation occurs in model validators
                pass
        # Supporting pictures (multiple)
        sup = request.FILES.getlist("supporting_pictures")[:10]
        for f in sup:
            try:
                dm.ArtistApplicationCertificate.objects.create(application=app, file=f, category='supporting_picture', uploaded_by_client=_current_client(request))
            except Exception:
                pass
        # Client activity record: include applicant's name with PII redaction via helper
        try:
            pseudo_client = SimpleNamespace(full_name=name, phone=phone, email=email or (getattr(user, "email", None) or ""))
            log_client_activity("ARTIST_APPLY", client=pseudo_client, details={"application_id": app.id, "cert_count": len(files)})
        except Exception:
            pass
        return redirect("client_portal:artist_application_status")
    return render(request, "client_portal/artist_apply.html", {"initial": initial})


def artist_application_status(request: HttpRequest) -> HttpResponse:
    """Public status view keyed by visitor fingerprint (legacy heuristic)."""
    fp = _visitor_fp(request)
    if dm.Table3.objects.filter(name=fp).exists():
        status = "approved"
    elif dm.Table6.objects.filter(name=fp).exists():
        status = "pending"
    else:
        status = "not_applied"
    return render(request, "client_portal/artist_application_status.html", {"status": status})


def client_api_can_apply(request: HttpRequest) -> JsonResponse:
    """API: Return whether the current client may submit a new artist application.

    Auth required (client session). Returns { ok, can_apply }.
    """
    _require_client_auth_enabled()
    cid = request.session.get("client_id")
    if not cid:
        return JsonResponse({"ok": False, "error": "Unauthorized"}, status=401)
    return JsonResponse({"ok": True, "can_apply": bool(_can_current_client_apply(request))})


def artist_dashboard(request: HttpRequest) -> HttpResponse:
    """Authenticated artist dashboard (requires verified status by fingerprint)."""
    fp = _visitor_fp(request)
    if not dm.Table3.objects.filter(name=fp).exists():
        return redirect("client_portal:artist_application_status")
    upcoming = dm.Table9.objects.filter(city__icontains=fp).order_by("created_at")[:10]
    services = dm.Table5.objects.filter(name=fp).order_by("-updated_at")[:10]
    today = timezone.now().date()
    calendar_items = dm.Table8.objects.filter(created_at__date=today).order_by("created_at")[:10]
    return render(request, "client_portal/artist_dashboard.html", {
        "upcoming": upcoming,
        "services": services,
        "calendar_items": calendar_items,
    })


# -----------------------------
# Feature-flagged Client Auth
# -----------------------------

def _client_auth_enabled() -> bool:
    """Feature flag: enable client auth portal when configured/allowed."""
    return getattr(settings, "FEATURE_CLIENT_AUTH", False)


def _require_client_auth_enabled():
    """Guard views behind FEATURE_CLIENT_AUTH; raise 404 when disabled."""
    if not _client_auth_enabled():
        raise Http404()


def _current_client(request: HttpRequest):
    """Return the current logged-in Client instance from session, if any."""
    cid = request.session.get("client_id")
    if not cid:
        return None
    try:
        return dm.Client.objects.only("client_id", "full_name").get(client_id=cid)
    except dm.Client.DoesNotExist:
        return None


# -----------------------------
# Internal helpers (DRY; no route/behavior changes)
# -----------------------------

def _finalize_client_login(request: HttpRequest, client: dm.Client) -> None:
    """Shared login finalization for page/API:

    - Rotates session key (cycle_key) to mitigate fixation.
    - Stores client_id and client_full_name in the session.
    - Writes ClientLog('LOGIN') and ActivityLog via helper.
    - Fully exception-safe (never breaks the UX).
    """
    try:
        request.session.cycle_key()  # rotate to mitigate fixation
    except Exception:
        pass
    # Added: ensure session has a key; required for single-session enforcement
    try:
        if not request.session.session_key:
            request.session.save()  # Added: forces creation of session_key
    except Exception:
        pass
    request.session["client_id"] = str(client.client_id)
    request.session["client_full_name"] = client.full_name or ""

    # Added: single-session enforcement — kill old session and save the new active key
    try:
        _enforce_single_session(request, client)  # Added
    except Exception:
        # Never break login flow due to enforcement errors
        pass
    try:
        dm.ClientLog.objects.create(client=client, action="LOGIN")
    except Exception:
        pass
    try:
        log_client_activity("LOGIN", client=client)
    except Exception:
        pass


def _authenticate_client(identifier: str, password: str):
    """Shared authentication: accepts phone or email, validates password & status."""
    if not identifier or not password:
        return None
    ident = (identifier or "").strip()
    if "@" in ident:
        client = dm.Client.objects.filter(email=ident.lower()).first()
    else:
        client = dm.Client.objects.filter(phone=ident).first()
    if client and check_password(password, client.password) and client.status == "Active":
        return client
    return None


def _create_client(full_name: str, phone: str, email: str | None, password: str, location: str | None):
    """Shared client creation with safe hashing and unified logging."""
    client = dm.Client.objects.create(
        full_name=full_name,
        phone=phone,
        email=(email.lower() if email else None),
        password=make_password(password),
        location=location,
        status="Active",
    )
    try:
        dm.ClientLog.objects.create(client=client, action="CREATE", details={"full_name": full_name, "phone": phone})
    except Exception:
        pass
    try:
        log_client_activity("CREATE", client=client)
    except Exception:
        pass
    return client


@rl_decorator(key="ip", rate="5/m", block=True)
def client_signup(request: HttpRequest) -> HttpResponse:
    """Page endpoint: create a client account (POST) and auto-login on success.

    GET redirects to the unified auth surface. Honeypot tripping is silently
    redirected without side effects.
    """
    _require_client_auth_enabled()
    # Redirect unified experience
    if request.method == "GET":
        return redirect("client_portal:client_auth")
    if request.method == "POST":
        # Honeypot anti-bot: silently drop if hidden field is filled
        if (request.POST.get("hp_company") or "").strip():  # honeypot field
            _honeypot_log(request)  # Added: conservative logging of bot trip
            return redirect("client_portal:client_auth")  # no message; silent redirect
        full_name = (request.POST.get("full_name") or "").strip()
        phone = _normalize_phone(request.POST.get("phone"))
        email = _normalize_email(request.POST.get("email"))
        password = (request.POST.get("password") or "").strip()
        location = (request.POST.get("location") or "").strip() or None
        if not full_name or not phone or not password:
            messages.error(request, "Full name, phone, and password are required.")
        elif not _password_policy_ok(password):
            messages.error(request, "Password must be at least 8 characters and include letters, numbers, and a special character.")
        else:
            # Pre-validate duplicates for clearer feedback
            if dm.Client.objects.filter(phone=phone).exists():
                messages.error(request, "An account with this phone already exists. Try logging in.")
            elif email and dm.Client.objects.filter(email=email).exists():
                messages.error(request, "An account with this email already exists. Try logging in.")
            else:
                try:
                    client = _create_client(full_name, phone, email, password, location)
                    _finalize_client_login(request, client)  # auto-login after signup
                    messages.success(request, "Account created and you are now logged in.")
                    return redirect("client_portal:customer_dashboard")
                except IntegrityError:
                    messages.error(request, "Could not create account. Phone or email may already exist.")
                except Exception:
                    messages.error(request, "Could not create account due to a server error. Please try again.")
    return render(request, "client_portal/client_signup.html")


@rl_decorator(key="ip", rate="5/m", block=True)
def client_login(request: HttpRequest) -> HttpResponse:
    """Page endpoint: authenticate an existing client and establish a session."""
    _require_client_auth_enabled()
    # Redirect unified experience
    if request.method == "GET":
        return redirect("client_portal:client_auth")
    if request.method == "POST":
        # Honeypot anti-bot: silently drop if hidden field is filled
        if (request.POST.get("hp_company") or "").strip():  # honeypot field
            _honeypot_log(request)  # Added: conservative logging of bot trip
            return redirect("client_portal:client_auth")  # silent redirect; no session changes
        identifier = (request.POST.get("identifier") or "").strip()
        password = (request.POST.get("password") or "").strip()
        client = _authenticate_client(identifier, password)
        if client:
            _finalize_client_login(request, client)
            return redirect("client_portal:customer_dashboard")
        messages.error(request, "Invalid credentials or inactive account.")
    return render(request, "client_portal/client_login.html")


def client_profile(request: HttpRequest) -> HttpResponse:
    """Render the logged-in client's profile (masked PII)."""
    _require_client_auth_enabled()
    # Require client login, render read-only profile card (no sensitive data)
    cid = request.session.get("client_id")
    if not cid:
        return redirect("client_portal:client_auth")
    try:
        client = dm.Client.objects.get(client_id=cid)
    except dm.Client.DoesNotExist:
        return redirect("client_portal:client_auth")
    # Prepare masked/derived fields to avoid Python expressions in templates
    def _mask_phone(val: str | None) -> str:
        try:
            s = (val or "").strip()
            if not s:
                return ""
            return (s[:2] + "****" + s[-2:]) if len(s) > 4 else "****"
        except Exception:
            return ""
    def _mask_email(val: str | None) -> str:
        try:
            s = (val or "").strip()
            if not s:
                return ""
            local, domain = s.split("@", 1)
            safe_local = (local[:2] + "****") if local else "****"
            return f"{safe_local}@{domain}" if domain else s
        except Exception:
            return "****"
    ctx = {
        "client": client,
        "safe_phone": _mask_phone(getattr(client, "phone", None)),
        "safe_email": _mask_email(getattr(client, "email", None)),
    }
    # Render profile page using portal base layout
    return render(request, "client_portal/client_profile.html", ctx)


def client_api_profile(request: HttpRequest) -> JsonResponse:
    """API: return the logged-in client's profile (PII redacted) as JSON.

    Notes:
    - Requires client auth (session). Returns 401 JSON if not authenticated.
    - Read-only. Safe for AJAX fetch to hydrate the profile page without reloads.
    """
    _require_client_auth_enabled()  # Added: enforce feature flag
    cid = request.session.get("client_id")  # Added: read session
    if not cid:  # Added: unauthenticated
        return JsonResponse({"ok": False, "error": "Unauthorized"}, status=401)  # Added
    try:
        client = dm.Client.objects.get(client_id=cid)  # Added: fetch client
    except dm.Client.DoesNotExist:
        return JsonResponse({"ok": False, "error": "Unauthorized"}, status=401)  # Added

    # Added: server-side masking (reuse simple logic)
    def _mask_phone(val: str | None) -> str:
        try:
            s = (val or "").strip()
            if not s:
                return ""
            return (s[:2] + "****" + s[-2:]) if len(s) > 4 else "****"
        except Exception:
            return ""
    def _mask_email(val: str | None) -> str:
        try:
            s = (val or "").strip()
            if not s:
                return ""
            local, domain = s.split("@", 1)
            safe_local = (local[:2] + "****") if local else "****"
            return f"{safe_local}@{domain}" if domain else s
        except Exception:
            return "****"

    # Added: shape safe JSON
    data = {
        "full_name": client.full_name or "",
        "phone": _mask_phone(getattr(client, "phone", None)),
        "email": _mask_email(getattr(client, "email", None)),
        "location": client.location or "",
        "status": client.status or "",
        "created_at": client.created_at.isoformat() if getattr(client, "created_at", None) else None,
    }
    return JsonResponse({"ok": True, "profile": data})  # Added

def client_logout(request: HttpRequest) -> HttpResponse:
    """Logout the current client, flush session, and redirect to portal home."""
    _require_client_auth_enabled()
    client = _current_client(request)
    if client:
        dm.ClientLog.objects.create(client=client, action="LOGOUT")
        try:
            log_client_activity("LOGOUT", client=client)
        except Exception:
            pass
    try:
        # Added: clear active_session_key in DB for this client (best-effort)
        try:
            if client:
                dm.Client.objects.filter(pk=client.pk).update(active_session_key=None)  # Added
        except Exception:
            pass
        # Fully clear and regenerate session
        request.session.flush()
    except Exception:
        # Fallback if flush unavailable
        request.session.pop("client_id", None)
        request.session.pop("client_full_name", None)
    messages.success(request, "Logged out.")
    return redirect("client_portal:home")


def client_forgot_password(request: HttpRequest) -> HttpResponse:
    """Start a password reset by issuing a time-bound token (no PII disclosure)."""
    _require_client_auth_enabled()
    token = None
    if request.method == "POST":
        identifier = (request.POST.get("identifier") or "").strip()
        client = None
        if "@" in identifier:
            client = dm.Client.objects.filter(email=identifier).only("client_id").first()
        else:
            client = dm.Client.objects.filter(phone=identifier).only("client_id").first()
        if client:
            signer = signing.TimestampSigner()
            token = signer.sign(str(client.client_id))
            # In production, email/SMS this token. For now, show it on the page to complete the flow.
            messages.info(request, "Use the generated reset link to set a new password.")
            # Log FORGOT_PASSWORD (do not include token)
            try:
                log_client_activity("FORGOT_PASSWORD", client=client)
            except Exception:
                pass
    return render(request, "client_portal/client_forgot_password.html", {"token": token})


def client_reset_password(request: HttpRequest, token: str) -> HttpResponse:
    """Reset password with a valid token; enforces password policy on POST."""
    _require_client_auth_enabled()
    signer = signing.TimestampSigner()
    try:
        cid = signer.unsign(token, max_age=3600)  # 1 hour
        client = dm.Client.objects.get(client_id=cid)
    except Exception:
        raise Http404()
    if request.method == "POST":
        new_pw = (request.POST.get("password") or "").strip()
        if not new_pw:
            messages.error(request, "Password required.")
        elif not _password_policy_ok(new_pw):
            messages.error(request, "Password must be at least 8 characters and include letters, numbers, and a special character.")
        else:
            client.password = make_password(new_pw)
            client.save(update_fields=["password"])
            dm.ClientLog.objects.create(client=client, action="PASSWORD_RESET")
            try:
                log_client_activity("PASSWORD_RESET", client=client)
            except Exception:
                pass
            messages.success(request, "Password updated. Please log in.")
            return redirect("client_portal:client_login")
    return render(request, "client_portal/client_reset_password.html")


# -----------------------------
# Unified Client Auth Page (AJAX)
# -----------------------------

@ensure_csrf_cookie
def client_auth(request: HttpRequest) -> HttpResponse:
    """Unified auth surface rendering the combined Login/Signup card with AJAX."""
    _require_client_auth_enabled()
    # Reuse existing template as the unified auth surface
    # The template will render a combined Login/Signup card with AJAX.
    return render(request, "client_portal/client_login.html")


@require_POST
@rl_decorator(key="ip", rate="5/m", block=True)
def client_api_login(request: HttpRequest) -> JsonResponse:
    """API endpoint: authenticate a client and respond with JSON + redirect URL."""
    _require_client_auth_enabled()
    # Honeypot anti-bot: silently drop; prefer HTML redirect if this is not an AJAX call
    if (request.POST.get("hp_company") or "").strip():  # honeypot field
        _honeypot_log(request)  # Added: conservative logging of bot trip
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added: non-AJAX fallback for better UX
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": True, "redirect": reverse("client_portal:client_auth")})  # silent drop
    identifier = (request.POST.get("identifier") or "").strip()
    password = (request.POST.get("password") or "").strip()
    if not identifier or not password:
        # Added: non-AJAX fallback with message + redirect to auth page
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added
            messages.error(request, "Missing credentials.")  # Added
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": False, "error": "Missing credentials."}, status=400)
    client = _authenticate_client(identifier, password)
    if client:
        _finalize_client_login(request, client)
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added: HTML fallback
            return redirect("client_portal:customer_dashboard")  # Added
        return JsonResponse({"ok": True, "redirect": reverse("client_portal:customer_dashboard")})
    # Added: non-AJAX fallback on error
    is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
    if not is_ajax:  # Added
        messages.error(request, "Invalid credentials or inactive account.")  # Added
        return redirect("client_portal:client_auth")  # Added
    return JsonResponse({"ok": False, "error": "Invalid credentials or inactive account."}, status=401)


@require_POST
@rl_decorator(key="ip", rate="5/m", block=True)
def client_api_signup(request: HttpRequest) -> JsonResponse:
    """API endpoint: create a client and auto-login; respond with JSON redirect."""
    _require_client_auth_enabled()
    # Honeypot anti-bot: silently drop; prefer HTML redirect if this is not an AJAX call
    if (request.POST.get("hp_company") or "").strip():  # honeypot field
        _honeypot_log(request)  # Added: conservative logging of bot trip
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added: non-AJAX fallback
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": True, "redirect": reverse("client_portal:client_auth")})  # silent drop
    full_name = (request.POST.get("full_name") or "").strip()
    phone = _normalize_phone(request.POST.get("phone"))
    email = _normalize_email(request.POST.get("email"))
    password = (request.POST.get("password") or "").strip()
    location = (request.POST.get("location") or "").strip() or None
    if not full_name or not phone or not password:
        # Added: non-AJAX fallback on validation error
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added
            messages.error(request, "Full name, phone, and password are required.")  # Added
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": False, "error": "Full name, phone, and password are required."}, status=400)
    if not _password_policy_ok(password):
        # Added: non-AJAX fallback on validation error
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added
            messages.error(request, "Password must be at least 8 characters and include letters, numbers, and a special character.")  # Added
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": False, "error": "Password must be at least 8 characters and include letters, numbers, and a special character."}, status=400)
    # Pre-validate duplicates for clearer API feedback
    if dm.Client.objects.filter(phone=phone).exists():
        # Added: non-AJAX fallback on duplicate
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added
            messages.error(request, "Phone already registered. Try logging in.")  # Added
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": False, "error": "Phone already registered. Try logging in."}, status=400)
    if email and dm.Client.objects.filter(email=email).exists():
        # Added: non-AJAX fallback on duplicate
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added
            messages.error(request, "Email already registered. Try logging in.")  # Added
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": False, "error": "Email already registered. Try logging in."}, status=400)
    try:
        client = _create_client(full_name, phone, email, password, location)
        _finalize_client_login(request, client)  # auto-login
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added
            messages.success(request, "Account created and you are now logged in.")  # Added
            return redirect("client_portal:customer_dashboard")  # Added
        return JsonResponse({"ok": True, "redirect": reverse("client_portal:customer_dashboard"), "message": "Account created and you are now logged in."})
    except IntegrityError:
        # Added: non-AJAX fallback on integrity error
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added
            messages.error(request, "Could not create account. Phone or email may already exist.")  # Added
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": False, "error": "Could not create account. Phone or email may already exist."}, status=400)
    except Exception:
        # Added: non-AJAX fallback on generic server error
        is_ajax = (request.headers.get("X-Requested-With") == "XMLHttpRequest")  # Added
        if not is_ajax:  # Added
            messages.error(request, "Server error. Please try again.")  # Added
            return redirect("client_portal:client_auth")  # Added
        return JsonResponse({"ok": False, "error": "Server error. Please try again."}, status=500)
