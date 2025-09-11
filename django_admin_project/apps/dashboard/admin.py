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
