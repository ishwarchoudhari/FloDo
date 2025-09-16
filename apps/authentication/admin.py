from django.contrib import admin
from django import forms
from django.utils.html import mark_safe
from .models import AdminProfile

class AdminProfileForm(forms.ModelForm):
    # Use a JSON-aware field with Textarea for inline editing/validation
    social_links = forms.JSONField(
        required=False,
        widget=forms.Textarea(attrs={
            'rows': 6,
            'style': 'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;'
        }),
        help_text="Provide a JSON object, e.g. {\"twitter\": \"https://x.com/you\"}"
    )

    class Meta:
        model = AdminProfile
        fields = '__all__'


@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    form = AdminProfileForm
    list_display = (
        'avatar_thumb', 'user', 'display_name', 'role', 'email_display', 'phone', 'status', 'last_sign_in'
    )
    list_filter = ('status', 'role',)
    search_fields = ('user__username', 'user__email', 'display_name', 'phone', 'location')
    readonly_fields = ('created_at', 'updated_at', 'last_sign_in')

    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Avatar & Status', {
            'fields': ('avatar', 'status', 'last_sign_in')
        }),
        ('Profile', {
            'fields': ('display_name', 'role', 'bio', 'location', 'birth_date')
        }),
        ('Contact', {
            'fields': ('phone',)
        }),
        ('Social Links', {
            'fields': ('social_links',)
        }),
        ('Meta', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    def avatar_thumb(self, obj):
        if obj.avatar and hasattr(obj.avatar, 'url'):
            return mark_safe(f"<img src='{obj.avatar.url}' style='height:32px;width:32px;border-radius:50%;object-fit:cover' alt='avatar' />")
        # Inline SVG placeholder (gray user icon)
        svg = (
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' "
            "style='height:32px;width:32px;color:#9CA3AF;background:#F3F4F6;border-radius:50%;padding:4px;'>"
            "<path fill-rule='evenodd' d='M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z' clip-rule='evenodd'/></svg>"
        )
        return mark_safe(svg)
    avatar_thumb.short_description = 'Avatar'

    def email_display(self, obj):
        return obj.user.email
    email_display.short_description = 'Email'
