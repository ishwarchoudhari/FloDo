from django.contrib import admin
from django.utils.html import format_html
from . import models


@admin.register(models.ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("table_name", "action", "row_id", "timestamp", "admin_user")
    search_fields = ("table_name", "action", "row_id", "admin_user__username")


# Register all ten tables in a simple way, but customize Table6 below
for i in range(1, 11):
    if i == 6:
        continue
    model = getattr(models, f"Table{i}")
    try:
        admin.site.register(model)
    except admin.sites.AlreadyRegistered:
        pass


@admin.register(models.Client)
class ClientAdmin(admin.ModelAdmin):
    # Added: show active_session_key and a derived active flag for ops visibility
    list_display = ("client_id", "full_name", "phone", "email", "status", "active_session_key", "is_session_active", "created_at")
    search_fields = ("full_name", "phone", "email")
    list_filter = ("status",)

    # Added: derive if a client appears to have an active session (non-empty key)
    def is_session_active(self, obj):  # Added
        try:
            return bool(obj.active_session_key)
        except Exception:
            return False
    is_session_active.boolean = True  # Added: render as a checkmark in admin list
    is_session_active.short_description = "Active?"  # Added


@admin.register(models.ClientLog)
class ClientLogAdmin(admin.ModelAdmin):
    list_display = ("log_id", "client", "action", "timestamp")
    list_filter = ("action",)
    search_fields = ("client__full_name", "client__phone", "client__email")


# Table6 (dashboard_artist_application) admin with new fields exposed
class ArtistApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "unique_id", "name", "city", "phone", "email",
        "application_status", "approved", "approved_at",
        "client", "gender", "dob", "specialization", "verified_badge",
    )
    list_filter = ("application_status", "approved", "verified_badge", "gender", "city")
    search_fields = ("name", "email", "phone", "city", "instagram_username")
    readonly_fields = ("artist_application_id",)

    class CertificateInline(admin.TabularInline):
        model = models.ArtistApplicationCertificate
        extra = 0
        can_delete = False
        fields = ("category", "file", "description", "uploaded_by_client", "external_url", "uploaded_at", "preview")
        readonly_fields = ("category", "file", "description", "uploaded_by_client", "external_url", "uploaded_at", "preview")

        def has_add_permission(self, request, obj=None):
            return False

        def has_change_permission(self, request, obj=None):
            # Read-only inline
            return False

        def preview(self, obj):
            try:
                url = getattr(obj.file, 'url', '')
                if not url:
                    return ""
                lower = url.lower()
                if any(lower.endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.webp')):
                    return format_html('<img src="{}" style="max-height:90px; max-width:160px; border:1px solid #ddd; border-radius:4px;" />', url)
                # Non-image: show a link
                return format_html('<a href="{}" target="_blank" rel="noopener">Open file</a>', url)
            except Exception:
                return ""
        preview.short_description = "Preview"

    inlines = [CertificateInline]


try:
    admin.site.register(models.Table6, ArtistApplicationAdmin)
except admin.sites.AlreadyRegistered:
    try:
        admin.site.unregister(models.Table6)
    except Exception:
        pass
    admin.site.register(models.Table6, ArtistApplicationAdmin)


@admin.register(models.ArtistApplicationCertificate)
class ArtistApplicationCertificateAdmin(admin.ModelAdmin):
    list_display = ("id", "application", "category", "uploaded_by_client", "uploaded_at")
    list_filter = ("category", "uploaded_at")
    search_fields = ("application__name", "application__email", "application__phone")
