from django.conf import settings
from django.db import models


class AttendanceRecord(models.Model):
    SCHOOL_LOOKUP = "student__school_id"

    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        LATE = "late", "Late"
        EXCUSED = "excused", "Excused"

    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="attendance_records")
    section = models.ForeignKey("academics.Section", on_delete=models.PROTECT, related_name="attendance_records")
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    note = models.CharField(max_length=255, blank=True)
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    marked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "student__last_name"]
        constraints = [models.UniqueConstraint(fields=["student", "date"], name="one_attendance_record_per_student_day")]


class AttendanceCorrection(models.Model):
    """Change request against an existing record. Approved changes are applied and kept as history."""

    SCHOOL_LOOKUP = "record__student__school_id"

    class State(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    record = models.ForeignKey(AttendanceRecord, on_delete=models.CASCADE, related_name="corrections")
    old_status = models.CharField(max_length=10, choices=AttendanceRecord.Status.choices)
    new_status = models.CharField(max_length=10, choices=AttendanceRecord.Status.choices)
    reason = models.CharField(max_length=255)
    state = models.CharField(max_length=10, choices=State.choices, default=State.PENDING)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
