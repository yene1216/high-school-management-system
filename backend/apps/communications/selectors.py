from django.db.models import Q

from apps.academics.models import Enrollment
from apps.accounts.models import Role, User
from apps.core.scoping import is_platform_admin
from apps.students.selectors import visible_students

from .models import Announcement

FAMILY_ROLES = (Role.PARENT, Role.STUDENT)


def recipients_for(a):
    """Users who should be notified about announcement `a`."""
    users = User.objects.filter(school_id=a.school_id, is_active=True)
    if a.audience == Announcement.Audience.ALL:
        return users
    if a.audience == Announcement.Audience.ROLE:
        return users.filter(role=a.target_role)
    enrollments = Enrollment.objects.filter(status="active")
    enrollments = enrollments.filter(section=a.section) if a.audience == Announcement.Audience.SECTION else enrollments.filter(section__grade_level=a.grade_level)
    student_ids = enrollments.values("student_id")
    return users.filter(Q(guardian_profile__student_links__student_id__in=student_ids) | Q(student_profile__id__in=student_ids)).distinct()


def visible_announcements(user):
    qs = Announcement.objects.filter(published_at__isnull=False)
    if is_platform_admin(user):
        return qs
    qs = qs.filter(school_id=user.school_id)
    if user.role not in FAMILY_ROLES:
        return qs
    enrollments = Enrollment.objects.filter(status="active", student__in=visible_students(user))
    return qs.filter(
        Q(audience="all")
        | Q(audience="role", target_role=user.role)
        | Q(audience="grade", grade_level_id__in=enrollments.values("section__grade_level_id"))
        | Q(audience="section", section_id__in=enrollments.values("section_id"))
    )
