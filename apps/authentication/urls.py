from django.urls import path
from . import views

app_name = "authentication"

urlpatterns = [
    # Root shows login directly so '/' loads the login page
    path("", views.login_view, name="login"),
    path("login/", views.login_view, name="login"),
    path("signup/", views.signup_view, name="signup"),
    path("logout/", views.logout_view, name="logout"),
    # Preferred API path per spec
    path("api/check-auth/", views.check_auth_status, name="check_auth"),
    # Backward-compatible path retained
    path("auth-status/", views.check_auth_status, name="auth_status"),
    # Admin Profile AJAX endpoints
    path("profile/", views.profile_view, name="profile_view"),              # GET -> HTML partial
    path("profile/update/", views.profile_update, name="profile_update"),   # POST JSON
    path("profile/avatar/", views.profile_avatar_upload, name="profile_avatar"),  # POST file
    path("profile/avatar/delete/", views.profile_avatar_delete, name="profile_avatar_delete"),
    path("profile/password/", views.profile_password_change, name="profile_password"),
    # Super-Admin password reset (Redis OTP)
    path("password-reset/request/", views.superadmin_password_reset_request, name="superadmin_password_reset_request"),
    path("password-reset/verify-otp/", views.superadmin_password_reset_verify_otp, name="superadmin_password_reset_verify_otp"),
    path("password-reset/confirm/", views.superadmin_password_reset_confirm, name="superadmin_password_reset_confirm"),
]
