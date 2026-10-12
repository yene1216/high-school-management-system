from rest_framework import serializers

from apps.core.serializers import SchoolScopedModelSerializer

from .models import Discount, FeeCategory, FeeStructure, Invoice, InvoiceItem, StudentDiscount


class FeeCategorySerializer(SchoolScopedModelSerializer):
    class Meta:
        model = FeeCategory
        fields = "__all__"
        read_only_fields = ("school",)


class FeeStructureSerializer(SchoolScopedModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = FeeStructure
        fields = ("id", "academic_year", "grade_level", "category", "category_name", "amount", "frequency", "is_active")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class DiscountSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = Discount
        fields = "__all__"
        read_only_fields = ("school",)


class StudentDiscountSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = StudentDiscount
        fields = "__all__"


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ("id", "kind", "description", "quantity", "unit_price", "amount")


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    currency = serializers.CharField(source="school.currency", read_only=True)

    class Meta:
        model = Invoice
        fields = (
            "id", "number", "student", "student_name", "academic_year", "status", "issue_date", "due_date",
            "total", "amount_paid", "balance", "is_overdue", "currency", "items",
        )


class GenerateInvoiceSerializer(serializers.Serializer):
    student = serializers.IntegerField()
    academic_year = serializers.IntegerField()
    due_date = serializers.DateField()
    issue = serializers.BooleanField(default=False)


class BulkGenerateSerializer(serializers.Serializer):
    academic_year = serializers.IntegerField()
    grade_level = serializers.IntegerField()
    due_date = serializers.DateField()
    issue = serializers.BooleanField(default=True)
