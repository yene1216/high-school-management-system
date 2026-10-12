from rest_framework import serializers

from .models import Category, Notification, NotificationDelivery


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "category", "priority", "title", "body", "data", "is_read", "created_at")
        read_only_fields = fields


class PreferenceSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=Category.choices)
    in_app = serializers.BooleanField()
    email = serializers.BooleanField()
    sms = serializers.BooleanField()


class DeliverySerializer(serializers.ModelSerializer):
    recipient = serializers.CharField(source="notification.user.email", read_only=True)
    title = serializers.CharField(source="notification.title", read_only=True)

    class Meta:
        model = NotificationDelivery
        fields = ("id", "recipient", "title", "channel", "status", "attempts", "last_error", "sent_at", "created_at")
