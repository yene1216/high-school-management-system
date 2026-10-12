import csv
import io
import mimetypes

from django.db import transaction
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.audit.services import log as audit_log
from apps.core.mixins import SchoolOnCreateMixin, SchoolScopedQuerysetMixin
from apps.core.permissions import has_role, write_roles

from .models import Guardian, Student, StudentDocument, SupportRecord
from .selectors import can_view_support_records, visible_students
from .serializers import (
    GuardianSerializer, GuardianStudentSerializer, StudentDocumentSerializer, StudentSerializer, SupportRecordSerializer,
)

REGISTRY_ROLES = (Role.SCHOOL_ADMIN, Role.REGISTRAR)


class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer
    permission_classes = [write_roles(*REGISTRY_ROLES)]
    filterset_fields = ["status", "gender", "enrollments__section"]
    search_fields = ["first_name", "last_name", "student_code"]
    ordering_fields = ["last_name", "first_name", "admission_date"]

    def get_queryset(self):
        return visible_students(self.request.user).prefetch_related(
            "enrollments__section__grade_level", "guardian_links__guardian"
        )

    def perform_create(self, serializer):
        user = self.request.user
        if not user.school_id:
            raise PermissionDenied("Attach this account to a school first.")
        student = serializer.save(school=user.school)
        audit_log(user, "student.created", student, request=self.request)

    def perform_update(self, serializer):
        student = serializer.save()
        audit_log(self.request.user, "student.updated", student, {"fields": list(serializer.validated_data)}, request=self.request)

    # --- nested resources -------------------------------------------------------
    @action(detail=True, methods=["get", "post"])
    def guardians(self, request, pk=None):
        student = self.get_object()
        if request.method == "GET":
            links = student.guardian_links.select_related("guardian")
            return Response(GuardianStudentSerializer(links, many=True, context={"request": request}).data)
        if not has_role(request.user, *REGISTRY_ROLES):
            raise PermissionDenied()
        ser = GuardianStudentSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        if student.guardian_links.filter(guardian=ser.validated_data["guardian"]).exists():
            return Response({"guardian": "This guardian is already linked to the student."}, status=status.HTTP_400_BAD_REQUEST)
        link = ser.save(student=student)
        audit_log(request.user, "student.guardian_linked", student, {"guardian": link.guardian_id}, request=request)
        return Response(GuardianStudentSerializer(link, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def photo(self, request, pk=None):
        """Photos are private: streamed only to users who can already see the student."""
        student = self.get_object()
        if not student.photo:
            raise NotFound()
        response = FileResponse(student.photo.open("rb"), content_type=mimetypes.guess_type(student.photo.name)[0] or "application/octet-stream")
        response["Cache-Control"] = "private, no-store"
        return response

    @action(detail=True, methods=["get"])
    def attendance(self, request, pk=None):
        from apps.attendance.models import AttendanceRecord
        from apps.attendance.serializers import AttendanceRecordSerializer

        student = self.get_object()
        qs = AttendanceRecord.objects.filter(student=student).select_related("student").order_by("-date")
        if request.query_params.get("from"):
            qs = qs.filter(date__gte=request.query_params["from"])
        if request.query_params.get("to"):
            qs = qs.filter(date__lte=request.query_params["to"])
        return Response(AttendanceRecordSerializer(qs[:200], many=True).data)

    @action(detail=True, methods=["get"])
    def grades(self, request, pk=None):
        from apps.assessments.models import Grade
        from apps.assessments.serializers import GradeSerializer

        student = self.get_object()
        qs = Grade.objects.filter(student=student).select_related("assessment__subject").order_by("-assessment__date")
        if request.user.role in (Role.PARENT, Role.STUDENT):
            qs = qs.filter(assessment__is_published=True)  # families never see unpublished marks
        return Response(GradeSerializer(qs[:200], many=True).data)

    @action(detail=True, methods=["get"])
    def invoices(self, request, pk=None):
        from apps.billing.selectors import visible_invoices
        from apps.billing.serializers import InvoiceSerializer

        student = self.get_object()
        qs = visible_invoices(request.user).filter(student=student).prefetch_related("items")
        return Response(InvoiceSerializer(qs, many=True).data)

    @action(detail=True, methods=["get", "put"], url_path="support-record")
    def support_record(self, request, pk=None):
        student = self.get_object()
        if not can_view_support_records(request.user):
            raise PermissionDenied("Support records are restricted to counselors and school admins.")
        record, _ = SupportRecord.objects.get_or_create(student=student)
        if request.method == "PUT":
            ser = SupportRecordSerializer(record, data=request.data, partial=True, context={"request": request})
            ser.is_valid(raise_exception=True)
            ser.save()
            audit_log(request.user, "student.support_record_updated", student, request=request)
            return Response(ser.data)
        audit_log(request.user, "student.support_record_viewed", student, request=request)
        return Response(SupportRecordSerializer(record, context={"request": request}).data)

    # --- CSV import with validation + duplicate detection -----------------------------
    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser], url_path="import")
    def import_csv(self, request):
        """Columns: first_name,last_name,date_of_birth(YYYY-MM-DD),gender(M/F)[,middle_name,address]"""
        if not has_role(request.user, *REGISTRY_ROLES):
            raise PermissionDenied()
        upload = request.FILES.get("file")
        if not upload:
            return Response({"file": "Upload a CSV file."}, status=status.HTTP_400_BAD_REQUEST)
        school = request.user.school
        reader = csv.DictReader(io.StringIO(upload.read().decode("utf-8-sig")))
        created, duplicates, errors = 0, [], []
        with transaction.atomic():
            for line, row in enumerate(reader, start=2):
                ser = StudentSerializer(
                    data={k: (row.get(k) or "").strip() for k in ("first_name", "middle_name", "last_name", "date_of_birth", "gender", "address")},
                    context={"request": request},
                )
                if not ser.is_valid():
                    errors.append({"line": line, "errors": ser.errors})
                    continue
                d = ser.validated_data
                if Student.objects.filter(
                    school=school, first_name__iexact=d["first_name"], last_name__iexact=d["last_name"], date_of_birth=d["date_of_birth"]
                ).exists():
                    duplicates.append({"line": line, "name": f'{d["first_name"]} {d["last_name"]}'})
                    continue
                ser.save(school=school)
                created += 1
        audit_log(request.user, "student.bulk_import", None, {"created": created}, request=request, school=school)
        return Response({"created": created, "duplicates": duplicates, "errors": errors})


class GuardianViewSet(SchoolScopedQuerysetMixin, SchoolOnCreateMixin, viewsets.ModelViewSet):
    queryset = Guardian.objects.all()
    serializer_class = GuardianSerializer
    permission_classes = [write_roles(*REGISTRY_ROLES)]
    search_fields = ["first_name", "last_name", "phone", "email"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == Role.PARENT:
            return qs.filter(user=self.request.user)
        if self.request.user.role in (Role.TEACHER, Role.STUDENT):
            return qs.none()
        return qs


class StudentDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentDocumentSerializer
    permission_classes = [write_roles(*REGISTRY_ROLES)]
    filterset_fields = ["student", "status"]

    def get_queryset(self):
        # ID and birth documents are sensitive: teachers and other staff never see them.
        if not has_role(self.request.user, Role.SCHOOL_ADMIN, Role.REGISTRAR, Role.PRINCIPAL, Role.PARENT):
            return StudentDocument.objects.none()
        return StudentDocument.objects.filter(student__in=visible_students(self.request.user))

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        doc = self.get_object()
        audit_log(request.user, "student.document_downloaded", doc.student, {"doc": doc.pk}, request=request)
        response = FileResponse(doc.file.open("rb"), as_attachment=True, filename=f"{doc.doc_type}-{doc.pk}{doc.file.name[doc.file.name.rfind('.'):]}")
        response["Cache-Control"] = "private, no-store"
        return response

    @action(detail=True, methods=["post"])
    def verify(self, request, pk=None):
        doc = self.get_object()
        if not has_role(request.user, *REGISTRY_ROLES):
            raise PermissionDenied()
        doc.status = request.data.get("status", StudentDocument.Status.VERIFIED)
        if doc.status not in StudentDocument.Status.values:
            return Response({"status": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        doc.verified_by = request.user
        doc.save(update_fields=["status", "verified_by", "updated_at"])
        audit_log(request.user, "student.document_" + doc.status, doc.student, {"doc": doc.pk}, request=request)
        return Response(StudentDocumentSerializer(doc).data)
