from apps.accounts.models import Role
from apps.core.permissions import FINANCE_ROLES
from apps.core.scoping import is_platform_admin
from apps.students.selectors import visible_students

from .models import Invoice


def visible_invoices(user):
    qs = Invoice.objects.select_related("student", "academic_year")
    if is_platform_admin(user):
        return qs
    if not user.school_id:
        return qs.none()
    qs = qs.filter(school_id=user.school_id)
    if user.role in FINANCE_ROLES:
        return qs
    if user.role in (Role.PARENT, Role.STUDENT):
        return qs.filter(student__in=visible_students(user)).exclude(status=Invoice.Status.DRAFT)
    return qs.none()
