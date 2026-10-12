from django.conf import settings
from django.db import models


class AuditQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionError("Audit records are immutable.")

    def delete(self):
        raise PermissionError("Audit records are immutable.")


class AuditLog(models.Model):
    """Append-only activity record. Updates and deletes raise."""

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    school = models.ForeignKey("schools.School", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    action = models.CharField(max_length=80, db_index=True)
    object_type = models.CharField(max_length=80, blank=True, db_index=True)
    object_id = models.CharField(max_length=64, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = AuditQuerySet.as_manager()
    SCHOOL_LOOKUP = "school_id"

    class Meta:
        ordering = ["-created_at", "-id"]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise PermissionError("Audit records are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Audit records are immutable.")
