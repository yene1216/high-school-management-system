from datetime import timedelta

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone

from apps.academics.models import Enrollment
from apps.academics.selectors import teacher_section_ids
from apps.accounts.models import Role
from apps.assessments.models import Grade
from apps.attendance.models import AttendanceRecord
from apps.billing.models import Invoice
from apps.core.permissions import FINANCE_ROLES, MANAGEMENT_ROLES
from apps.core.scoping import is_platform_admin
from apps.students.models import Student
from apps.students.selectors import visible_students

OPEN = (Invoice.Status.ISSUED, Invoice.Status.PARTIAL)
BALANCE = ExpressionWrapper(F("total") - F("amount_paid"), output_field=DecimalField(max_digits=14, decimal_places=2))


def _school_invoices(user):
    qs = Invoice.objects.exclude(status__in=(Invoice.Status.DRAFT, Invoice.Status.VOID))
    return qs if is_platform_admin(user) else qs.filter(school_id=user.school_id)


def finance_summary(user):
    invoices = _school_invoices(user)
    billed = invoices.aggregate(v=Sum("total"))["v"] or 0
    collected = invoices.aggregate(v=Sum("amount_paid"))["v"] or 0
    open_qs = invoices.filter(status__in=OPEN)
    outstanding = open_qs.aggregate(v=Sum(BALANCE))["v"] or 0
    today = timezone.localdate()
    return {
        "billed": billed, "collected": collected, "outstanding": outstanding,
        "overdue_count": open_qs.filter(due_date__lt=today).count(),
    }


def aging(user):
    """Outstanding balance bucketed by days past due."""
    today = timezone.localdate()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    for inv in _school_invoices(user).filter(status__in=OPEN).only("total", "amount_paid", "due_date"):
        days = (today - inv.due_date).days
        key = "current" if days <= 0 else "1_30" if days <= 30 else "31_60" if days <= 60 else "61_90" if days <= 90 else "over_90"
        buckets[key] += inv.balance
    return buckets


def attendance_counts(user, start, end, section_id=None):
    qs = AttendanceRecord.objects.filter(student__in=visible_students(user), date__gte=start, date__lte=end)
    if section_id:
        qs = qs.filter(section_id=section_id)
    totals = {row["status"]: row["n"] for row in qs.values("status").annotate(n=Count("id"))}
    daily = list(qs.values("date", "status").annotate(n=Count("id")).order_by("date"))
    return {"totals": totals, "daily": daily}


def recent_attendance(student, days=14):
    since = timezone.localdate() - timedelta(days=days)
    return [{"date": r.date, "status": r.status} for r in AttendanceRecord.objects.filter(student=student, date__gt=since).order_by("date")]


def child_card(student):
    today = timezone.localdate()
    enrollment = student.enrollments.filter(status="active").select_related("section__grade_level").first()
    today_rec = AttendanceRecord.objects.filter(student=student, date=today).first()
    invoices = Invoice.objects.filter(student=student, status__in=OPEN)
    grades = Grade.objects.filter(student=student, assessment__is_published=True, score__isnull=False).select_related("assessment__subject").order_by("-assessment__published_at")[:3]
    return {
        "id": student.pk, "name": student.full_name, "code": student.student_code,
        "section": str(enrollment.section) if enrollment else None,
        "today": today_rec.status if today_rec else None,
        "recent_attendance": recent_attendance(student),
        "outstanding_balance": invoices.aggregate(v=Sum(BALANCE))["v"] or 0,
        "currency": student.school.currency,
        "latest_grades": [
            {"subject": g.assessment.subject.name, "assessment": g.assessment.name, "score": g.score, "max_score": g.assessment.max_score}
            for g in grades
        ],
    }


def dashboard_for(user):
    today = timezone.localdate()
    role = user.role
    if role in (Role.PARENT, Role.STUDENT):
        return {"kind": "family", "children": [child_card(s) for s in visible_students(user)]}
    if role == Role.TEACHER:
        section_ids = teacher_section_ids(user)
        rows = []
        for e in Enrollment.objects.filter(section_id__in=section_ids, status="active").values("section_id", "section__name", "section__grade_level__name").annotate(students=Count("id")):
            marked = AttendanceRecord.objects.filter(section_id=e["section_id"], date=today).count()
            rows.append({
                "section": e["section_id"], "label": f'{e["section__grade_level__name"]}{e["section__name"]}',
                "students": e["students"], "attendance_marked_today": marked >= e["students"],
            })
        return {"kind": "teacher", "sections": rows}
    if role == Role.ACCOUNTANT:
        return {"kind": "finance", "finance": finance_summary(user), "aging": aging(user)}
    if role in MANAGEMENT_ROLES or role == Role.REGISTRAR or is_platform_admin(user):
        students = Student.objects.filter(status="active")
        if not is_platform_admin(user):
            students = students.filter(school_id=user.school_id)
        result = {
            "kind": "management",
            "students_active": students.count(),
            "attendance_today": attendance_counts(user, today, today)["totals"],
        }
        if role in FINANCE_ROLES or is_platform_admin(user):
            result["finance"] = finance_summary(user)
        return result
    return {"kind": "basic"}
