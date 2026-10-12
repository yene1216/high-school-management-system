from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from apps.academics.selectors import teacher_section_ids
from apps.accounts.models import Role
from apps.core.permissions import has_role
from apps.core.scoping import scope_queryset
from apps.schools.models import Term
from apps.students.selectors import visible_students

from . import services
from .models import Assessment
from .serializers import AssessmentSerializer, GradeEntrySerializer, GradeSerializer

GRADING_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER)


class AssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssessmentSerializer
    filterset_fields = ["section", "subject", "term", "is_published"]

    def get_queryset(self):
        user = self.request.user
        if not has_role(user, *GRADING_ROLES):
            return Assessment.objects.none()
        qs = scope_queryset(Assessment.objects.select_related("subject", "section__grade_level"), user)
        if user.role == Role.TEACHER:
            qs = qs.filter(section_id__in=teacher_section_ids(user))
        return qs

    def _check(self, serializer):
        data = serializer.validated_data
        probe = Assessment(section=data["section"], subject=data["subject"])
        if not services.can_grade(self.request.user, probe):
            raise PermissionDenied("You do not teach this subject in this section.")

    def perform_create(self, serializer):
        self._check(serializer)
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.is_published:
            raise ValidationError("Published assessments cannot be edited.")
        serializer.save()

    @action(detail=True, methods=["get", "put"])
    def grades(self, request, pk=None):
        assessment = self.get_object()
        if request.method == "GET":
            return Response(GradeSerializer(assessment.grades.select_related("student", "assessment__subject"), many=True).data)
        ser = GradeEntrySerializer(data=request.data.get("records", []), many=True)
        ser.is_valid(raise_exception=True)
        grades = services.enter_grades(actor=request.user, assessment=assessment, entries=ser.validated_data, request=request)
        return Response(GradeSerializer(grades, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        assessment = services.publish(actor=request.user, assessment=self.get_object(), request=request)
        return Response(AssessmentSerializer(assessment).data)


class ReportCardView(APIView):
    """GET /report-cards/?student=<id>[&term=<id>] - published results only."""

    def get(self, request):
        student = visible_students(request.user).filter(pk=request.query_params.get("student") or 0).first()
        if not student:
            return Response({"detail": "Student not found."}, status=status.HTTP_404_NOT_FOUND)
        term = None
        if request.query_params.get("term"):
            term = scope_queryset(Term.objects.all(), request.user).filter(pk=request.query_params["term"]).first()
            if term is None:
                return Response({"detail": "Term not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(services.report_card(student, term))
