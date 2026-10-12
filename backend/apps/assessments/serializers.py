from rest_framework import serializers

from apps.core.serializers import SchoolScopedModelSerializer

from .models import Assessment, Grade


class AssessmentSerializer(SchoolScopedModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    section_label = serializers.CharField(source="section.__str__", read_only=True)

    class Meta:
        model = Assessment
        fields = (
            "id", "section", "section_label", "subject", "subject_name", "term", "name", "kind",
            "max_score", "weight", "date", "is_published", "published_at",
        )
        read_only_fields = ("is_published", "published_at")


class GradeSerializer(serializers.ModelSerializer):
    assessment_name = serializers.CharField(source="assessment.name", read_only=True)
    subject = serializers.CharField(source="assessment.subject.name", read_only=True)
    max_score = serializers.DecimalField(source="assessment.max_score", max_digits=6, decimal_places=2, read_only=True)
    date = serializers.DateField(source="assessment.date", read_only=True)

    class Meta:
        model = Grade
        fields = ("id", "assessment", "assessment_name", "subject", "student", "score", "max_score", "remarks", "date")


class GradeEntrySerializer(serializers.Serializer):
    student = serializers.IntegerField()
    score = serializers.DecimalField(max_digits=6, decimal_places=2, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")
