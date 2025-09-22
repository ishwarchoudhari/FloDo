from django.db import models
from django.core.validators import FileExtensionValidator
from django.conf import settings
import uuid
from django.contrib.auth.models import User


# Base mixin for common fields
class BaseTable(models.Model):
    unique_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, db_index=True)
    city = models.CharField(max_length=100, db_index=True)
    phone = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["city"]),
        ]


class Table1(BaseTable):
    # Extended fields for Admin Management (additive, backward-compatible)
    user_name = models.CharField(max_length=150, unique=True, db_index=True, blank=True)
    password_hash = models.CharField(max_length=128, blank=True)
    ROLE_CHOICES = (
        ("user", "User"),
        ("admin", "Admin"),
        ("super", "Super"),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")
    is_active = models.BooleanField(default=True)
    role_approvedby = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    # Set physical database table name to descriptive, stable identifier  # added
    class Meta:  # added
        db_table = "dashboard_admin"  # added: was dashboard_table1


class Table2(BaseTable):
    class Meta:  # added
        db_table = "dashboard_user"  # added: was dashboard_table2


class Table3(BaseTable):
    class Meta:  # added
        db_table = "dashboard_verified_artist"  # added: was dashboard_table3


class Table4(BaseTable):
    class Meta:  # added
        db_table = "dashboard_payment"  # added: was dashboard_table4


class Table5(BaseTable):
    class Meta:  # added
        db_table = "dashboard_artist_service"  # added: was dashboard_table5


def validate_file_size(value):
    max_bytes = 10 * 1024 * 1024  # 10MB
    if value and hasattr(value, "size") and value.size > max_bytes:
        from django.core.exceptions import ValidationError
        raise ValidationError("File too large (max 10MB)")


class Table6(BaseTable):
    # Extended fields for Artist Application (backward-compatible)
    artist_application_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, null=True, blank=True)
    approved = models.BooleanField(default=False)
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_admin = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="approved_artist_applications")
    application_status = models.CharField(
        max_length=32,
        choices=(
            ("processing", "Processing"),
            ("under_review", "Under Review"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("pending", "Pending"),
        ),
        default="pending",
        db_index=True,
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="artist_applications")
    email = models.EmailField(null=True, blank=True)
    years_experience = models.PositiveIntegerField(default=0)
    # Additive client linkage and profile metadata (nullable for backward-compat)
    client = models.ForeignKey('Client', null=True, blank=True, on_delete=models.SET_NULL, related_name='artist_applications', db_index=True)
    GENDER_CHOICES = (
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
        ('prefer_not_to_say', 'Prefer not to say'),
    )
    gender = models.CharField(max_length=24, null=True, blank=True, choices=GENDER_CHOICES)
    dob = models.DateField(null=True, blank=True)
    profile_picture = models.ImageField(upload_to='artist_profiles/%Y/%m/%d/', null=True, blank=True,
        validators=[FileExtensionValidator(allowed_extensions=["png","jpg","jpeg","webp"]), validate_file_size])
    specialization = models.CharField(max_length=255, null=True, blank=True)
    instagram_url = models.URLField(max_length=512, null=True, blank=True)
    instagram_username = models.CharField(max_length=255, null=True, blank=True)
    beauty_studio_location = models.TextField(null=True, blank=True)
    additional_notes = models.TextField(null=True, blank=True)
    reapply_reason = models.TextField(null=True, blank=True)
    verified_badge = models.BooleanField(default=False)
    mfa_enabled = models.BooleanField(default=False)
    supporting_details = models.JSONField(null=True, blank=True)
    class Meta:  # added
        db_table = "dashboard_artist_application"  # added: was dashboard_table6


 


class ArtistApplicationCertificate(models.Model):
    application = models.ForeignKey(Table6, on_delete=models.CASCADE, related_name="certificates")
    file = models.FileField(
        upload_to="artist_certificates/%Y/%m/%d/",
        validators=[
            FileExtensionValidator(allowed_extensions=["pdf", "png", "jpg", "jpeg", "webp"]),
            validate_file_size,
        ],
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    # Extended to support pictures/profile pic and metadata (backward-compatible)
    CATEGORY_CHOICES = (
        ('certificate', 'Certificate'),
        ('supporting_picture', 'Supporting Picture'),
        ('profile_picture', 'Profile Picture'),
    )
    category = models.CharField(max_length=32, default='certificate', choices=CATEGORY_CHOICES)
    description = models.CharField(max_length=255, null=True, blank=True)
    uploaded_by_client = models.ForeignKey('Client', null=True, blank=True, on_delete=models.SET_NULL)
    external_url = models.URLField(max_length=512, null=True, blank=True)

    class Meta:
        db_table = "dashboard_artist_application_certificate"


class Table7(BaseTable):
    class Meta:  # added
        db_table = "dashboard_artist_availability"  # added: was dashboard_table7


class Table8(BaseTable):
    class Meta:  # added
        db_table = "dashboard_artist_calendar"  # added: was dashboard_table8


class Table9(BaseTable):
    # Optional link to Client; additive and nullable to avoid breaking flows
    client = models.ForeignKey('Client', null=True, blank=True, on_delete=models.SET_NULL, related_name="bookings")

    class Meta:  # added
        db_table = "dashboard_booking"  # added: was dashboard_table9


class Table10(BaseTable):
    # Optional link to Client
    client = models.ForeignKey('Client', null=True, blank=True, on_delete=models.SET_NULL, related_name="messages")

    class Meta:  # added
        db_table = "dashboard_message"  # added: was dashboard_table10


class ActivityLog(models.Model):
    table_name = models.CharField(max_length=50)
    action = models.CharField(max_length=10)  # CREATE, UPDATE, DELETE
    row_id = models.IntegerField()
    row_details = models.JSONField()
    timestamp = models.DateTimeField(auto_now_add=True)
    admin_user = models.ForeignKey(User, on_delete=models.CASCADE)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self) -> str:
        return f"{self.table_name} {self.action} #{self.row_id} by {self.admin_user_id}"

"""
New client models (additive, reversible):
- Client: dedicated end-user entity, separate from auth_user and dashboard_admin
- ClientLog: audit log for client actions and admin operations on clients
Also adding optional ForeignKey references from Booking (Table9) and Message (Table10) to Client.
"""

import uuid
from django.conf import settings


class Client(models.Model):
    client_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, unique=True)
    email = models.EmailField(max_length=255, unique=True, null=True, blank=True)
    password = models.CharField(max_length=128)  # store Django hashed password
    location = models.CharField(max_length=255, null=True, blank=True)
    STATUS_CHOICES = (("Active", "Active"), ("Inactive", "Inactive"))
    status = models.CharField(max_length=8, choices=STATUS_CHOICES, default="Active")
    # Added: single-session enforcement (stores the only valid session key for this client)
    active_session_key = models.CharField(max_length=64, null=True, blank=True)  # Added
    # Added: Super-admin override to allow reapplication for artist applications
    allow_reapply = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dashboard_client"
        indexes = [
            models.Index(fields=["phone"]),
            models.Index(fields=["email"]),
        ]

    def __str__(self) -> str:
        return f"Client {self.full_name} ({self.phone})"


class ClientLog(models.Model):
    log_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name="logs")
    ACTION_CHOICES = (
        ("CREATE", "CREATE"),
        ("UPDATE", "UPDATE"),
        ("DELETE", "DELETE"),
        ("LOGIN", "LOGIN"),
        ("LOGOUT", "LOGOUT"),
        ("PASSWORD_RESET", "PASSWORD_RESET"),
        ("BOOKING", "BOOKING"),
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="client_logs_performed")
    details = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "dashboard_client_log"
        indexes = [
            models.Index(fields=["action"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self) -> str:
        return f"ClientLog {self.action} for {self.client_id} @ {self.timestamp}"


# End of client-related additive changes
