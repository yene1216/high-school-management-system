from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.audit.services import log as audit_log
from apps.core.mixins import SchoolOnCreateMixin, SchoolScopedQuerysetMixin
from apps.core.permissions import SCHOOL_ADMIN, write_roles
from apps.core.scoping import scope_queryset

from .models import Enrollment, GradeLevel, Section, Subject, TeacherAssignment
from .selectors import teacher_section_ids
from .serializers import (
    EnrollmentSerializer, GradeLevelSerializer, SectionSerializer, SubjectSerializer, TeacherAssignmentSerializer,
)


class GradeLevelViewSet(SchoolScopedQuerysetMixin, SchoolOnCreateMixin, viewsets.ModelViewSet):
    queryset = GradeLevel.objects.all()
    serializer_class = GradeLevelSerializer
    permission_classes = [write_roles(SCHOOL_ADMIN)]


class SubjectViewSet(SchoolScopedQuerysetMixin, SchoolOnCreateMixin, viewsets.ModelViewSet):
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [write_roles(SCHOOL_ADMIN)]
    search_fields = ["name", "code"]


class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    permission_classes = [write_roles(SCHOOL_ADMIN)]
    filterset_fields = ["grade_level", "academic_year"]

    def get_queryset(self):
        user = self.request.user
        qs = scope_queryset(Section.objects.select_related("grade_level"), user)
        if user.role == Role.TEACHER:
            qs = qs.filter(id__in=teacher_section_ids(user))
        elif user.role in (Role.PARENT, Role.STUDENT):
            return qs.none()
        return qs

    @action(detail=True, methods=["get"])
    def roster(self, request, pk=None):
        """Active students in the section (used by the attendance screen)."""
        section = self.get_object()
        rows = (
            Enrollment.objects.filter(section=section, status="active")
            .select_related("student")
            .order_by("student__last_name", "student__first_name")
        )
        return Response([{"id": e.student_id, "name": e.student.full_name, "code": e.student.student_code} for e in rows])


class TeacherAssignmentViewSet(SchoolScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = TeacherAssignment.objects.select_related("teacher", "section", "subject")
    serializer_class = TeacherAssignmentSerializer
    permission_classes = [write_roles(SCHOOL_ADMIN)]
    filterset_fields = ["teacher", "section", "subject"]


class EnrollmentViewSet(SchoolScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Enrollment.objects.select_related("student", "section__grade_level")
    serializer_class = EnrollmentSerializer
    permission_classes = [write_roles(SCHOOL_ADMIN, Role.REGISTRAR)]
    filterset_fields = ["section", "status", "student", "academic_year"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role in (Role.PARENT, Role.STUDENT):
            return qs.none()
        if self.request.user.role == Role.TEACHER:
            return qs.filter(section_id__in=teacher_section_ids(self.request.user))
        return qs

    def perform_create(self, serializer):
        enrollment = serializer.save()
        audit_log(self.request.user, "enrollment.created", enrollment, {"section": enrollment.section_id}, request=self.request)
