from typing import Dict, Any, Type
import json  # added: to serialize label map for templates
import re
from datetime import timedelta  # added: for recent highlight window
from django.conf import settings  # added: feature flags
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Q  # added: for combined OR filtering across multiple fields
from django.forms.models import model_to_dict
from django.http import JsonResponse, HttpRequest, HttpResponseForbidden
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie, csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone  # reused: timezone-aware now()
from django.contrib.auth.models import User  # added: manage Django users for Admin Management
from django.contrib.auth.hashers import make_password  # added: secure password hashing
from asgiref.sync import async_to_sync  # added: Channels sync bridge for broadcasting
from channels.layers import get_channel_layer  # added: obtain channel layer (Redis)

from . import models
from apps.settings_app.models import AppSettings
from apps.authentication.models import AdminProfile, SuperAdmin  # added: use AdminProfile for roles
from apps.dashboard.services import admin_service  # added: centralize admin business logic
from apps.dashboard.models import Client  # added: portal clients for Clients page

TABLE_MODEL_MAP: Dict[int, Type[models.BaseTable]] = {i: getattr(models, f"Table{i}") for i in range(1, 11)}

# Derive human-friendly labels from actual physical DB table names to ensure source of truth is the database schema.
# Example: dashboard_verified_artist -> "Verified Artist"
def _humanize_table_name(db_table: str) -> str:
    try:
        s = str(db_table or "")
        # strip known app/table prefix and normalize separators
        s = re.sub(r"^dashboard[_\-]+", "", s, flags=re.IGNORECASE)
        s = re.sub(r"[_\-]+", " ", s)
        s = s.strip().title()
        return s or str(db_table)
    except Exception:
        return str(db_table)

TABLE_LABELS: Dict[int, str] = {i: _humanize_table_name(TABLE_MODEL_MAP[i]._meta.db_table) for i in range(1, 11)}


def _validate_payload(name: str, city: str, phone: str) -> tuple[bool, str]:
    name = (name or "").strip()
    city = (city or "").strip()
    phone = (phone or "").strip()
    if not name or not city or not phone:
        return False, "All fields (Name, City, Phone) are required."
    if not re.fullmatch(r"[A-Za-z ]+", name):
        return False, "Name must contain only letters and spaces."
    if not re.fullmatch(r"[A-Za-z ]+", city):
        return False, "City must contain only letters and spaces."
    if not re.fullmatch(r"\d{10}", phone):
        return False, "Phone must be exactly 10 digits."
    return True, ""


# ---------------------- Admin helpers (additive) ----------------------  # added
def _first4alpha_lower(name: str) -> str:  # added
    import re as _re  # local import to avoid top-level pollution  # added
    letters = "".join(_re.findall(r"[A-Za-z]", name or ""))[:4].lower()  # added
    return (letters or "user")  # fallback to 'user' if no letters  # added


def _last3digits(phone: str) -> str:  # added
    import re as _re  # added
    digits = "".join(_re.findall(r"\d", phone or ""))  # added
    return (digits[-3:] if len(digits) >= 3 else digits.rjust(3, "0"))  # added


def _build_base_username(name: str, phone: str) -> str:  # added
    return f"{_first4alpha_lower(name)}{_last3digits(phone)}@flodo.com"  # added


def _generate_unique_username(Model, name: str, phone: str) -> str:  # added
    base = _build_base_username(name, phone)  # added
    candidate = base  # added
    suffix = 1  # added
    while Model.objects.filter(user_name=candidate).exists():  # added
        candidate = f"{base}-{suffix}"  # added
        suffix += 1  # added
    return candidate  # added


def _safe_table1_details(obj, password_changed: bool | None = None) -> dict:  # added
    """Return sanitized details for ActivityLog/WS that never contain password_hash."""  # added
    d = {
        "id": getattr(obj, "unique_id", None) or getattr(obj, "pk", None),  # added
        "name": getattr(obj, "name", None),  # added
        "city": getattr(obj, "city", None),  # added
        "phone": getattr(obj, "phone", None),  # added
        "user_name": getattr(obj, "user_name", None),  # added
        "role": getattr(obj, "role", None),  # added
        "is_active": getattr(obj, "is_active", None),  # added
    }
    if password_changed is not None:  # added
        d["password_changed"] = bool(password_changed)  # added
    return d  # added


@login_required
@ensure_csrf_cookie  # ensure CSRF cookie is present for subsequent AJAX POSTs
@require_http_methods(["GET"])  # Overview dashboard: lightweight stats only (no heavy CRUD tables)
def dashboard_view(request: HttpRequest):
    # Restrict access: only super-admin may access the admin dashboard UI
    if not _is_super_admin(request.user):
        return HttpResponseForbidden("Forbidden")
    # Build compact stats for an overview experience to keep dashboard light.
    # We reuse TABLE_MODEL_MAP to avoid any duplication and to keep changes minimal.
    table_ids = list(range(1, 11))  # list once to reuse in template
    # Count rows for each table to surface quick stats; executed server-side for simplicity.
    table_counts = {i: TABLE_MODEL_MAP[i].objects.count() for i in table_ids}  # per-table counts
    total_rows = sum(table_counts.values())  # overall total across all tables
    # Prepare a template-friendly list of dicts to avoid custom template filters
    # Include human-friendly label for each table id so templates can display labels instead of "Table N"  # added
    table_stats = [{"id": i, "count": table_counts[i], "label": TABLE_LABELS.get(i, f"Table {i}")} for i in table_ids]  # added
    # ActivityLog is shown only as a number here; detailed logs remain on their own flows.
    recent_logs_count = models.ActivityLog.objects.count()  # unchanged: count only

    # Optional default log filter for UI chips (e.g., ?logs_table=Client or Admin)  # added
    logs_table_filter = (request.GET.get("logs_table") or "").strip()

    # Compute latest 10 logs for a read-only dashboard table (no forms/buttons)  # added
    now = timezone.now()  # added: current timezone-aware time
    cutoff = now - timedelta(seconds=60)  # added: 60s window to softly highlight recent items
    logs_qs = models.ActivityLog.objects.select_related("admin_user").all()[:10]  # added: latest 10 by Meta ordering
    # added: Flatten to template-friendly safe dicts (avoid exposing unnecessary fields)
    logs_recent = [  # added
        {  # added
            "id": x.pk,  # added: stable identifier if needed
            "timestamp": x.timestamp,  # added: for humanized display via timesince
            "table_name": x.table_name,  # added
            "action": x.action,  # added
            "row_id": x.row_id,  # added
            "admin_user": x.admin_user.username,  # added: username only
            "name": (x.row_details or {}).get("name"),  # added: safe subset from JSON
            "city": (x.row_details or {}).get("city"),  # added
            "phone": (x.row_details or {}).get("phone"),  # added
            "is_recent": bool(x.timestamp and x.timestamp >= cutoff),  # added: UI highlight flag
        }  # added
        for x in logs_qs  # added
    ]  # added
    # Render overview template with stats; the detailed CRUD experience is on /dashboard/tables/
    return render(
        request,
        "dashboard/index.html",
        {
            "table_ids": table_ids,            # kept for reference if needed elsewhere
            "table_counts": table_counts,      # preserved for potential future use
            "table_stats": table_stats,        # primary source for overview cards (now includes human-friendly labels)  # changed
            "total_rows": total_rows,          # overall count badge
            "recent_logs_count": recent_logs_count,  # activity summary number only
            "logs_recent": logs_recent,        # added: latest 10 logs for read-only table
            "label_map_json": json.dumps(TABLE_LABELS),  # added: expose labels to template if needed for client-side usage
            "logs_table_filter": logs_table_filter,  # added: preselect log filter chip on the client
        },
    )


@login_required
@ensure_csrf_cookie  # ensure CSRF cookie for AJAX table actions
@require_http_methods(["GET"])  # Tables page: same UI/JS as dashboard tables
def tables_view(request: HttpRequest):
    # Restrict access: only super-admin may access the tables management UI
    if not _is_super_admin(request.user):
        return HttpResponseForbidden("Forbidden")
    """
    Minimal, non-disruptive Tables page view.
    - Returns an HTML partial when requested via AJAX (for injection into the main content container)
    - Returns a full page (extending base layout) on normal navigation for graceful fallback
    - Reuses the exact same context and frontend code paths as the dashboard tables
    """
    # Build the same context the dashboard uses so JS behavior remains identical.
    ctx: Dict[str, Any] = {
        "tables": list(range(1, 11)),  # unchanged: numeric ids drive AJAX and routing
        "label_map_json": json.dumps(TABLE_LABELS),  # added: expose labels to templates via JSON (safe for JS)
    }
    # Detect AJAX via the conventional header used across the app (keeps behavior consistent).
    is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
    # Render a slim partial for injection, or a full page otherwise.
    template_name = "dashboard/tables_partial.html" if is_ajax else "dashboard/tables_full.html"
    resp = render(request, template_name, ctx)
    # Attach label map also as a response header so AJAX loaders can read it even if inline scripts don't run.
    try:
        resp["X-Label-Map"] = json.dumps(TABLE_LABELS)
    except Exception:
        pass
    return resp


@login_required
@require_http_methods(["GET"])  # pagination, search
def get_table_data(request: HttpRequest, table_id: int):
    # Zero-impact: enforce super-admin only when feature flag is enabled
    if getattr(settings, "FEATURE_ENFORCE_ADMIN_API_PERMS", False):
        if not _is_super_admin(request.user):
            return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
    # Validate table id
    if table_id not in TABLE_MODEL_MAP:
        return JsonResponse({"success": False, "error": "Invalid table id."}, status=400)
    # Exclude Table1 (Admin) from generic CRUD/data API; direct users to Admin Management
    if int(table_id) == 1:
        return JsonResponse({"success": False, "error": "Table1 is managed via Admin Management APIs."}, status=403)
    Model = TABLE_MODEL_MAP[table_id]

    # Basic search/filter (live search: matches unique_id, name, city, phone)  # added
    q = request.GET.get("q", "").strip()
    qs = Model.objects.all().order_by("-created_at")  # unchanged ordering (preserve sorting)
    if q:  # added
        cond = Q(name__icontains=q) | Q(city__icontains=q) | Q(phone__icontains=q)  # added: case-insensitive across text fields
        if q.isdigit():  # added: allow numeric match against primary key unique_id
            try:
                cond = cond | Q(unique_id=int(q))  # added
            except Exception:
                pass  # added: ignore cast issues silently to avoid breaking UX
        qs = qs.filter(cond)  # added

    # Pagination (default from AppSettings if not provided)
    default_pp = 10
    try:
        latest = AppSettings.objects.order_by("-updated_at").first()
        if latest and int(latest.records_per_page) > 0:
            default_pp = int(latest.records_per_page)
    except Exception:
        pass
    per_page = int(request.GET.get("per_page") or default_pp)
    paginator = Paginator(qs, per_page)
    page_obj = paginator.get_page(request.GET.get("page") or 1)

    data = [model_to_dict(obj) for obj in page_obj.object_list]
    return JsonResponse({
        "success": True,
        "results": data,
        "page": page_obj.number,
        "num_pages": paginator.num_pages,
        "total": paginator.count,
    })




# ---------------------- Admin Management ----------------------

def _is_super_admin(user: User) -> bool:
    """Super-admin is strictly the Django superuser.

    This enforces a single source of truth for super-admin privileges and
    avoids accidental elevation via model side-channels. Any SuperAdmin model
    object is informational only; permission gate is is_superuser.
    """
    try:
        return bool(user and user.is_authenticated and user.is_superuser)
    except Exception:
        return False


@login_required
@ensure_csrf_cookie  # ensure CSRF cookie for Admin Management AJAX create/update/delete
@require_http_methods(["GET"])  # page render (full or partial)
def admin_mgmt_view(request: HttpRequest):
    if not _is_super_admin(request.user):
        return JsonResponse({"success": False, "error": "Forbidden"}, status=403) if request.headers.get("X-Requested-With") == "XMLHttpRequest" else HttpResponseForbidden("Forbidden")

    # Provide minimal context; list is fetched via AJAX to keep parity with other pages
    ctx: Dict[str, Any] = {}
    is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
    template_name = "dashboard/admin_management_partial.html" if is_ajax else "dashboard/admin_management_full.html"
    return render(request, template_name, ctx)


@login_required
@ensure_csrf_cookie  # send csrftoken cookie on GET list responses
@csrf_exempt  # DEV: temporarily disable CSRF for Admin Management API (re-enable in prod)
@require_http_methods(["GET", "POST"])  # list or create
@transaction.atomic
def admin_list_create_api(request: HttpRequest):
    # In development, allow disabling strict super-admin enforcement via feature flag
    if getattr(settings, "FEATURE_ENFORCE_ADMIN_API_PERMS", False):
        if not _is_super_admin(request.user):
            return JsonResponse({"success": False, "error": "Forbidden"}, status=403)

    if request.method == "GET":
        q = (request.GET.get("q") or "").strip()
        # Use Table1 (dashboard_admin) as the source of truth for Admin Management
        Model = models.Table1
        # Performance: avoid N+1 on role_approvedby when iterating
        qs = Model.objects.select_related("role_approvedby").all().order_by("-created_at")
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q) | Q(phone__icontains=q))

        # Optional pagination (non-breaking): only paginate when client requests it
        page_param = request.GET.get("page")
        per_page_param = request.GET.get("per_page")
        page_obj = None
        if page_param or per_page_param:
            try:
                default_pp = 20
                try:
                    latest = AppSettings.objects.order_by("-updated_at").first()
                    if latest and int(latest.records_per_page) > 0:
                        default_pp = int(latest.records_per_page)
                except Exception:
                    pass
                per_page = int(per_page_param or default_pp)
                paginator = Paginator(qs, per_page)
                page_number = int(page_param or 1)
                page_obj = paginator.get_page(page_number)
                qs_iter = page_obj.object_list
            except Exception:
                # On any pagination error, fall back to full queryset (preserve behavior)
                qs_iter = qs
                page_obj = None
        else:
            # Default behavior unchanged: return all results
            qs_iter = qs

        data = []
        now = timezone.now()
        for obj in qs_iter:
            # Online/offline heuristic using updated_at instead of last_login
            is_online = bool(obj.updated_at and (now - obj.updated_at) <= timedelta(minutes=15))
            status = "online" if is_online else "offline"
            data.append({
                "id": obj.unique_id,
                # legacy keys kept for backward compatibility (maps to display name)
                "username": obj.name,
                "full_name": obj.name,
                # new fields surfaced for enhanced admin management
                "user_name": getattr(obj, "user_name", "") or "",
                "email": "",  # Table1 has no email; keep blank
                "phone": obj.phone or "",
                "city": obj.city or "",
                "role": getattr(obj, "role", "admin") or "admin",
                "status": status,
                "is_active": bool(getattr(obj, "is_active", True)),
                "last_login": None,  # no auth tracking here
                "tickets_solved": 0,
                "role_approved_by": getattr(getattr(obj, "role_approvedby", None), "username", None),
                "created_by": None,
                "date_joined": obj.created_at.isoformat() if obj.created_at else None,
                "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
            })

        # If paginated, return DRF-like envelope for compatibility with existing client
        if page_obj is not None:
            return JsonResponse({
                "success": True,
                "results": data,
                "page": page_obj.number,
                "num_pages": page_obj.paginator.num_pages,
                "total": page_obj.paginator.count,
                "next": None,  # kept simple; client supports both shapes
                "previous": None,
            })

        return JsonResponse({"success": True, "results": data})

    # POST: create via services layer (enhanced)
    payload = request.POST
    name = (payload.get("username") or payload.get("name") or "").strip()
    city = (payload.get("city") or "").strip()
    phone = (payload.get("phone") or "").strip()
    password = (payload.get("password") or "").strip()
    role = (payload.get("role") or "admin").strip().lower()
    # Bind Model explicitly for logging/broadcast consistency
    Model = models.Table1
    try:
        obj, safe_details, pwd_changed = admin_service.create_admin(
            name=name, city=city, phone=phone, role=role, password=password, actor=request.user
        )
    except ValueError as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)

    try:
        models.ActivityLog.objects.create(
            table_name=TABLE_LABELS.get(1, Model.__name__),
            action="CREATE",
            row_id=obj.unique_id,
            row_details=safe_details,
            admin_user=request.user,
        )
    except Exception:
        pass
    # Broadcast (non-blocking; failure is ignored)
    try:
        layer = get_channel_layer()
        if layer:
            async_to_sync(layer.group_send)(
                "notifications",
                {
                    "type": "notify",
                    "payload": {
                        "table_name": TABLE_LABELS.get(1, Model.__name__),
                        "action": "CREATE",
                        "row_id": obj.unique_id,
                        "row_details": safe_details,
                        "admin_user": request.user.username,
                        "timestamp": timezone.now().isoformat(),
                    },
                },
            )
    except Exception:
        pass
    return JsonResponse({
        "success": True,
        "data": {
            "id": obj.unique_id,
            # legacy keys
            "username": obj.name,
            "full_name": obj.name,
            "email": "",
            "phone": obj.phone or "",
            "city": obj.city or "",
            "role": obj.role,
            # new fields
            "user_name": obj.user_name,
            "is_active": obj.is_active,
            "password_changed": bool(pwd_changed),
            "date_joined": obj.created_at.isoformat() if obj.created_at else None,
            "updated_at": obj.updated_at.isoformat() if getattr(obj, "updated_at", None) else None,
        },
    })


@login_required
@ensure_csrf_cookie  # send csrftoken cookie on GET detail (if any future GET) and consistent responses
@csrf_exempt  # DEV: temporarily disable CSRF for Admin Management API (re-enable in prod)
@require_http_methods(["PUT", "DELETE", "POST"])  # support _method override via POST
@transaction.atomic
def admin_detail_api(request: HttpRequest, user_id: int):
    # In development, allow disabling strict super-admin enforcement via feature flag
    if getattr(settings, "FEATURE_ENFORCE_ADMIN_API_PERMS", False):
        if not _is_super_admin(request.user):
            return JsonResponse({"success": False, "error": "Forbidden"}, status=403)

    # Operate against Table1 instead of auth.User
    Model = models.Table1
    try:
        u = Model.objects.get(pk=user_id)
    except Model.DoesNotExist:
        return JsonResponse({"success": False, "error": "Admin not found."}, status=404)

    effective_method = request.POST.get("_method", request.method).upper()

    # Support pause/update actions
    if effective_method == "PUT":
        payload = request.POST or request.GET
        # Recover/Change password for Table1 admin (super-admin only)
        if (payload.get("action") or "").lower() == "recover_password":
            if not _is_super_admin(request.user):
                return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
            # Extract and validate password
            new_password = (payload.get("password") or payload.get("new_password") or "").strip()
            if not new_password:
                return JsonResponse({"success": False, "error": "Password required."}, status=400)
            # Server-side strong policy: >=12 chars, upper, lower, digit, symbol
            import re as _re
            ok_len = len(new_password) >= 12
            ok_up = bool(_re.search(r"[A-Z]", new_password))
            ok_low = bool(_re.search(r"[a-z]", new_password))
            ok_dig = bool(_re.search(r"\d", new_password))
            ok_sym = bool(_re.search(r"[^A-Za-z0-9]", new_password))
            if not (ok_len and ok_up and ok_low and ok_dig and ok_sym):
                return JsonResponse({"success": False, "error": "Password must be 12+ chars and include upper, lower, digit, and symbol."}, status=400)
            # Persist to Table1.password_hash using Django's hasher
            try:
                u.password_hash = make_password(new_password)
                u.save(update_fields=["password_hash", "updated_at"])  # updated_at auto-updates
            except Exception:
                return JsonResponse({"success": False, "error": "Failed to update password."}, status=500)
            # Activity log
            try:
                models.ActivityLog.objects.create(
                    table_name=TABLE_LABELS.get(1, Model.__name__),
                    action="RESET_PASSWORD",
                    row_id=u.pk,
                    row_details=_safe_table1_details(u),
                    admin_user=request.user,
                )
            except Exception:
                pass
            # Broadcast
            try:
                layer = get_channel_layer()
                if layer:
                    async_to_sync(layer.group_send)(
                        "notifications",
                        {
                            "type": "notify",
                            "payload": {
                                "table_name": TABLE_LABELS.get(1, Model.__name__),
                                "action": "RESET_PASSWORD",
                                "row_id": u.pk,
                                "row_details": _safe_table1_details(u),
                                "admin_user": request.user.username,
                                "timestamp": timezone.now().isoformat(),
                            },
                        },
                    )
            except Exception:
                pass
            return JsonResponse({"success": True, "data": {"id": u.pk, "password_updated_at": timezone.now().isoformat()}})
        if (payload.get("action") or "").lower() == "pause":
            # Persist pause via service and log safely
            safe_details = admin_service.pause_admin(obj=u)
            try:
                models.ActivityLog.objects.create(
                    table_name=TABLE_LABELS.get(1, Model.__name__),
                    action="PAUSE",
                    row_id=u.pk,
                    row_details=safe_details,
                    admin_user=request.user,
                )
            except Exception:
                pass
            # Broadcast
            try:
                layer = get_channel_layer()
                if layer:
                    async_to_sync(layer.group_send)(
                        "notifications",
                        {
                            "type": "notify",
                            "payload": {
                                "table_name": TABLE_LABELS.get(1, Model.__name__),
                                "action": "PAUSE",
                                "row_id": u.pk,
                                "row_details": safe_details,
                                "admin_user": request.user.username,
                                "timestamp": timezone.now().isoformat(),
                            },
                        },
                    )
            except Exception:
                pass
            return JsonResponse({"success": True, "data": {"id": u.pk, "is_active": u.is_active}})

        # Update fields via services layer
        new_name = (payload.get("username") or payload.get("name") or u.name).strip()
        new_city = (payload.get("city") or u.city).strip()
        new_phone = (payload.get("phone") or u.phone).strip()
        new_role = (payload.get("role") or u.role or "admin").strip().lower()
        new_password = (payload.get("password") or "").strip()
        try:
            u, safe_details, password_changed = admin_service.update_admin(
                obj=u, name=new_name, city=new_city, phone=new_phone, role=new_role, password=new_password
            )
        except ValueError as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)
        try:
            models.ActivityLog.objects.create(
                table_name=TABLE_LABELS.get(1, Model.__name__),
                action="UPDATE",
                row_id=u.pk,
                row_details=safe_details,
                admin_user=request.user,
            )
        except Exception:
            pass
        # Broadcast
        try:
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    "notifications",
                    {
                        "type": "notify",
                        "payload": {
                            "table_name": TABLE_LABELS.get(1, Model.__name__),
                            "action": "UPDATE",
                            "row_id": u.pk,
                            "row_details": safe_details,
                            "admin_user": request.user.username,
                            "timestamp": timezone.now().isoformat(),
                        },
                    },
                )
        except Exception:
            pass
        return JsonResponse({"success": True, "data": {"id": u.pk, "password_updated_at": timezone.now().isoformat() if password_changed else None}})

    if effective_method == "DELETE":
        details = _safe_table1_details(u)
        uid = u.pk
        u.delete()
        try:
            models.ActivityLog.objects.create(
                table_name=TABLE_LABELS.get(1, Model.__name__),
                action="DELETE",
                row_id=uid,
                row_details=details,
                admin_user=request.user,
            )
        except Exception:
            pass
        # Broadcast
        try:
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    "notifications",
                    {
                        "type": "notify",
                        "payload": {
                            "table_name": TABLE_LABELS.get(1, Model.__name__),
                            "action": "DELETE",
                            "row_id": uid,
                            "row_details": details,
                            "admin_user": request.user.username,
                            "timestamp": timezone.now().isoformat(),
                        },
                    },
                )
        except Exception:
            pass
        return JsonResponse({"success": True})

    return JsonResponse({"success": False, "error": "Unsupported method."}, status=405)


# ---------------------------------------------------------------------------
# Super-admin: Artist Applications overview (read-only page)
# ---------------------------------------------------------------------------
@login_required
@require_http_methods(["GET"])
def artist_applications_view(request: HttpRequest):
    # Restrict strictly to super-admins
    if not _is_super_admin(request.user):
        return HttpResponseForbidden("Forbidden")

    # Table6 maps to dashboard_artist_application (see models.Table6)
    from django.db.models import Count
    Model = models.Table6
    applications = Model.objects.all()

    # Optional filters via GET (non-breaking): status, city, q
    status = (request.GET.get("status") or "").strip().lower()
    if status:
        applications = applications.filter(application_status=status)
    city = (request.GET.get("city") or "").strip()
    if city:
        applications = applications.filter(city__icontains=city)
    q = (request.GET.get("q") or "").strip()
    if q:
        from django.db.models import Q
        applications = applications.filter(
            Q(name__icontains=q) | Q(email__icontains=q) | Q(phone__icontains=q)
        )

    applications = (
        applications
        .select_related("approval_admin")
        .prefetch_related("certificates")
        .annotate(cert_count=Count("certificates"))
        .order_by("-created_at")
    )

    # Pagination (non-breaking). Defaults to 24 per page.
    per_page = int(request.GET.get("per_page") or 24)
    page_num = int(request.GET.get("page") or 1)
    paginator = Paginator(applications, per_page)
    applications_page = paginator.get_page(page_num)

    # Lightweight counts for header chips
    total = paginator.count

    ctx: Dict[str, Any] = {
        "applications": applications_page.object_list,
        "page_obj": applications_page,
        "total": total,
        "table_label": TABLE_LABELS.get(6, "Artist Application"),
        "filters": {"status": status, "city": city, "q": q, "per_page": per_page},
    }
    return render(request, "dashboard/artist_applications.html", ctx)


# ---------------------------------------------------------------------------
# Super-admin: Clients page (portal signups)
# ---------------------------------------------------------------------------
@login_required
@require_http_methods(["GET"])  # page render (full or partial)
def clients_view(request: HttpRequest):
    if not _is_super_admin(request.user):
        return HttpResponseForbidden("Forbidden")
    is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
    template_name = "dashboard/clients_partial.html" if is_ajax else "dashboard/clients_full.html"
    return render(request, template_name, {})


@login_required
@require_http_methods(["GET"])  # list with pagination and search
def clients_list_api(request: HttpRequest):
    if getattr(settings, "FEATURE_ENFORCE_ADMIN_API_PERMS", False):
        if not _is_super_admin(request.user):
            return JsonResponse({"success": False, "error": "Forbidden"}, status=403)

    q = (request.GET.get("q") or "").strip()
    qs = Client.objects.all().order_by("-created_at")
    if q:
        cond = Q(full_name__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q) | Q(location__icontains=q)
        qs = qs.filter(cond)

    # Pagination (fallback to AppSettings.records_per_page)
    default_pp = 10
    try:
        latest = AppSettings.objects.order_by("-updated_at").first()
        if latest and int(latest.records_per_page) > 0:
            default_pp = int(latest.records_per_page)
    except Exception:
        pass
    per_page = int(request.GET.get("per_page") or default_pp)
    paginator = Paginator(qs, per_page)
    page_obj = paginator.get_page(request.GET.get("page") or 1)

    results = []
    for c in page_obj.object_list:
        results.append({
            "client_id": str(c.client_id),
            "full_name": c.full_name,
            "phone": c.phone,
            "email": c.email,
            "location": c.location,
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return JsonResponse({
        "success": True,
        "results": results,
        "page": page_obj.number,
        "num_pages": paginator.num_pages,
        "total": paginator.count,
    })


@login_required
@csrf_protect
@require_http_methods(["POST"])  # Approve action
@transaction.atomic
def artist_application_approve_view(request: HttpRequest, app_id: int):
    if not _is_super_admin(request.user):
        return HttpResponseForbidden("Forbidden")
    try:
        app = models.Table6.objects.select_for_update().get(pk=app_id)
    except models.Table6.DoesNotExist:
        return JsonResponse({"success": False, "error": "Application not found"}, status=404)

    # Update approval fields
    app.approved = True
    app.application_status = "approved"
    app.approval_admin = request.user
    try:
        from django.utils import timezone as _tz
        app.approved_at = _tz.now()
    except Exception:
        pass
    app.save(update_fields=["approved", "application_status", "approval_admin", "approved_at", "updated_at"])

    # Copy into Verified Artist (Table3) if not already present
    ModelVA = models.Table3
    if not ModelVA.objects.filter(name=app.name).exists():
        ModelVA.objects.create(name=app.name, city=app.city, phone=app.phone)

    # Log and broadcast
    try:
        models.ActivityLog.objects.create(
            table_name=TABLE_LABELS.get(6, "Artist Application"),
            action="UPDATE",
            row_id=app.pk,
            row_details={
                "status": app.application_status,
                "approved": app.approved,
                "name": app.name,
                "city": app.city,
                "phone": app.phone,
            },
            admin_user=request.user,
        )
    except Exception:
        pass
    try:
        layer = get_channel_layer()
        if layer:
            async_to_sync(layer.group_send)(
                "notifications",
                {
                    "type": "notify",
                    "payload": {
                        "table_name": TABLE_LABELS.get(6, "Artist Application"),
                        "action": "APPROVE",
                        "row_id": app.pk,
                        "row_details": {"name": app.name, "city": app.city, "phone": app.phone},
                        "admin_user": request.user.username,
                        "timestamp": timezone.now().isoformat(),
                    },
                },
            )
    except Exception:
        pass

    # Redirect back to listing for UX
    return redirect("dashboard:artist_applications")


@login_required
@csrf_protect
@require_http_methods(["POST"])  # Reject action
@transaction.atomic
def artist_application_reject_view(request: HttpRequest, app_id: int):
    if not _is_super_admin(request.user):
        return HttpResponseForbidden("Forbidden")
    try:
        app = models.Table6.objects.select_for_update().get(pk=app_id)
    except models.Table6.DoesNotExist:
        return JsonResponse({"success": False, "error": "Application not found"}, status=404)

    # Update rejection fields
    app.approved = False
    app.application_status = "rejected"
    app.approval_admin = request.user
    app.save(update_fields=["approved", "application_status", "approval_admin", "updated_at"])

    # Log and broadcast
    try:
        models.ActivityLog.objects.create(
            table_name=TABLE_LABELS.get(6, "Artist Application"),
            action="UPDATE",
            row_id=app.pk,
            row_details={
                "status": app.application_status,
                "approved": app.approved,
                "name": app.name,
            },
            admin_user=request.user,
        )
    except Exception:
        pass
    try:
        layer = get_channel_layer()
        if layer:
            async_to_sync(layer.group_send)(
                "notifications",
                {
                    "type": "notify",
                    "payload": {
                        "table_name": TABLE_LABELS.get(6, "Artist Application"),
                        "action": "REJECT",
                        "row_id": app.pk,
                        "row_details": {"name": app.name},
                        "admin_user": request.user.username,
                        "timestamp": timezone.now().isoformat(),
                    },
                },
            )
    except Exception:
        pass

    return redirect("dashboard:artist_applications")
@login_required
@csrf_protect
@require_http_methods(["POST", "PUT", "DELETE"])  # CRUD via AJAX
@transaction.atomic
def table_crud_api(request: HttpRequest, table_id: int, row_id: int | None = None):
    # Zero-impact: enforce super-admin only when feature flag is enabled
    if getattr(settings, "FEATURE_ENFORCE_ADMIN_API_PERMS", False):
        if not _is_super_admin(request.user):
            return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
    if table_id not in TABLE_MODEL_MAP:
        return JsonResponse({"success": False, "error": "Invalid table id."}, status=400)
    Model = TABLE_MODEL_MAP[table_id]
    # Block Table1 from generic CRUD in favor of Admin Management dedicated endpoints
    if int(table_id) == 1:
        return JsonResponse({"success": False, "error": "Use /dashboard/api/admins/ endpoints for Table1."}, status=403)

    # Allow method override via _method parameter for clients using POST
    effective_method = request.POST.get("_method", request.method).upper()

    if request.method == "POST" and effective_method == "POST":
        # Create
        payload = request.POST
        ok, err = _validate_payload(payload.get("name", ""), payload.get("city", ""), payload.get("phone", ""))
        if not ok:
            return JsonResponse({"success": False, "error": err}, status=400)
        obj = Model.objects.create(
            name=payload.get("name", ""),
            city=payload.get("city", ""),
            phone=payload.get("phone", ""),
        )
        # Log CREATE
        try:
            models.ActivityLog.objects.create(
                table_name=TABLE_LABELS.get(table_id, Model.__name__),  # added: log human label without changing DB schema
                action="CREATE",
                row_id=obj.pk,
                row_details=model_to_dict(obj),
                admin_user=request.user,
            )
        except Exception:
            pass
        # Broadcast
        try:
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    "notifications",
                    {
                        "type": "notify",
                        "payload": {
                            "table_name": TABLE_LABELS.get(table_id, Model.__name__),
                            "action": "CREATE",
                            "row_id": obj.pk,
                            "row_details": model_to_dict(obj),
                            "admin_user": request.user.username,
                            "timestamp": timezone.now().isoformat(),
                        },
                    },
                )
        except Exception:
            pass
        return JsonResponse({"success": True, "data": model_to_dict(obj)})

    if row_id is None:
        return JsonResponse({"success": False, "error": "row_id required."}, status=400)

    try:
        obj = Model.objects.get(pk=row_id)
    except Model.DoesNotExist:
        return JsonResponse({"success": False, "error": "Row not found."}, status=404)

    if effective_method == "PUT":
        payload = request.POST or request.GET
        new_name = payload.get("name", obj.name)
        new_city = payload.get("city", obj.city)
        new_phone = payload.get("phone", obj.phone)
        ok, err = _validate_payload(new_name, new_city, new_phone)
        if not ok:
            return JsonResponse({"success": False, "error": err}, status=400)
        obj.name = new_name
        obj.city = new_city
        obj.phone = new_phone
        obj.save()
        # Log UPDATE
        try:
            models.ActivityLog.objects.create(
                table_name=TABLE_LABELS.get(table_id, Model.__name__),  # added
                action="UPDATE",
                row_id=obj.pk,
                row_details=model_to_dict(obj),
                admin_user=request.user,
            )
        except Exception:
            pass
        # Broadcast
        try:
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    "notifications",
                    {
                        "type": "notify",
                        "payload": {
                            "table_name": TABLE_LABELS.get(table_id, Model.__name__),
                            "action": "UPDATE",
                            "row_id": obj.pk,
                            "row_details": model_to_dict(obj),
                            "admin_user": request.user.username,
                            "timestamp": timezone.now().isoformat(),
                        },
                    },
                )
        except Exception:
            pass
        return JsonResponse({"success": True, "data": model_to_dict(obj)})

    if effective_method == "DELETE":
        # capture details before delete for logging
        details = model_to_dict(obj)
        pk = obj.pk
        obj.delete()
        try:
            models.ActivityLog.objects.create(
                table_name=TABLE_LABELS.get(table_id, Model.__name__),  # added
                action="DELETE",
                row_id=pk,
                row_details=details,
                admin_user=request.user,
            )
        except Exception:
            pass
        # Broadcast
        try:
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    "notifications",
                    {
                        "type": "notify",
                        "payload": {
                            "table_name": TABLE_LABELS.get(table_id, Model.__name__),
                            "action": "DELETE",
                            "row_id": pk,
                            "row_details": details,
                            "admin_user": request.user.username,
                            "timestamp": timezone.now().isoformat(),
                        },
                    },
                )
        except Exception:
            pass
        return JsonResponse({"success": True})

    return JsonResponse({"success": False, "error": "Unsupported method."}, status=405)


@login_required
@csrf_protect
@require_http_methods(["POST"])  # placeholder: store renames in session for demonstration
def update_table_config(request: HttpRequest):
    # Zero-impact: enforce super-admin only when feature flag is enabled
    if getattr(settings, "FEATURE_ENFORCE_ADMIN_API_PERMS", False):
        if not _is_super_admin(request.user):
            return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
    table_id = request.POST.get("table_id")
    table_label = request.POST.get("table_label")
    col_name = request.POST.get("col_name")
    col_label = request.POST.get("col_label")

    cfg = request.session.get("table_cfg", {})
    if table_id and table_label:
        cfg[f"t{table_id}_label"] = table_label
    if col_name and col_label:
        cfg[f"col_{col_name}_label"] = col_label
    request.session["table_cfg"] = cfg
    return JsonResponse({"success": True, "config": cfg})


@require_http_methods(["GET"])  # logs
def get_logs(request: HttpRequest):
    # Return JSON 401 for unauthenticated AJAX callers to avoid 302 redirects breaking polling UIs
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Authentication required"}, status=401)
    per_page = int(request.GET.get("per_page") or 20)
    page = int(request.GET.get("page") or 1)
    qs = models.ActivityLog.objects.select_related("admin_user").all()
    paginator = Paginator(qs, per_page)
    page_obj = paginator.get_page(page)
    data = [
        {
            "id": x.pk,
            "table_name": x.table_name,
            "table_number": int(str(x.table_name).replace("Table", "")) if str(x.table_name).startswith("Table") else None,
            "action": x.action,
            "row_id": x.row_id,
            "row_details": x.row_details,
            "name": (x.row_details or {}).get("name"),
            "city": (x.row_details or {}).get("city"),
            "phone": (x.row_details or {}).get("phone"),
            "timestamp": x.timestamp.isoformat(),
            "admin_user": x.admin_user.username,
        }
        for x in page_obj.object_list
    ]
    return JsonResponse({
        "success": True,
        "results": data,
        "page": page_obj.number,
        "num_pages": paginator.num_pages,
        "total": paginator.count,
    })
