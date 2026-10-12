import logging

from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from django.utils import timezone

from .models import Channel, NotificationDelivery
from .providers import get_sms_provider, send_email

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=4, default_retry_delay=60)
def deliver(self, delivery_id):
    """Send one email/SMS. Failures are logged on the delivery row and retried."""
    delivery = NotificationDelivery.objects.select_related("notification__user").get(pk=delivery_id)
    if delivery.status == NotificationDelivery.Status.SENT:
        return
    user, note = delivery.notification.user, delivery.notification
    delivery.attempts += 1
    try:
        if delivery.channel == Channel.EMAIL:
            ref = send_email(user.email, note.title, note.body)
        elif delivery.channel == Channel.SMS:
            ref = get_sms_provider().send(user.phone, f"{note.title}: {note.body}")
        else:
            ref = "in_app"
    except Exception as exc:  # noqa: BLE001 - any provider error must be recorded and retried
        logger.warning("Delivery %s failed: %s", delivery_id, exc)
        delivery.status = NotificationDelivery.Status.FAILED
        delivery.last_error = str(exc)[:500]
        delivery.save(update_fields=["attempts", "status", "last_error"])
        try:
            raise self.retry(exc=exc)
        except MaxRetriesExceededError:
            return
    delivery.status = NotificationDelivery.Status.SENT
    delivery.provider_ref = str(ref or "")[:100]
    delivery.last_error = ""
    delivery.sent_at = timezone.now()
    delivery.save(update_fields=["attempts", "status", "provider_ref", "last_error", "sent_at"])
