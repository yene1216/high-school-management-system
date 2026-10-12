from django.core.validators import FileExtensionValidator
from rest_framework import serializers

from apps.core.serializers import SchoolScopedModelSerializer
from apps.core.validators import DOCUMENT_EXTENSIONS, validate_document, validate_upload_size

from .models import EmergencyContact, Guardian, GuardianStudent, Student, StudentDocument, SupportRecord


class GuardianStudentSerializer(SchoolScopedModelSerializer):
    guardian_name = serializers.CharField(source="guardian.full_name", read_only=True)
    guardian_phone = serializers.CharField(source="guardian.phone", read_only=True)

    class Meta:
        model = GuardianStudent
        fields = ("id", "guardian", "guardian_name", "guardian_phone", "student", "relationship", "is_primary", "can_pickup")
        read_only_fields = ("student",)


class GuardianSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = Guardian
        fields = ("id", "school", "user", "first_name", "last_name", "phone", "email", "occupation", "address")
        read_only_fields = ("school",)


class EmergencyContactSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = EmergencyContact
        fields = "__all__"


class StudentDocumentSerializer(SchoolScopedModelSerializer):
    file = serializers.FileField(write_only=True, validators=[FileExtensionValidator(DOCUMENT_EXTENSIONS), validate_upload_size, validate_document])
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = StudentDocument
        fields = ("id", "student", "doc_type", "file", "download_url", "status", "verified_by", "created_at")
        read_only_fields = ("status", "verified_by")

    def get_download_url(self, obj):
        return f"/api/v1/student-documents/{obj.pk}/download/"


class SupportRecordSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = SupportRecord
        fields = "__all__"
        read_only_fields = ("student",)


class StudentSerializer(SchoolScopedModelSerializer):
    full_name = serializers.CharField(read_only=True)
    photo = serializers.ImageField(write_only=True, required=False, allow_null=True, validators=[validate_upload_size])
    photo_url = serializers.SerializerMethodField()
    current_section = serializers.SerializerMethodField()
    guardians = GuardianStudentSerializer(source="guardian_links", many=True, read_only=True)

    class Meta:
        model = Student
        fields = (
            "id", "school", "student_code", "user", "first_name", "middle_name", "last_name", "full_name",
            "date_of_birth", "gender", "photo", "photo_url", "address", "nationality", "admission_date", "status",
            "qr_token", "current_section", "guardians",
        )
        read_only_fields = ("school", "student_code", "qr_token")

    def get_photo_url(self, obj):
        return f"/api/v1/students/{obj.pk}/photo/" if obj.photo else None

    def get_current_section(self, obj):
        enrollment = next((e for e in obj.enrollments.all() if e.status == "active"), None)
        if not enrollment:
            return None
        return {"id": enrollment.section_id, "name": str(enrollment.section)}
