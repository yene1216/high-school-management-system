from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.academics.selectors import teacher_section_ids
from apps.accounts.models import Role
from apps.audit.services import log as audit_log
from apps.core.permissions import MANAGEMENT_ROLES, has_role

from .models import Announcement
from .selectors import visible_announcements
from .serializers import AnnouncementSerializer
from .tasks import fan_out_announcement


class AnnouncementViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Management can announce to anyone; a teacher only to their own sections."""

    serializer_class = AnnouncementSerializer
    filterset_fields = ["priority", "audience"]
    search_fields = ["title", "body"]

    def get_queryset(self):
        return visible_announcements(self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        if not user.school_id:
            raise PermissionDenied("Attach this account to a school first.")
        if not has_role(user, *MANAGEMENT_ROLES):
            teacher_ok = (
                user.role == Role.TEACHER
                and data.get("audience") == Announcement.Audience.SECTION
                and data["section"].pk in teacher_section_ids(user)
            )
            if not teacher_ok:
                raise PermissionDenied("You can only announce to your own sections.")
        with transaction.atomic():
            a = serializer.save(school=user.school, created_by=user, published_at=timezone.now())
            audit_log(user, "announcement.published", a, {"audience": a.audience}, request=self.request)
            transaction.on_commit(lambda: fan_out_announcement.delay(a.pk))

    def perform_destroy(self, instance):
        if not has_role(self.request.user, *MANAGEMENT_ROLES):
            raise PermissionDenied()
        instance.delete()
