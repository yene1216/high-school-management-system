from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated

from apps.accounts.models import Role

from .scoping import is_platform_admin

SCHOOL_ADMIN = Role.SCHOOL_ADMIN
STAFF_ROLES = (
    Role.SCHOOL_ADMIN, Role.REGISTRAR, Role.TEACHER, Role.ACCOUNTANT, Role.HR,
    Role.PRINCIPAL, Role.LIBRARIAN, Role.TRANSPORT, Role.COUNSELOR,
)
FINANCE_ROLES = (Role.SCHOOL_ADMIN, Role.ACCOUNTANT, Role.PRINCIPAL)
MANAGEMENT_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)
# Staff who may see every student in their school (teachers are restricted to their own classes).
SCHOOL_WIDE_STUDENT_ROLES = (
    Role.SCHOOL_ADMIN, Role.REGISTRAR, Role.PRINCIPAL, Role.ACCOUNTANT,
    Role.COUNSELOR, Role.LIBRARIAN, Role.TRANSPORT,
)


def has_role(user, *roles):
    return bool(user and user.is_authenticated and (is_platform_admin(user) or user.role in roles))


def role_required(*roles):
    class RoleRequired(BasePermission):
        message = "Your role is not allowed to do this."

        def has_permission(self, request, view):
            return has_role(request.user, *roles)

    RoleRequired.__name__ = "RoleRequired_" + "_".join(sorted(str(r) for r in roles))
    return RoleRequired


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


def write_roles(*roles):
    """Anyone authenticated may read; only `roles` may write."""
    return IsAuthenticated & (ReadOnly | role_required(*roles))
