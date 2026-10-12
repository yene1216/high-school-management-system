from rest_framework import serializers

from apps.accounts.models import Role
from apps.core.serializers import SchoolScopedModelSerializer

from .models import Announcement


class AnnouncementSerializer(SchoolScopedModelSerializer):
    class Meta:
        model = Announcement
        fields = ("id", "title", "body", "priority", "audience", "target_role", "grade_level", "section", "published_at", "created_at")
        read_only_fields = ("published_at", "created_at")

    def validate(self, attrs):
        audience = attrs.get("audience")
        if audience == Announcement.Audience.ROLE and attrs.get("target_role") not in Role.values:
            raise serializers.ValidationError({"target_role": "Choose a valid role."})
        if audience == Announcement.Audience.GRADE and not attrs.get("grade_level"):
            raise serializers.ValidationError({"grade_level": "Required for a grade-level announcement."})
        if audience == Announcement.Audience.SECTION and not attrs.get("section"):
            raise serializers.ValidationError({"section": "Required for a section announcement."})
        return attrs
