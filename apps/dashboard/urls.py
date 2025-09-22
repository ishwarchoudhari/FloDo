from django.urls import path
from . import views

app_name = "dashboard"

urlpatterns = [
    path("", views.dashboard_view, name="index"),
    path("tables/", views.tables_view, name="tables"),
    path("artist-applications/", views.artist_applications_view, name="artist_applications"),
    path("api/artist-applications/pending_count/", views.artist_applications_pending_count, name="artist_applications_pending_count"),
    path("artist-applications/<int:app_id>/approve/", views.artist_application_approve_view, name="artist_application_approve"),
    path("artist-applications/<int:app_id>/reject/", views.artist_application_reject_view, name="artist_application_reject"),
    # Allow reapply (strictly for rejected application only) and per-client override
    path("artist-applications/<int:app_id>/allow-reapply/", views.artist_application_allow_reapply_view, name="artist_application_allow_reapply"),
    path("api/table/<int:table_id>/", views.get_table_data, name="get_table_data"),
    path("api/table/<int:table_id>/row/", views.table_crud_api, name="create_row"),
    path("api/table/<int:table_id>/row/<int:row_id>/", views.table_crud_api, name="row_ops"),
    path("api/table/config/", views.update_table_config, name="update_table_config"),
    path("api/logs/", views.get_logs, name="get_logs"),
    # Admin Management routes
    path("Admin_management/", views.admin_mgmt_view, name="admin_mgmt"),
    path("api/admins/", views.admin_list_create_api, name="admin_list_create"),
    path("api/admins/<int:user_id>/", views.admin_detail_api, name="admin_detail"),
    # Clients (portal signups)
    path("clients/", views.clients_view, name="clients"),
    path("api/clients/", views.clients_list_api, name="clients_list"),
    path("api/clients/<uuid:client_id>/allow-reapply/", views.client_allow_reapply_api, name="client_allow_reapply"),
]
