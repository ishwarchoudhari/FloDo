from rest_framework import serializers
from django.contrib.auth.models import User
from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    admin_user = serializers.SlugRelatedField(
        slug_field="username", read_only=True
    )

    class Meta:
        model = ActivityLog
        fields = (
            "id",
            "table_name",
            "action",
            "row_id",
            "row_details",
            "timestamp",
            "admin_user",
        )
        read_only_fields = fields
