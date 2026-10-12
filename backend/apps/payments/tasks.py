from celery import shared_task

from apps.notifications.models import Category
from apps.notifications.services import notify_user
from apps.students.selectors import guardian_users


@shared_task
def notify_payment_received(payment_id):
    from .models import Payment

    payment = Payment.objects.select_related("invoice__student__user", "invoice__school", "receipt").get(pk=payment_id)
    invoice = payment.invoice
    context = {
        "amount": payment.amount, "currency": invoice.school.currency, "invoice_number": invoice.number,
        "receipt_number": payment.receipt.number, "student_name": invoice.student.full_name,
    }
    for user in guardian_users(invoice.student):
        notify_user(user=user, category=Category.BILLING, code="payment.received", context=context, data={"invoice": invoice.pk})
