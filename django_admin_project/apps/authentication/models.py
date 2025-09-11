from django.db import models
from django.contrib.auth.models import User


class SuperAdmin(models.Model):
    # One-to-one link with Django's built-in User
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="super_admin_profile")
    is_super_admin = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    def __str__(self) -> str:
        return f"SuperAdmin: {self.user.username}"


class AdminProfile(models.Model):
    """Profile information for admin user, linked 1:1 to Django User."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="admin_profile")
    # Optional avatar
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    # Basic fields
    display_name = models.CharField(max_length=150, blank=True, default="")
    role = models.CharField(max_length=100, blank=True, default="Admin")
    bio = models.TextField(blank=True, default="")
    location = models.CharField(max_length=120, blank=True, default="")
    birth_date = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=32, blank=True, default="")  # includes country code (e.g., +91 9876543210)
    status = models.CharField(max_length=20, blank=True, default="online")  # online/offline
    last_sign_in = models.DateTimeField(null=True, blank=True)
    # Social links as JSON: {"twitter": "", "github": "", ...}
    social_links = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"AdminProfile: {self.user.username}"
