from django.db import models
from django.contrib.auth.models import User


class AppSettings(models.Model):
    app_name = models.CharField(max_length=100, default="Admin Dashboard")
    timezone = models.CharField(max_length=50, default="UTC")
    records_per_page = models.IntegerField(default=10)
    enable_notifications = models.BooleanField(default=True)
    updated_by = models.ForeignKey(User, on_delete=models.CASCADE)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Settings ({self.app_name})"
