from django.urls import path
from . import views

app_name = "client_portal"

urlpatterns = [
    path("", views.portal_home, name="home"),
    path("customer/", views.customer_dashboard, name="customer_dashboard"),
    path("artists/", views.browse_artists, name="browse_artists"),
    path("artist/apply/", views.artist_apply, name="artist_apply"),
    path("artist/application-status/", views.artist_application_status, name="artist_application_status"),
    path("artist/", views.artist_dashboard, name="artist_dashboard"),
    # Client auth (feature-flagged within views)
    path("auth/", views.client_auth, name="client_auth"),
    # Legacy paths route to unified page for backwards compatibility
    path("login/", views.client_login, name="client_login"),
    path("signup/", views.client_signup, name="client_signup"),
    path("logout/", views.client_logout, name="client_logout"),
    path("forgot-password/", views.client_forgot_password, name="client_forgot_password"),
    path("reset-password/<str:token>/", views.client_reset_password, name="client_reset_password"),
    # JSON APIs for AJAX auth
    path("api/login/", views.client_api_login, name="client_api_login"),
    path("api/signup/", views.client_api_signup, name="client_api_signup"),
    path("profile/", views.client_profile, name="client_profile"),
    path("api/profile/", views.client_api_profile, name="client_api_profile"),  # Added: JSON profile for AJAX
    path("api/can-apply/", views.client_api_can_apply, name="client_api_can_apply"),  # Added: form availability
]
