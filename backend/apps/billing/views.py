from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.academics.models import GradeLevel
from apps.accounts.models import Role
from apps.core.mixins import SchoolOnCreateMixin, SchoolScopedQuerysetMixin
from apps.core.permissions import FINANCE_ROLES, has_role, write_roles
from apps.core.scoping import scope_queryset
from apps.schools.models import AcademicYear
from apps.students.selectors import visible_students

from . import services
from .models import Discount, FeeCategory, FeeStructure, StudentDiscount
from .selectors import visible_invoices
from .serializers import (
    BulkGenerateSerializer, DiscountSerializer, FeeCategorySerializer, FeeStructureSerializer, GenerateInvoiceSerializer,
    InvoiceSerializer, StudentDiscountSerializer,
)

BILLING_WRITERS = (Role.SCHOOL_ADMIN, Role.ACCOUNTANT)


class FeeCategoryViewSet(SchoolScopedQuerysetMixin, SchoolOnCreateMixin, viewsets.ModelViewSet):
    queryset = FeeCategory.objects.all()
    serializer_class = FeeCategorySerializer
    permission_classes = [write_roles(*BILLING_WRITERS)]


class FeeStructureViewSet(SchoolScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = FeeStructure.objects.select_related("category")
    serializer_class = FeeStructureSerializer
    permission_classes = [write_roles(*BILLING_WRITERS)]
    filterset_fields = ["academic_year", "grade_level", "category"]


class DiscountViewSet(SchoolScopedQuerysetMixin, SchoolOnCreateMixin, viewsets.ModelViewSet):
    queryset = Discount.objects.all()
    serializer_class = DiscountSerializer
    permission_classes = [write_roles(*BILLING_WRITERS)]


class StudentDiscountViewSet(SchoolScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = StudentDiscount.objects.select_related("discount")
    serializer_class = StudentDiscountSerializer
    permission_classes = [write_roles(*BILLING_WRITERS)]
    filterset_fields = ["student"]

    def get_queryset(self):
        qs = super().get_queryset()
        return qs if has_role(self.request.user, *FINANCE_ROLES) else qs.none()


class InvoiceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = InvoiceSerializer
    filterset_fields = ["student", "status", "academic_year"]
    search_fields = ["number", "student__first_name", "student__last_name"]

    def get_queryset(self):
        return visible_invoices(self.request.user).prefetch_related("items").select_related("school")

    def _require_billing_writer(self):
        if not has_role(self.request.user, *BILLING_WRITERS):
            raise PermissionDenied("Only accountants and school admins can change invoices.")

    @action(detail=False, methods=["post"])
    def generate(self, request):
        self._require_billing_writer()
        ser = GenerateInvoiceSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        student = visible_students(request.user).filter(pk=d["student"]).first()
        year = scope_queryset(AcademicYear.objects.all(), request.user).filter(pk=d["academic_year"]).first()
        if not student or not year:
            raise ValidationError("Unknown student or academic year.")
        invoice = services.generate_invoice(student=student, academic_year=year, due_date=d["due_date"], actor=request.user, request=request)
        if d["issue"]:
            services.issue_invoice(invoice=invoice, actor=request.user, request=request)
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="bulk-generate")
    def bulk_generate(self, request):
        self._require_billing_writer()
        ser = BulkGenerateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        year = scope_queryset(AcademicYear.objects.all(), request.user).filter(pk=d["academic_year"]).first()
        grade = scope_queryset(GradeLevel.objects.all(), request.user).filter(pk=d["grade_level"]).first()
        if not year or not grade:
            raise ValidationError("Unknown academic year or grade level.")
        created, skipped = services.bulk_generate(
            school=request.user.school, academic_year=year, grade_level=grade, due_date=d["due_date"],
            actor=request.user, issue=d["issue"], request=request,
        )
        return Response({"created": len(created), "skipped_existing": len(skipped)}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def issue(self, request, pk=None):
        self._require_billing_writer()
        return Response(InvoiceSerializer(services.issue_invoice(invoice=self.get_object(), actor=request.user, request=request)).data)

    @action(detail=True, methods=["post"])
    def void(self, request, pk=None):
        self._require_billing_writer()
        invoice = services.void_invoice(invoice=self.get_object(), actor=request.user, reason=request.data.get("reason", ""), request=request)
        return Response(InvoiceSerializer(invoice).data)
