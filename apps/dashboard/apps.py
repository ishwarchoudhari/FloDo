from django.apps import AppConfig
from django.conf import settings


class DashboardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dashboard"
    verbose_name = "Dashboard"

    def ready(self):
        # Import signals only if explicitly enabled to avoid duplicate logging.
        # Views already create one ActivityLog per CRUD operation.
        if getattr(settings, "ENABLE_ACTIVITYLOG_SIGNALS", False):
            from . import signals  # noqa: F401
