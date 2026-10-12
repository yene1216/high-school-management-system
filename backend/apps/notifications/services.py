from string import Template

from django.db import transaction
from django.utils import timezone

from .models import Category, Channel, Notification, NotificationDelivery, NotificationPreference, NotificationTemplate, Priority
from .templates_default import DEFAULT_TEMPLATES

DEFAULT_PREFS = {"in_app": True, "email": True, "sms": False}


def render(code, language, context, school_id=None):
    """Return (subject, body). Lookup order: school override, global override, built-in, English fallback."""
    for lang in (language, "en"):
        tpl = (
            NotificationTemplate.objects.filter(code=code, language=lang, school_id=school_id).first()
            or NotificationTemplate.objects.filter(code=code, language=lang, school__isnull=True).first()
        )
        if tpl:
            subject, body = tpl.subject, tpl.body
        elif code in DEFAULT_TEMPLATES and lang in DEFAULT_TEMPLATES[code]:
            subject, body = DEFAULT_TEMPLATES[code][lang]
        else:
            continue
        ctx = {k: str(v) for k, v in context.items()}
        return Template(subject).safe_substitute(ctx), Template(body).safe_substitute(ctx)
    raise KeyError(f"No notification template for {code}")


def preference_for(user, category):
    pref = NotificationPreference.objects.filter(user=user, category=category).first()
    if pref:
        return {"in_app": pref.in_app, "email": pref.email, "sms": pref.sms}
    return dict(DEFAULT_PREFS)


def notify_user(*, user, category, code=None, context=None, title=None, body=None, priority=Priority.INFO, data=None):
    """Create the in-app notification and queue email/SMS deliveries according to the user's preferences."""
    from .tasks import deliver

    if code:
        title, body = render(code, user.language, context or {}, user.school_id)
    prefs = preference_for(user, category)
    show = prefs["in_app"] or priority == Priority.URGENT
    notification = Notification.objects.create(
        user=user, category=category, priority=priority, title=title, body=body, data=data or {}, show_in_app=show
    )
    channels = []
    if prefs["email"] and user.email:
        channels.append(Channel.EMAIL)
    if prefs["sms"] and user.phone:
        channels.append(Channel.SMS)
    for channel in channels:
        delivery = NotificationDelivery.objects.create(notification=notification, channel=channel)
        transaction.on_commit(lambda pk=delivery.pk: deliver.delay(pk))
    return notification


def mark_read(qs):
    return qs.filter(is_read=False).update(is_read=True, read_at=timezone.now())


def all_categories():
    return [c for c, _ in Category.choices]
