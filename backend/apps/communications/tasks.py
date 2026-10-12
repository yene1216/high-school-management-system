from celery import shared_task

from apps.notifications.models import Category
from apps.notifications.services import notify_user


@shared_task
def fan_out_announcement(announcement_id):
    from .models import Announcement
    from .selectors import recipients_for

    a = Announcement.objects.get(pk=announcement_id)
    for user in recipients_for(a):
        notify_user(
            user=user, category=Category.ANNOUNCEMENT, title=a.title, body=a.body, priority=a.priority,
            data={"announcement": a.pk},
        )
