from rest_framework import serializers

from .models import AttendanceCorrection, AttendanceRecord


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ("id", "student", "student_name", "section", "date", "status", "note", "marked_at")
        read_only_fields = fields


class BulkEntrySerializer(serializers.Serializer):
    student = serializers.IntegerField()
    status = serializers.ChoiceField(choices=AttendanceRecord.Status.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255, default="")


class BulkAttendanceSerializer(serializers.Serializer):
    section = serializers.IntegerField()
    date = serializers.DateField()
    records = BulkEntrySerializer(many=True, allow_empty=False)


class CorrectionRequestSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(choices=AttendanceRecord.Status.choices)
    reason = serializers.CharField(max_length=255)


class CorrectionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="record.student.full_name", read_only=True)
    date = serializers.DateField(source="record.date", read_only=True)

    class Meta:
        model = AttendanceCorrection
        fields = ("id", "record", "student_name", "date", "old_status", "new_status", "reason", "state", "requested_by", "reviewed_by", "created_at", "reviewed_at")
        read_only_fields = fields
