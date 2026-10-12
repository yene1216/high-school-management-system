"""Multi-tenant scoping: every school-owned row is reachable only through the user's own school."""
from django.core.exceptions import FieldDoesNotExist

from apps.accounts.models import Role


def is_platform_admin(user):
    return bool(user and user.is_authenticated and (user.is_superuser or user.role == Role.SUPER_ADMIN))


def school_lookup_for(model):
    """ORM path from `model` to its school id. Models declare SCHOOL_LOOKUP when the school is indirect."""
    custom = getattr(model, "SCHOOL_LOOKUP", None)
    if custom:
        return custom
    try:
        model._meta.get_field("school")
    except FieldDoesNotExist:
        return None
    return "school_id"


def scope_queryset(qs, user):
    if is_platform_admin(user):
        return qs
    lookup = school_lookup_for(qs.model)
    if lookup is None:
        return qs
    if not user.school_id:
        return qs.none()
    return qs.filter(**{lookup: user.school_id})
