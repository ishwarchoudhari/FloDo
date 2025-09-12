from django.contrib import admin
from . import models


@admin.register(models.ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("table_name", "action", "row_id", "timestamp", "admin_user")
    search_fields = ("table_name", "action", "row_id", "admin_user__username")


# Register all ten tables in a simple way
for i in range(1, 11):
    model = getattr(models, f"Table{i}")
    admin.site.register(model)


@admin.register(models.Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("client_id", "full_name", "phone", "email", "status", "created_at")
    search_fields = ("full_name", "phone", "email")
    list_filter = ("status",)


@admin.register(models.ClientLog)
class ClientLogAdmin(admin.ModelAdmin):
    list_display = ("log_id", "client", "action", "timestamp")
    list_filter = ("action",)
    search_fields = ("client__full_name", "client__phone", "client__email")
