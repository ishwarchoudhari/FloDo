from django.http import JsonResponse
from django.db import connection
from django.core.cache import caches
from django.conf import settings


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
