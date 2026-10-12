from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.mixins import SchoolScopedQuerysetMixin
from apps.core.permissions import MANAGEMENT_ROLES, role_required

from .models import Notification, NotificationDelivery, NotificationPreference
from .serializers import DeliverySerializer, NotificationSerializer, PreferenceSerializer
from .services import DEFAULT_PREFS, all_categories, mark_read


class NotificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    filterset_fields = ["is_read", "category", "priority"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user, show_in_app=True)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        mark_read(Notification.objects.filter(pk=self.get_object().pk))
        return Response({"ok": True})

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        return Response({"updated": mark_read(self.get_queryset())})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(is_read=False).count()})


class PreferencesView(APIView):
    def get(self, request):
        stored = {p.category: p for p in NotificationPreference.objects.filter(user=request.user)}
        rows = []
        for category in all_categories():
            p = stored.get(category)
            rows.append({"category": category, **({"in_app": p.in_app, "email": p.email, "sms": p.sms} if p else DEFAULT_PREFS)})
        return Response(rows)

    def put(self, request):
        ser = PreferenceSerializer(data=request.data, many=True)
        ser.is_valid(raise_exception=True)
        for row in ser.validated_data:
            NotificationPreference.objects.update_or_create(
                user=request.user, category=row["category"],
                defaults={"in_app": row["in_app"], "email": row["email"], "sms": row["sms"]},
            )
        return self.get(request)


class DeliveryLogViewSet(SchoolScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """Delivery log with retry counts, for school admins."""

    queryset = NotificationDelivery.objects.select_related("notification__user")
    serializer_class = DeliverySerializer
    permission_classes = [role_required(*MANAGEMENT_ROLES)]
    filterset_fields = ["status", "channel"]
