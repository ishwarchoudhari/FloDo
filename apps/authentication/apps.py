from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.authentication"
    verbose_name = "Authentication"

    def ready(self):  # noqa: D401
        # Import signal handlers
        try:
            from . import signals  # noqa: F401
        except Exception:
            # Don't crash app startup if signals import fails in edge cases
            pass
