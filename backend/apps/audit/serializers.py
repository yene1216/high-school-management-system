from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ("id", "actor", "actor_name", "action", "object_type", "object_id", "changes", "ip_address", "created_at")

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor else None
