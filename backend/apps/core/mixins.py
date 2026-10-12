from rest_framework.exceptions import ValidationError

from .scoping import scope_queryset


class SchoolScopedQuerysetMixin:
    """Restrict a viewset's queryset to the requesting user's school."""

    def get_queryset(self):
        return scope_queryset(super().get_queryset(), self.request.user)


class SchoolOnCreateMixin:
    """Stamp `school` from the acting user on create."""

    def perform_create(self, serializer):
        user = self.request.user
        if not user.school_id:
            raise ValidationError("Act inside a school (attach this account to a school) to create school data.")
        serializer.save(school=user.school)
