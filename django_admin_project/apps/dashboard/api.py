import hashlib
from typing import Optional
from datetime import datetime, timezone
from rest_framework import viewsets, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.utils.http import http_date, parse_http_date
from .models import ActivityLog
from .serializers import ActivityLogSerializer


class DefaultPagination(PageNumberPagination):
    page_size_query_param = "page_size"


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only API for activity logs.

    Auth required. This is additive and does not replace existing JSON endpoints.
    """

    queryset = ActivityLog.objects.select_related("admin_user").all()
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = DefaultPagination
    ordering = ["-timestamp"]

    # ---------------------- ETag helpers ----------------------
    def _etag_for_list(self) -> Optional[str]:
        try:
            latest = self.get_queryset().order_by("-timestamp").values_list("timestamp", flat=True).first()
            count = self.get_queryset().count()
            base = f"{latest.isoformat() if latest else 'none'}:{count}"
            return hashlib.sha256(base.encode()).hexdigest()
        except Exception:
            return None

    def _etag_for_object(self, obj: ActivityLog) -> Optional[str]:
        try:
            base = f"{obj.id}:{obj.timestamp.isoformat()}"
            return hashlib.sha256(base.encode()).hexdigest()
        except Exception:
            return None

    def list(self, request, *args, **kwargs):
        etag = self._etag_for_list()
        # Compute Last-Modified from latest timestamp
        latest_ts = self.get_queryset().order_by("-timestamp").values_list("timestamp", flat=True).first()
        last_modified_header = http_date(latest_ts.timestamp()) if latest_ts else None
        # If-Modified-Since handling
        ims = request.headers.get("If-Modified-Since")
        if latest_ts and ims:
            try:
                ims_seconds = parse_http_date(ims)
                ims_dt = datetime.fromtimestamp(ims_seconds, tz=timezone.utc)
                if latest_ts <= ims_dt and etag and request.headers.get("If-None-Match") == etag:
                    return Response(status=status.HTTP_304_NOT_MODIFIED)
                if latest_ts <= ims_dt and not etag:
                    return Response(status=status.HTTP_304_NOT_MODIFIED)
            except Exception:
                pass
        inm = request.headers.get("If-None-Match")
        if etag and inm == etag:
            return Response(status=status.HTTP_304_NOT_MODIFIED)
        response = super().list(request, *args, **kwargs)
        if etag:
            response["ETag"] = etag
        if last_modified_header:
            response["Last-Modified"] = last_modified_header
        # short-lived cache hints for clients/proxies
        response["Cache-Control"] = "public, max-age=15, must-revalidate"
        return response

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        etag = self._etag_for_object(instance)
        # Last-Modified from instance timestamp
        last_modified_header = http_date(instance.timestamp.timestamp()) if getattr(instance, "timestamp", None) else None
        # If-Modified-Since handling
        ims = request.headers.get("If-Modified-Since")
        if getattr(instance, "timestamp", None) and ims:
            try:
                ims_seconds = parse_http_date(ims)
                ims_dt = datetime.fromtimestamp(ims_seconds, tz=timezone.utc)
                if instance.timestamp <= ims_dt and etag and request.headers.get("If-None-Match") == etag:
                    return Response(status=status.HTTP_304_NOT_MODIFIED)
                if instance.timestamp <= ims_dt and not etag:
                    return Response(status=status.HTTP_304_NOT_MODIFIED)
            except Exception:
                pass
        inm = request.headers.get("If-None-Match")
        if etag and inm == etag:
            return Response(status=status.HTTP_304_NOT_MODIFIED)
        response = super().retrieve(request, *args, **kwargs)
        if etag:
            response["ETag"] = etag
        if last_modified_header:
            response["Last-Modified"] = last_modified_header
        response["Cache-Control"] = "public, max-age=15, must-revalidate"
        return response
