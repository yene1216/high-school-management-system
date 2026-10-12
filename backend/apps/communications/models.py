from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.notifications.models import Priority


class Announcement(TimeStampedModel):
    class Audience(models.TextChoices):
        ALL = "all", "Everyone in the school"
        ROLE = "role", "A role (e.g. all parents)"
        GRADE = "grade", "A grade level"
        SECTION = "section", "A section"

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="announcements")
    title = models.CharField(max_length=200)
    body = models.TextField()
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.INFO)
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.ALL)
    target_role = models.CharField(max_length=20, blank=True)
    grade_level = models.ForeignKey("academics.GradeLevel", null=True, blank=True, on_delete=models.CASCADE, related_name="+")
    section = models.ForeignKey("academics.Section", null=True, blank=True, on_delete=models.CASCADE, related_name="+")
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-published_at", "-id"]
