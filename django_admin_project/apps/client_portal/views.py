from __future__ import annotations
from django.shortcuts import render, redirect
from django.http import HttpRequest, HttpResponse
from django.db import transaction
from django.contrib.auth.models import AnonymousUser
from django.core.paginator import Paginator
from django.utils import timezone
from apps.dashboard import models as dm
from apps.settings_app.models import AppSettings

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
