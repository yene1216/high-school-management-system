from datetime import timedelta

from celery import shared_task

from apps.notifications.models import Category, Priority
from apps.notifications.services import notify_user
from apps.students.selectors import guardian_users


@shared_task
def notify_attendance_event(record_id):
    """Absent / late alert to the student's guardians, plus a warning when absences pile up."""
    from .models import AttendanceRecord

    record = AttendanceRecord.objects.select_related("student__school").get(pk=record_id)
    student, school = record.student, record.student.school
    if record.status not in (AttendanceRecord.Status.ABSENT, AttendanceRecord.Status.LATE):
        return
    code = "attendance.absent" if record.status == AttendanceRecord.Status.ABSENT else "attendance.late"
    context = {"student_name": student.full_name, "date": record.date.isoformat(), "school_name": school.name}
    guardians = list(guardian_users(student))
    for user in guardians:
        notify_user(
            user=user, category=Category.ATTENDANCE, code=code, context=context,
            priority=Priority.WARNING if record.status == AttendanceRecord.Status.ABSENT else Priority.INFO,
            data={"student": student.pk, "date": record.date.isoformat()},
        )
    if record.status == AttendanceRecord.Status.ABSENT and school.absence_alert_threshold:
        since = record.date - timedelta(days=30)
        absences = AttendanceRecord.objects.filter(student=student, status="absent", date__gt=since, date__lte=record.date).count()
        if absences == school.absence_alert_threshold:  # fire once, when the threshold is crossed
            for user in guardians:
                notify_user(
                    user=user, category=Category.ATTENDANCE, code="attendance.repeated_absence",
                    context={**context, "count": absences}, priority=Priority.URGENT, data={"student": student.pk},
                )
