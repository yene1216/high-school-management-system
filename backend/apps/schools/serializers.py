from rest_framework.exceptions import ValidationError

from apps.core.serializers import SchoolScopedModelSerializer

from .models import AcademicYear, School, Term


class SchoolSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = School
        fields = "__all__"


class AcademicYearSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = AcademicYear
        fields = "__all__"
        read_only_fields = ("school",)

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end <= start:
            raise ValidationError({"end_date": "End date must be after the start date."})
        return attrs



class TermSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = Term
        fields = "__all__"
