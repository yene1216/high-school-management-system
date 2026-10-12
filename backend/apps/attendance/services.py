from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.academics.models import Enrollment, Section
from apps.academics.selectors import teacher_section_ids
from apps.accounts.models import Role
from apps.audit.services import log as audit_log
from apps.core.scoping import is_platform_admin

from .models import AttendanceCorrection, AttendanceRecord
from .tasks import notify_attendance_event

NOTIFY_STATUSES = (AttendanceRecord.Status.ABSENT, AttendanceRecord.Status.LATE)
MARKING_ROLES = (Role.SCHOOL_ADMIN, Role.REGISTRAR)
REVIEW_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


def can_mark(user, section):
    if is_platform_admin(user):
        return True
    if user.school_id != section.grade_level.school_id:
        return False
    if user.role in MARKING_ROLES:
        return True
    return user.role == Role.TEACHER and section.pk in teacher_section_ids(user)


@transaction.atomic
def mark_attendance(*, actor, section_id, date, entries, request=None):
    """Record a section's attendance for one day. Returns (records, skipped)."""
    try:
        section = Section.objects.select_related("grade_level").get(pk=section_id)
    except Section.DoesNotExist:
        raise ValidationError({"section": "Unknown section."})
    if not can_mark(actor, section):
        raise PermissionDenied("You are not allowed to take attendance for this section.")
    if date > timezone.localdate():
        raise ValidationError({"date": "Attendance cannot be recorded for a future date."})

    roster = set(Enrollment.objects.filter(section=section, status="active").values_list("student_id", flat=True))
    unknown = [e["student"] for e in entries if e["student"] not in roster]
    if unknown:
        raise ValidationError({"records": f"Students not enrolled in this section: {sorted(set(unknown))}"})

    saved, skipped = [], []
    existing = {r.student_id: r for r in AttendanceRecord.objects.select_for_update().filter(section=section, date=date)}
    for entry in entries:
        record = existing.get(entry["student"])
        if record is None:
            record = AttendanceRecord.objects.create(
                student_id=entry["student"], section=section, date=date, status=entry["status"], note=entry.get("note", ""), marked_by=actor
            )
            saved.append(record)
            if record.status in NOTIFY_STATUSES:
                transaction.on_commit(lambda pk=record.pk: notify_attendance_event.delay(pk))
        elif record.status == entry["status"]:
            continue
        elif record.marked_by_id == actor.id and record.date == timezone.localdate():
            old = record.status  # same-day fix by the person who took it
            record.status, record.note = entry["status"], entry.get("note", record.note)
            record.save(update_fields=["status", "note", "updated_at"])
            audit_log(actor, "attendance.same_day_edit", record, {"from": old, "to": record.status}, request=request)
            saved.append(record)
            if record.status in NOTIFY_STATUSES:
                transaction.on_commit(lambda pk=record.pk: notify_attendance_event.delay(pk))
        else:
            skipped.append({"student": entry["student"], "reason": "Already recorded; request a correction instead."})
    return saved, skipped


@transaction.atomic
def request_correction(*, actor, record, new_status, reason, request=None):
    if not can_mark(actor, record.section):
        raise PermissionDenied("You cannot change this attendance record.")
    if new_status == record.status:
        raise ValidationError({"new_status": "The record already has this status."})
    if record.corrections.filter(state=AttendanceCorrection.State.PENDING).exists():
        raise ValidationError("A correction for this record is already pending.")
    correction = AttendanceCorrection.objects.create(
        record=record, old_status=record.status, new_status=new_status, reason=reason, requested_by=actor
    )
    audit_log(actor, "attendance.correction_requested", record, {"to": new_status, "reason": reason}, request=request)
    if actor.role in REVIEW_ROLES or is_platform_admin(actor):
        review_correction(actor=actor, correction=correction, approve=True, request=request, auto=True)
    return correction


@transaction.atomic
def review_correction(*, actor, correction, approve, request=None, auto=False):
    if not (is_platform_admin(actor) or actor.role in REVIEW_ROLES):
        raise PermissionDenied("Only a school admin or principal can review corrections.")
    if correction.state != AttendanceCorrection.State.PENDING:
        raise ValidationError("This correction has already been reviewed.")
    if not auto and correction.requested_by_id == actor.id and not is_platform_admin(actor):
        raise PermissionDenied("You cannot approve your own correction.")
    correction.state = AttendanceCorrection.State.APPROVED if approve else AttendanceCorrection.State.REJECTED
    correction.reviewed_by, correction.reviewed_at = actor, timezone.now()
    correction.save(update_fields=["state", "reviewed_by", "reviewed_at"])
    if approve:
        record = correction.record
        record.status = correction.new_status
        record.save(update_fields=["status", "updated_at"])
        if record.status in NOTIFY_STATUSES:
            transaction.on_commit(lambda pk=record.pk: notify_attendance_event.delay(pk))
    audit_log(actor, "attendance.correction_" + correction.state, correction.record,
              {"from": correction.old_status, "to": correction.new_status}, request=request)
    return correction
