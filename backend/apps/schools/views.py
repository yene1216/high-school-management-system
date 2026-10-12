from django.db import transaction
from rest_framework import viewsets

from apps.core.mixins import SchoolOnCreateMixin, SchoolScopedQuerysetMixin
from apps.core.permissions import SCHOOL_ADMIN, role_required, write_roles

from .models import AcademicYear, School, Term
from .serializers import AcademicYearSerializer, SchoolSerializer, TermSerializer


class SchoolViewSet(SchoolScopedQuerysetMixin, viewsets.ModelViewSet):
    """Platform admins manage every school; a school admin can read and edit only their own."""

    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    search_fields = ["name", "code"]

    def get_permissions(self):
        if self.action in ("create", "destroy"):
            return [role_required()()]  # platform admins only (has_role always allows them)
        return [write_roles(SCHOOL_ADMIN)()]


class AcademicYearViewSet(SchoolScopedQuerysetMixin, SchoolOnCreateMixin, viewsets.ModelViewSet):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [write_roles(SCHOOL_ADMIN)]
    filterset_fields = ["is_current"]

    @transaction.atomic
    def _demote_others(self, school, keep_pk=None):
        AcademicYear.objects.filter(school=school, is_current=True).exclude(pk=keep_pk).update(is_current=False)

    def perform_create(self, serializer):
        if serializer.validated_data.get("is_current"):
            self._demote_others(self.request.user.school)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        if serializer.validated_data.get("is_current"):
            self._demote_others(serializer.instance.school, keep_pk=serializer.instance.pk)
        serializer.save()


class TermViewSet(SchoolScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Term.objects.select_related("academic_year")
    serializer_class = TermSerializer
    permission_classes = [write_roles(SCHOOL_ADMIN)]
    filterset_fields = ["academic_year"]
