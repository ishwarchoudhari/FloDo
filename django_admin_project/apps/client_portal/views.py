from __future__ import annotations
from django.shortcuts import render, redirect
from django.http import HttpRequest, HttpResponse, Http404
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
        # ActivityLog is handled globally elsewhere (signals/views). Kept minimal here.
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
    if request.method == "POST":
        full_name = (request.POST.get("full_name") or "").strip()
        phone = (request.POST.get("phone") or "").strip()
        email = (request.POST.get("email") or "").strip() or None
        password = (request.POST.get("password") or "").strip()
        location = (request.POST.get("location") or "").strip() or None
        if not full_name or not phone or not password:
            messages.error(request, "Full name, phone, and password are required.")
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
                messages.success(request, "Account created. Please log in.")
                return redirect("client_portal:client_login")
            except Exception:
                messages.error(request, "Could not create account. Phone or email may already exist.")
    return render(request, "client_portal/client_signup.html")


def client_login(request: HttpRequest) -> HttpResponse:
    _require_client_auth_enabled()
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
            dm.ClientLog.objects.create(client=client, action="LOGIN")
            return redirect("client_portal:customer_dashboard")
        messages.error(request, "Invalid credentials or inactive account.")
    return render(request, "client_portal/client_login.html")


def client_logout(request: HttpRequest) -> HttpResponse:
    _require_client_auth_enabled()
    client = _current_client(request)
    if client:
        dm.ClientLog.objects.create(client=client, action="LOGOUT")
    request.session.pop("client_id", None)
    messages.success(request, "Logged out.")
    return redirect("client_portal:client_login")


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
            messages.success(request, "Password updated. Please log in.")
            return redirect("client_portal:client_login")
    return render(request, "client_portal/client_reset_password.html")
