from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.academics.models import Enrollment, TeacherAssignment
from apps.accounts.models import Role
from apps.audit.services import log as audit_log
from apps.core.scoping import is_platform_admin
from apps.core.utils import money

from .models import Grade
from .tasks import notify_grades_published


def can_grade(user, assessment):
    if is_platform_admin(user):
        return True
    if user.school_id != assessment.section.grade_level.school_id:
        return False
    if user.role in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        return True
    return user.role == Role.TEACHER and (
        assessment.section.homeroom_teacher_id == user.id
        or TeacherAssignment.objects.filter(teacher=user, section=assessment.section, subject=assessment.subject).exists()
    )


@transaction.atomic
def enter_grades(*, actor, assessment, entries, request=None):
    if not can_grade(actor, assessment):
        raise PermissionDenied("You do not teach this subject in this section.")
    roster = set(Enrollment.objects.filter(section=assessment.section, status="active").values_list("student_id", flat=True))
    out = []
    for e in entries:
        if e["student"] not in roster:
            raise ValidationError({"records": f"Student {e['student']} is not enrolled in this section."})
        score = e["score"]
        if score is not None and not (0 <= score <= assessment.max_score):
            raise ValidationError({"records": f"Score for student {e['student']} must be between 0 and {assessment.max_score}."})
        grade, created = Grade.objects.select_for_update().get_or_create(
            assessment=assessment, student_id=e["student"], defaults={"score": score, "remarks": e.get("remarks", ""), "entered_by": actor}
        )
        if not created and (grade.score != score or grade.remarks != e.get("remarks", "")):
            audit_log(actor, "grade.changed", grade, {"assessment": assessment.pk, "from": str(grade.score), "to": str(score)}, request=request)
            grade.score, grade.remarks, grade.entered_by = score, e.get("remarks", ""), actor
            grade.save()
        out.append(grade)
    return out


@transaction.atomic
def publish(*, actor, assessment, request=None):
    if not can_grade(actor, assessment):
        raise PermissionDenied()
    if assessment.is_published:
        raise ValidationError("Already published.")
    assessment.is_published, assessment.published_at = True, timezone.now()
    assessment.save(update_fields=["is_published", "published_at", "updated_at"])
    audit_log(actor, "assessment.published", assessment, request=request)
    transaction.on_commit(lambda: notify_grades_published.delay(assessment.pk))
    return assessment


def letter_for(percent, scale):
    for minimum, letter in sorted(scale, key=lambda r: -r[0]):
        if percent >= minimum:
            return letter
    return scale[-1][1]


def report_card(student, term=None):
    """Weighted average per subject from *published* grades. Score/max is weighted by each assessment's weight."""
    qs = Grade.objects.filter(student=student, assessment__is_published=True, score__isnull=False).select_related("assessment__subject")
    if term is not None:
        qs = qs.filter(assessment__term=term)
    subjects = {}
    for g in qs:
        a = g.assessment
        row = subjects.setdefault(a.subject_id, {"subject": a.subject.name, "earned": Decimal(0), "weight": Decimal(0)})
        row["earned"] += (g.score / a.max_score) * a.weight
        row["weight"] += a.weight
    scale = student.school.grading_scale
    rows = []
    for row in subjects.values():
        pct = money(row["earned"] / row["weight"] * 100) if row["weight"] else Decimal(0)
        rows.append({"subject": row["subject"], "percent": str(pct), "letter": letter_for(pct, scale)})
    overall = money(sum(Decimal(r["percent"]) for r in rows) / len(rows)) if rows else None
    return {
        "student": {"id": student.pk, "name": student.full_name, "code": student.student_code},
        "term": term.pk if term else None,
        "subjects": sorted(rows, key=lambda r: r["subject"]),
        "overall_percent": str(overall) if overall is not None else None,
        "overall_letter": letter_for(overall, scale) if overall is not None else None,
    }

