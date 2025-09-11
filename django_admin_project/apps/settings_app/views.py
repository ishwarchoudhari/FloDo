import csv
import io
import json
import os
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db import transaction
from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
import django

from apps.dashboard.models import ActivityLog
from apps.dashboard import models as dash_models
from .forms import ProfileForm, AppSettingsForm
from .models import AppSettings


@login_required
@require_http_methods(["GET"])  # settings landing page
def settings_home(request):
    user_form = ProfileForm(instance=request.user)
    latest = AppSettings.objects.order_by("-updated_at").first()
    app_form = AppSettingsForm(instance=latest)
    db_settings = settings.DATABASES["default"].copy()
    # Hide absolute path for NAME in SQLite
    if db_settings.get("ENGINE", "").endswith("sqlite3"):
        db_settings["NAME"] = os.path.basename(db_settings["NAME"])  # type: ignore
    return render(request, "settings/index.html", {
        "user_form": user_form,
        "app_form": app_form,
        "db_settings": db_settings,
    })


@login_required
@csrf_protect
@require_http_methods(["POST"])  # update profile
@transaction.atomic
def profile_update(request):
    form = ProfileForm(request.POST, instance=request.user)
    if form.is_valid():
        user: User = form.save()
        pwd = request.POST.get("password")
        if pwd:
            user.set_password(pwd)
            user.save(update_fields=["password"])
            # Re-authenticate to preserve the current session after password change
            authed = authenticate(username=user.username, password=pwd)
            if authed is not None:
                login(request, authed)
        messages.success(request, "Profile updated")
        return redirect("settings_app:index")
    messages.error(request, "Invalid profile form")
    return redirect("settings_app:index")


@login_required
@csrf_protect
@require_http_methods(["POST"])  # update app settings
@transaction.atomic
def app_update(request):
    latest = AppSettings.objects.order_by("-updated_at").first()
    form = AppSettingsForm(request.POST, instance=latest)
    if form.is_valid():
        obj = form.save(commit=False)
        obj.updated_by = request.user
        obj.save()
        messages.success(request, "App settings updated")
        return redirect("settings_app:index")
    messages.error(request, "Invalid app settings form")
    return redirect("settings_app:index")


@login_required
@require_http_methods(["GET"])  # export csv/json
def export_table(request, fmt: str, table_id: int):
    if table_id < 1 or table_id > 10:
        return JsonResponse({"success": False, "error": "Invalid table id."}, status=400)
    Model = getattr(dash_models, f"Table{table_id}")

    # Fixed field order (safe default) falls back when table has no rows
    default_fields = ["unique_id", "name", "city", "phone", "created_at", "updated_at"]
    qs = Model.objects.all().values(*default_fields).iterator(chunk_size=1000)

    if fmt == "json":
        def json_stream():
            yield "["
            first = True
            for r in qs:
                if not first:
                    yield ","
                first = False
                yield json.dumps(r, default=str)
            yield "]"

        resp = StreamingHttpResponse(json_stream(), content_type="application/json; charset=utf-8")
        resp["Content-Disposition"] = f"attachment; filename=table{table_id}.json"
        return resp

    if fmt == "csv":
        class Echo:
            def write(self, value):
                return value

        pseudo_buffer = Echo()
        writer = None

        def row_iter():
            nonlocal writer
            header_written = False
            for r in qs:
                if writer is None:
                    fields = list(r.keys()) or default_fields
                    writer = csv.DictWriter(pseudo_buffer, fieldnames=fields)
                if not header_written:
                    header_written = True
                    yield writer.writeheader() or ""
                yield writer.writerow({k: str(v) for k, v in r.items()}) or ""
            # Handle empty table: still output header
            if not header_written:
                writer = csv.DictWriter(pseudo_buffer, fieldnames=default_fields)
                yield writer.writeheader() or ""

        resp = StreamingHttpResponse(row_iter(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f"attachment; filename=table{table_id}.csv"
        return resp

    return JsonResponse({"success": False, "error": "Unsupported format."}, status=400)


@login_required
@require_http_methods(["GET"])  # system info
def system_info(request):
    # Database size for SQLite
    db_path = settings.DATABASES["default"]["NAME"]
    size_bytes = os.path.getsize(db_path) if os.path.exists(db_path) else 0
    total_records = sum(getattr(dash_models, f"Table{i}").objects.count() for i in range(1, 11))
    data = {
        "django_version": django.get_version(),
        "database_size_bytes": size_bytes,
        "total_records": total_records,
        "logs_count": ActivityLog.objects.count(),
    }
    return JsonResponse({"success": True, "data": data})
