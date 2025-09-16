"""
URL configuration for django_admin_project.
Includes app-specific URLconfs.
"""
from django.contrib import admin  # Django admin site
from django.urls import path, include, re_path  # Path and include utilities for URL routing
from django.conf import settings  # Access settings for static/media serving in dev
from django.conf.urls.static import static  # Helper to serve static/media files in dev
from django.views.generic import RedirectView
from apps.authentication import views as auth_views
from rest_framework.routers import DefaultRouter
from apps.dashboard.api import ActivityLogViewSet
from . import health as health_views

urlpatterns = [
    # Admin site URL (includes its own /admin/login/)
    path("admin/", admin.site.urls),
    # Root -> login page
    path("", RedirectView.as_view(pattern_name="authentication:login", permanent=False)),
    # App URL includes
    # Super-Admin scoped routes
    path("Super-Admin/auth/", include("apps.authentication.urls")),  # Authentication routes (login, signup)
    path("Super-Admin/", include("apps.dashboard.urls")),            # Dashboard and admin management routes
    path(
        "Super-Admin/dashboard/",
        RedirectView.as_view(pattern_name="dashboard:index", permanent=False),
    ),
    path("Super-Admin/settings/", include("apps.settings_app.urls")),  # Settings routes
    path("portal/", include("apps.client_portal.urls")),  # Public Client Portal
    # Redirect legacy admin page routes under /dashboard/... to /Super-Admin/... while preserving APIs
    re_path(r"^dashboard/$", RedirectView.as_view(url="/Super-Admin/dashboard/", permanent=False)),
    re_path(
        r"^dashboard/(?P<rest>(?!api/).*)$",
        RedirectView.as_view(url="/Super-Admin/%(rest)s", permanent=False),
    ),
    # Keep API endpoints exactly the same under /dashboard/api/... by also including dashboard here
    path("dashboard/", include("apps.dashboard.urls")),
    # Legacy compatibility direct mappings (avoid redirects to support POST)
    path("login/", auth_views.login_view, name="legacy_login"),
    path("signup/", auth_views.signup_view, name="legacy_signup"),
    path("logout/", auth_views.logout_view, name="legacy_logout"),
    # Health and readiness endpoints (lightweight, JSON)
    path("healthz", health_views.healthz, name="healthz"),
    path("readinessz", health_views.readinessz, name="readinessz"),
    # (Employees Administration routes have been removed)
]

# DRF router (additive, non-breaking): exposes /api/v1/logs/
router = DefaultRouter()
router.register(r"v1/logs", ActivityLogViewSet, basename="activitylog")
urlpatterns += [
    path("api/", include(router.urls)),
]

# In development, serve static and media files
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

