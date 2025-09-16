from .models import AppSettings
from django.conf import settings

def app_settings(request):
    # Provide app settings to all templates
    try:
        s = AppSettings.objects.select_related("updated_by").order_by("-updated_at").first()
        return {
            "APP_NAME": s.app_name if s else "Admin Dashboard",
            "APP_RECORDS_PER_PAGE": (s.records_per_page if s else 10),
            # Expose GA id to templates for optional GA snippet
            "GA_GTAG_ID": getattr(settings, "GOOGLE_ANALYTICS_GTAG_PROPERTY_ID", ""),
        }
    except Exception:
        return {
            "APP_NAME": "Admin Dashboard",
            "APP_RECORDS_PER_PAGE": 10,
            "GA_GTAG_ID": getattr(settings, "GOOGLE_ANALYTICS_GTAG_PROPERTY_ID", ""),
        }
