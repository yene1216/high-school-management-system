from django.db.models import Q

from .models import Section


def teacher_section_ids(user):
    """Sections a teacher may act on: homeroom sections plus any section they teach a subject in."""
    return list(
        Section.objects.filter(Q(homeroom_teacher=user) | Q(teacher_assignments__teacher=user))
        .values_list("id", flat=True)
        .distinct()
    )
