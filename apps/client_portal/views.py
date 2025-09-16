# pyright: reportMissingImports=false
from __future__ import annotations
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
from django.db.utils import IntegrityError
from django.urls import reverse
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .logging import log_client_activity  # centralized client activity logging (redacts PII, broadcasts)

# Public Client Portal (no authentication). Uses existing dashboard tables.
# SOC: templates render-only; all logic lives here.


def _records_per_page() -> int:
    try:
        s = AppSettings.objects.order_by("-updated_at").first()
        if s and int(s.records_per_page) > 0:
            return int(s.records_per_page)
    except Exception:
        pass
    return 20


def _visitor_fp(request: HttpRequest) -> str:
    """
    Anonymous visitor fingerprint bound to the session.
    """
    try:
        if not request.session.session_key:
            request.session.save()
        return f"anon-{request.session.session_key}"
    except Exception:
        return "anon-unknown"


def portal_home(request: HttpRequest) -> HttpResponse:
    fp = _visitor_fp(request)
    has_application = dm.Table6.objects.filter(name=fp).exists()
    is_verified_artist = dm.Table3.objects.filter(name=fp).exists()
    return render(request, "client_portal/home.html", {
        "has_application": has_application,
        "is_verified_artist": is_verified_artist,
    })


def customer_dashboard(request: HttpRequest) -> HttpResponse:
    fp = _visitor_fp(request)
    recent = dm.Table9.objects.filter(name=fp).order_by("-created_at")[:10]
    return render(request, "client_portal/customer_dashboard.html", {"recent_bookings": recent})


def browse_artists(request: HttpRequest) -> HttpResponse:
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
def artist_apply(request: HttpRequest) -> HttpResponse:
    # Require client login
    if not _current_client(request):
        return redirect("client_portal:client_auth")
    fp = _visitor_fp(request)
    # If already verified or already applied, show status
    if dm.Table3.objects.filter(name=fp).exists():
        return redirect("client_portal:artist_dashboard")
    if request.method == "POST":
        # Collect fields
        city = (request.POST.get("city") or "").strip() or "Unknown"
        phone = (request.POST.get("phone") or "").strip() or ""
        email = (request.POST.get("email") or "").strip()
        try:
            years_experience = int((request.POST.get("years_experience") or "0").strip() or 0)
        except ValueError:
            years_experience = 0

        # Derive user-aware identity
        user = request.user if getattr(request, "user", None) and not isinstance(request.user, AnonymousUser) and request.user.is_authenticated else None
        name = (getattr(user, "get_full_name", lambda: "")() or getattr(user, "username", "") or fp).strip() or fp
        if not phone and user and hasattr(user, "profile"):
            try:
                phone = getattr(user.profile, "phone", "") or phone
            except Exception:
                pass

        # Prevent duplicates by fingerprint-based name (legacy heuristic)
        if dm.Table6.objects.filter(name=name).exists():
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
        )
        # Certificates (multiple)
        files = request.FILES.getlist("certificates")
        for f in files:
            try:
                dm.ArtistApplicationCertificate.objects.create(application=app, file=f)
            except Exception:
                # ignore invalid files; validation occurs in model validators
                pass
        # Client activity record: avoid PII; include only minimal context
        try:
            log_client_activity("ARTIST_APPLY", client=None, details={"application_id": app.id, "cert_count": len(files)})
        except Exception:
            pass
        return redirect("client_portal:artist_application_status")
    return render(request, "client_portal/artist_apply.html", {})


def artist_application_status(request: HttpRequest) -> HttpResponse:
    fp = _visitor_fp(request)
    if dm.Table3.objects.filter(name=fp).exists():
        status = "approved"
    elif dm.Table6.objects.filter(name=fp).exists():
        status = "pending"
    else:
        status = "not_applied"
    return render(request, "client_portal/artist_application_status.html", {"status": status})


def artist_dashboard(request: HttpRequest) -> HttpResponse:
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
    return getattr(settings, "FEATURE_CLIENT_AUTH", False)


def _require_client_auth_enabled():
    if not _client_auth_enabled():
        raise Http404()


def _current_client(request: HttpRequest):
    cid = request.session.get("client_id")
    if not cid:
        return None
    try:
        return dm.Client.objects.only("client_id", "full_name").get(client_id=cid)
    except dm.Client.DoesNotExist:
        return None


def client_signup(request: HttpRequest) -> HttpResponse:
    _require_client_auth_enabled()
    # Redirect unified experience
    if request.method == "GET":
        return redirect("client_portal:client_auth")
    if request.method == "POST":
        full_name = (request.POST.get("full_name") or "").strip()
        phone = (request.POST.get("phone") or "").strip()
        email = (request.POST.get("email") or "").strip() or None
        password = (request.POST.get("password") or "").strip()
        location = (request.POST.get("location") or "").strip() or None
        if not full_name or not phone or not password:
            messages.error(request, "Full name, phone, and password are required.")
        else:
            # Pre-validate duplicates for clearer feedback
            if dm.Client.objects.filter(phone=phone).exists():
                messages.error(request, "An account with this phone already exists. Try logging in.")
            elif email and dm.Client.objects.filter(email=email).exists():
                messages.error(request, "An account with this email already exists. Try logging in.")
            else:
                try:
                    client = dm.Client.objects.create(
                        full_name=full_name,
                        phone=phone,
                        email=email,
                        password=make_password(password),
                        location=location,
                        status="Active",
                    )
                    dm.ClientLog.objects.create(client=client, action="CREATE", details={"full_name": full_name, "phone": phone})
                    # Log unified ActivityLog for dashboard with safe redaction and broadcast
                    try:
                        log_client_activity("CREATE", client=client)
                    except Exception:
                        pass
                    # Auto-login after successful signup
                    request.session["client_id"] = str(client.client_id)
                    request.session["client_full_name"] = client.full_name or ""
                    # Also record a LOGIN event since user is now signed in
                    try:
                        dm.ClientLog.objects.create(client=client, action="LOGIN")
                        log_client_activity("LOGIN", client=client)
                    except Exception:
                        pass
                    messages.success(request, "Account created and you are now logged in.")
                    return redirect("client_portal:customer_dashboard")
                except IntegrityError:
                    messages.error(request, "Could not create account. Phone or email may already exist.")
                except Exception:
                    messages.error(request, "Could not create account due to a server error. Please try again.")
    return render(request, "client_portal/client_signup.html")


def client_login(request: HttpRequest) -> HttpResponse:
    _require_client_auth_enabled()
    # Redirect unified experience
    if request.method == "GET":
        return redirect("client_portal:client_auth")
    if request.method == "POST":
        identifier = (request.POST.get("identifier") or "").strip()  # phone or email
        password = (request.POST.get("password") or "").strip()
        client = None
        if "@" in identifier:
            client = dm.Client.objects.filter(email=identifier).first()
        else:
            client = dm.Client.objects.filter(phone=identifier).first()
        if client and check_password(password, client.password) and client.status == "Active":
            request.session["client_id"] = str(client.client_id)
            request.session["client_full_name"] = client.full_name or ""
            dm.ClientLog.objects.create(client=client, action="LOGIN")
            # ActivityLog + broadcast
            try:
                log_client_activity("LOGIN", client=client)
            except Exception:
                pass
            return redirect("client_portal:customer_dashboard")
        messages.error(request, "Invalid credentials or inactive account.")
    return render(request, "client_portal/client_login.html")


def client_profile(request: HttpRequest) -> HttpResponse:
    _require_client_auth_enabled()
    # Require client login; for now, send to dashboard as a placeholder for Profile page
    if not _current_client(request):
        return redirect("client_portal:client_auth")
    return redirect("client_portal:customer_dashboard")


def client_logout(request: HttpRequest) -> HttpResponse:
    _require_client_auth_enabled()
    client = _current_client(request)
    if client:
        dm.ClientLog.objects.create(client=client, action="LOGOUT")
        try:
            log_client_activity("LOGOUT", client=client)
        except Exception:
            pass
    request.session.pop("client_id", None)
    request.session.pop("client_full_name", None)
    messages.success(request, "Logged out.")
    return redirect("client_portal:home")


def client_forgot_password(request: HttpRequest) -> HttpResponse:
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

def client_auth(request: HttpRequest) -> HttpResponse:
    _require_client_auth_enabled()
    # Reuse existing template as the unified auth surface
    # The template will render a combined Login/Signup card with AJAX.
    return render(request, "client_portal/client_login.html")


@require_POST
def client_api_login(request: HttpRequest) -> JsonResponse:
    _require_client_auth_enabled()
    identifier = (request.POST.get("identifier") or "").strip()
    password = (request.POST.get("password") or "").strip()
    if not identifier or not password:
        return JsonResponse({"ok": False, "error": "Missing credentials."}, status=400)
    if "@" in identifier:
        client = dm.Client.objects.filter(email=identifier).first()
    else:
        client = dm.Client.objects.filter(phone=identifier).first()
    if client and check_password(password, client.password) and client.status == "Active":
        request.session["client_id"] = str(client.client_id)
        request.session["client_full_name"] = client.full_name or ""
        dm.ClientLog.objects.create(client=client, action="LOGIN")
        try:
            log_client_activity("LOGIN", client=client)
        except Exception:
            pass
        return JsonResponse({"ok": True, "redirect": reverse("client_portal:customer_dashboard")})
    return JsonResponse({"ok": False, "error": "Invalid credentials or inactive account."}, status=401)


@require_POST
def client_api_signup(request: HttpRequest) -> JsonResponse:
    _require_client_auth_enabled()
    full_name = (request.POST.get("full_name") or "").strip()
    phone = (request.POST.get("phone") or "").strip()
    email = (request.POST.get("email") or "").strip() or None
    password = (request.POST.get("password") or "").strip()
    location = (request.POST.get("location") or "").strip() or None
    if not full_name or not phone or not password:
        return JsonResponse({"ok": False, "error": "Full name, phone, and password are required."}, status=400)
    # Pre-validate duplicates for clearer API feedback
    if dm.Client.objects.filter(phone=phone).exists():
        return JsonResponse({"ok": False, "error": "Phone already registered. Try logging in."}, status=400)
    if email and dm.Client.objects.filter(email=email).exists():
        return JsonResponse({"ok": False, "error": "Email already registered. Try logging in."}, status=400)
    try:
        client = dm.Client.objects.create(
            full_name=full_name,
            phone=phone,
            email=email,
            password=make_password(password),
            location=location,
            status="Active",
        )
        dm.ClientLog.objects.create(client=client, action="CREATE", details={"full_name": full_name, "phone": phone})
        # Unified ActivityLog + broadcast through helper (handles redaction)
        try:
            log_client_activity("CREATE", client=client)
        except Exception:
            pass
        # Auto-login after successful signup
        request.session["client_id"] = str(client.client_id)
        try:
            dm.ClientLog.objects.create(client=client, action="LOGIN")
            log_client_activity("LOGIN", client=client)
        except Exception:
            pass
        return JsonResponse({"ok": True, "redirect": reverse("client_portal:customer_dashboard"), "message": "Account created and you are now logged in."})
    except IntegrityError:
        return JsonResponse({"ok": False, "error": "Could not create account. Phone or email may already exist."}, status=400)
    except Exception:
        return JsonResponse({"ok": False, "error": "Server error. Please try again."}, status=500)
