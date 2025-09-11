from django import forms
from django.contrib.auth.models import User
from .models import AppSettings


class ProfileForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, required=False)

    class Meta:
        model = User
        fields = ["username", "email"]


class AppSettingsForm(forms.ModelForm):
    class Meta:
        model = AppSettings
        fields = ["app_name", "timezone", "records_per_page", "enable_notifications"]
