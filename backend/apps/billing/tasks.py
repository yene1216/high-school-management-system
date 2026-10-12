from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.notifications.models import Category, Priority
from apps.notifications.services import notify_user
from apps.students.selectors import guardian_users


def _notify_guardians(invoice, code, priority=Priority.INFO):
    context = {
        "student_name": invoice.student.full_name, "invoice_number": invoice.number, "amount": invoice.total,
        "balance": invoice.balance, "due_date": invoice.due_date.isoformat(), "currency": invoice.school.currency,
    }
    recipients = list(guardian_users(invoice.student))
    if invoice.student.user_id and invoice.student.user.is_active:
        recipients.append(invoice.student.user)
    for user in recipients:
        notify_user(user=user, category=Category.BILLING, code=code, context=context, priority=priority, data={"invoice": invoice.pk})


@shared_task
def notify_invoice_issued(invoice_id):
    from .models import Invoice

    invoice = Invoice.objects.select_related("student__user", "school").get(pk=invoice_id)
    _notify_guardians(invoice, "billing.invoice_issued")


@shared_task
def send_due_reminders():
    """Daily: remind before the due date (per-school lead time) and again the day after it passes."""
    from apps.schools.models import School

    from .models import Invoice

    today = timezone.localdate()
    open_states = (Invoice.Status.ISSUED, Invoice.Status.PARTIAL)
    sent = 0
    for school in School.objects.filter(is_active=True):
        base = Invoice.objects.filter(school=school, status__in=open_states).select_related("student__user", "school")
        for inv in base.filter(due_date=today + timedelta(days=school.reminder_days_before_due)):
            _notify_guardians(inv, "billing.due_reminder", Priority.WARNING)
            sent += 1
        for inv in base.filter(due_date=today - timedelta(days=1)):
            _notify_guardians(inv, "billing.overdue", Priority.URGENT)
            sent += 1
    return sent


@shared_task
def apply_late_fees():
    from .services import apply_late_fees as run

    return run()
