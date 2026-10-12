"""Object-level access rules for students. Every module that exposes student data goes through here."""
from apps.accounts.models import Role
from apps.academics.selectors import teacher_section_ids
from apps.core.permissions import SCHOOL_WIDE_STUDENT_ROLES
from apps.core.scoping import is_platform_admin

from .models import Student


def visible_students(user):
    qs = Student.objects.select_related("school")
    if is_platform_admin(user):
        return qs
    if not user.school_id:
        return qs.none()
    qs = qs.filter(school_id=user.school_id)
    if user.role in SCHOOL_WIDE_STUDENT_ROLES:
        return qs
    if user.role == Role.TEACHER:
        return qs.filter(enrollments__section_id__in=teacher_section_ids(user), enrollments__status="active").distinct()
    if user.role == Role.PARENT:
        return qs.filter(guardian_links__guardian__user=user).distinct()
    if user.role == Role.STUDENT:
        return qs.filter(user=user)
    return qs.none()


def can_view_support_records(user):
    return is_platform_admin(user) or user.role in (Role.COUNSELOR, Role.SCHOOL_ADMIN)


def guardian_users(student):
    """User accounts of a student's guardians (used for notifications)."""
    from apps.accounts.models import User

    return User.objects.filter(is_active=True, guardian_profile__student_links__student=student).distinct()
