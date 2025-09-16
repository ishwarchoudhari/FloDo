from django.urls import path
from . import views

app_name = "settings_app"

urlpatterns = [
    path("", views.settings_home, name="index"),
    path("profile/", views.profile_update, name="profile"),
    path("app/", views.app_update, name="app"),
    path("export/<str:fmt>/<int:table_id>/", views.export_table, name="export_table"),
    path("system-info/", views.system_info, name="system_info"),
]
