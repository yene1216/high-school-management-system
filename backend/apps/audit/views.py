from rest_framework import viewsets

from apps.core.mixins import SchoolScopedQuerysetMixin
from apps.core.permissions import MANAGEMENT_ROLES, role_required

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(SchoolScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("actor")
    serializer_class = AuditLogSerializer
    permission_classes = [role_required(*MANAGEMENT_ROLES)]
    filterset_fields = ["action", "object_type", "actor"]
    search_fields = ["action", "object_type", "object_id"]
