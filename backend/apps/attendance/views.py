from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.academics.selectors import teacher_section_ids
from apps.accounts.models import Role
from apps.core.permissions import MANAGEMENT_ROLES, has_role
from apps.core.scoping import scope_queryset
from apps.students.selectors import visible_students

from . import services
from .models import AttendanceCorrection, AttendanceRecord
from .serializers import (
    AttendanceRecordSerializer, BulkAttendanceSerializer, CorrectionRequestSerializer, CorrectionSerializer,
)


class AttendanceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = AttendanceRecordSerializer
    filterset_fields = {"student": ["exact"], "section": ["exact"], "date": ["exact", "gte", "lte"], "status": ["exact"]}

    def get_queryset(self):
        return AttendanceRecord.objects.filter(student__in=visible_students(self.request.user)).select_related("student")

    def create(self, request):
        """POST /attendance/ {section, date, records:[{student, status, note}]}"""
        ser = BulkAttendanceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        saved, skipped = services.mark_attendance(
            actor=request.user, section_id=d["section"], date=d["date"], entries=d["records"], request=request
        )
        return Response(
            {"saved": AttendanceRecordSerializer(saved, many=True).data, "skipped": skipped},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def correct(self, request, pk=None):
        record = self.get_object()
        ser = CorrectionRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        correction = services.request_correction(actor=request.user, record=record, request=request, **ser.validated_data)
        return Response(CorrectionSerializer(correction).data, status=status.HTTP_201_CREATED)


class CorrectionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = CorrectionSerializer
    filterset_fields = ["state", "record"]

    def get_queryset(self):
        user = self.request.user
        qs = scope_queryset(AttendanceCorrection.objects.select_related("record__student"), user)
        if user.role == Role.TEACHER:
            return qs.filter(record__section_id__in=teacher_section_ids(user))
        if not has_role(user, *MANAGEMENT_ROLES, Role.REGISTRAR):
            return qs.none()
        return qs

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        approve = bool(request.data.get("approve"))
        correction = services.review_correction(actor=request.user, correction=self.get_object(), approve=approve, request=request)
        return Response(CorrectionSerializer(correction).data)
