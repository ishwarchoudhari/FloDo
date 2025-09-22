from django.http import JsonResponse, HttpResponse  # Added: HttpResponse for empty 204 replies
from django.db import connection
from django.core.cache import caches  # Added: for lightweight rate-limit of CSP reports
from django.conf import settings
import json  # Added: parse JSON bodies for CSP reports
import logging  # Added: log CSP violations server-side

# Added: safe optional ratelimit decorator import (no-op fallback if not installed)
try:
    from ratelimit.decorators import ratelimit as rl_decorator  # type: ignore
except Exception:  # pragma: no cover - safe fallback
    def rl_decorator(*args, **kwargs):
        def _wrap(f):
            return f
        return _wrap


def healthz(request):
    """Lightweight liveness probe: process is up, Django can handle a request."""
    return JsonResponse({"ok": True})


def readinessz(request):
    """Readiness probe: checks DB connectivity and cache if configured.

    Always returns JSON and never raises uncaught exceptions to avoid crashing health checks.
    """
    status = {"db": False, "cache": None}
    # DB check
    try:
        connection.ensure_connection()
        status["db"] = True
    except Exception:
        status["db"] = False

    # Cache check (only if Redis configured)
    try:
        if getattr(settings, "REDIS_CACHE_URL", ""):
            cache = caches["default"]
            cache.set("__readiness_probe__", "1", timeout=5)
            val = cache.get("__readiness_probe__")
            status["cache"] = bool(val == "1")
        else:
            status["cache"] = None
    except Exception:
        status["cache"] = False

    http_status = 200 if status["db"] is True and (status["cache"] in (True, None)) else 503
    return JsonResponse({"ok": http_status == 200, "status": status}, status=http_status)


# Added: CSP report endpoint (report-only). Logs violation reports to logger and Sentry (if configured).
# Notes:
# - Kept minimal and safe. Does not block; returns 204 No Content.
# - Rate-limited to avoid abuse.
@rl_decorator(key="ip", rate="60/m", block=True)
def csp_report(request):
    """Accept CSP violation reports in report-only mode.

    Expects application/json or application/csp-report. We log a sanitized subset.
    """
    if request.method != "POST":  # Added: only accept POST
        return HttpResponse(status=405)
    try:
        # Added: parse body depending on content type
        content_type = (request.META.get("CONTENT_TYPE") or "").split(";")[0].strip().lower()
        raw = request.body.decode("utf-8", errors="ignore") if request.body else "{}"
        data = {}
        if content_type in {"application/json", "application/csp-report"}:
            try:
                data = json.loads(raw) or {}
            except Exception:
                data = {}
        # Added: sanitize and extract report body (avoid PII; include blocked-uri, violated-directive, effective-directive)
        report = data.get("csp-report") or data.get("report") or data
        payload = {
            "blocked_uri": (report or {}).get("blocked-uri"),
            "violated_directive": (report or {}).get("violated-directive"),
            "effective_directive": (report or {}).get("effective-directive"),
            "document_uri": (report or {}).get("document-uri"),
            "referrer": (report or {}).get("referrer"),
        }
        # Added: include source IP and path (no other PII)
        ip = (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0] or request.META.get("REMOTE_ADDR") or "?")
        payload.update({"ip": ip, "path": request.path})
        # Added: log to application logger
        logging.getLogger("security.csp").warning("CSP report: %s", payload)
        # Added: send to Sentry if configured
        try:
            if getattr(settings, "SENTRY_DSN", "").strip():
                import sentry_sdk  # type: ignore
                sentry_sdk.capture_message(f"CSP report: {payload}", level="warning")
        except Exception:
            pass
    except Exception:
        # Added: never raise from reporting endpoint
        pass
    return HttpResponse(status=204)  # Added: no content, success
