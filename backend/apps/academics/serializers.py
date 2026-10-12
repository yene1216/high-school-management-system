from rest_framework import serializers

from apps.accounts.models import Role
from apps.core.serializers import SchoolScopedModelSerializer

from .models import Enrollment, GradeLevel, Section, Subject, TeacherAssignment


class GradeLevelSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = GradeLevel
        fields = "__all__"
        read_only_fields = ("school",)


class SubjectSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = Subject
        fields = "__all__"
        read_only_fields = ("school",)


class SectionSerializer(SchoolScopedModelSerializer):
    label = serializers.CharField(source="__str__", read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = ("id", "grade_level", "academic_year", "name", "label", "homeroom_teacher", "room", "capacity", "student_count")

    def get_student_count(self, obj):
        return obj.enrollments.filter(status="active").count()

    def validate_homeroom_teacher(self, teacher):
        if teacher and teacher.role != Role.TEACHER:
            raise serializers.ValidationError("Homeroom teacher must have the teacher role.")
        return teacher


class TeacherAssignmentSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = TeacherAssignment
        fields = "__all__"

    def validate_teacher(self, teacher):
        if teacher.role != Role.TEACHER:
            raise serializers.ValidationError("User must have the teacher role.")
        return teacher


class EnrollmentSerializer(SchoolScopedModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    section_label = serializers.CharField(source="section.__str__", read_only=True)

    class Meta:
        model = Enrollment
        fields = ("id", "student", "student_name", "section", "section_label", "academic_year", "status", "enrolled_on")
        read_only_fields = ("academic_year",)

    def validate(self, attrs):
        section = attrs.get("section")
        student = attrs.get("student")
        if section and student and not self.instance:
            if Enrollment.objects.filter(student=student, academic_year=section.academic_year, status="active").exists():
                raise serializers.ValidationError("Student already has an active enrollment this academic year.")
            if section.enrollments.filter(status="active").count() >= section.capacity:
                raise serializers.ValidationError({"section": "This section is full."})
        return attrs
