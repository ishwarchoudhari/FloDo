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
    path("login/", views.client_login, name="client_login"),
    path("signup/", views.client_signup, name="client_signup"),
    path("logout/", views.client_logout, name="client_logout"),
    path("forgot-password/", views.client_forgot_password, name="client_forgot_password"),
    path("reset-password/<str:token>/", views.client_reset_password, name="client_reset_password"),
]
