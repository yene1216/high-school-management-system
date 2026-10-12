from rest_framework import serializers

from .scoping import scope_queryset


class SchoolScopedPKField(serializers.PrimaryKeyRelatedField):
    """A foreign-key field that can only point at rows in the requesting user's school."""

    def get_queryset(self):
        qs = super().get_queryset()
        request = self.context.get("request")
        if qs is None or request is None:
            return qs
        return scope_queryset(qs, request.user)


class SchoolScopedModelSerializer(serializers.ModelSerializer):
    serializer_related_field = SchoolScopedPKField
