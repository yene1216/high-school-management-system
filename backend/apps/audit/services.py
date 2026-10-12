from .models import AuditLog


def _client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    return (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None


def log(actor, action, obj=None, changes=None, request=None, school=None):
    """Record an important action. `changes` must be JSON-serialisable."""
    school_id = getattr(school, "id", None) or getattr(obj, "school_id", None) or getattr(actor, "school_id", None)
    return AuditLog.objects.create(
        actor=actor if getattr(actor, "pk", None) else None,
        school_id=school_id,
        action=action,
        object_type=obj.__class__.__name__ if obj is not None else "",
        object_id=str(obj.pk) if obj is not None and obj.pk else "",
        changes=changes or {},
        ip_address=_client_ip(request),
    )
