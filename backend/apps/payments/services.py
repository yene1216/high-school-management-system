from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Role
from apps.audit.services import log as audit_log
from apps.billing.models import Invoice
from apps.core.scoping import is_platform_admin
from apps.core.utils import money

from .models import Payment, Receipt, Refund
from .tasks import notify_payment_received

PAYABLE = (Invoice.Status.ISSUED, Invoice.Status.PARTIAL)
REFUND_APPROVERS = (Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.ACCOUNTANT)


@transaction.atomic
def record_payment(*, invoice, amount, method, actor=None, reference="", paid_on=None, notes="", provider="", provider_ref="", request=None):
    invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    amount = money(amount)
    if invoice.status not in PAYABLE:
        raise ValidationError("This invoice is not open for payment.")
    if amount <= 0:
        raise ValidationError({"amount": "Amount must be greater than zero."})
    if amount > invoice.balance:
        raise ValidationError({"amount": f"Amount exceeds the outstanding balance of {invoice.balance}."})
    payment = Payment.objects.create(
        invoice=invoice, amount=amount, method=method, reference=reference, paid_on=paid_on or timezone.localdate(),
        received_by=actor, notes=notes, provider=provider, provider_ref=provider_ref,
    )
    receipt = Receipt.objects.create(payment=payment, number=f"{invoice.school.code.upper()}-RCT-{payment.pk:07d}")
    invoice.amount_paid = money(invoice.amount_paid + amount)
    invoice.refresh_status()
    invoice.save(update_fields=["amount_paid", "status", "updated_at"])
    audit_log(actor, "payment.recorded", payment, {"invoice": invoice.pk, "amount": str(amount), "method": method}, request=request, school=invoice.school)
    transaction.on_commit(lambda: notify_payment_received.delay(payment.pk))
    return payment, receipt


def refundable(payment):
    approved = sum(r.amount for r in payment.refunds.filter(state=Refund.State.APPROVED))
    pending = sum(r.amount for r in payment.refunds.filter(state=Refund.State.REQUESTED))
    return money(payment.amount - approved - pending)


@transaction.atomic
def request_refund(*, actor, payment, amount, reason, request=None):
    amount = money(amount)
    if amount <= 0 or amount > refundable(payment):
        raise ValidationError({"amount": f"Refund must be between 0.01 and {refundable(payment)}."})
    refund = Refund.objects.create(payment=payment, amount=amount, reason=reason, requested_by=actor)
    audit_log(actor, "refund.requested", refund, {"amount": str(amount), "reason": reason}, request=request, school=payment.invoice.school)
    return refund


@transaction.atomic
def decide_refund(*, actor, refund, approve, request=None):
    if not (is_platform_admin(actor) or actor.role in REFUND_APPROVERS):
        raise PermissionDenied("You cannot decide refunds.")
    if refund.state != Refund.State.REQUESTED:
        raise ValidationError("This refund was already decided.")
    if refund.requested_by_id == actor.id and not is_platform_admin(actor):
        raise PermissionDenied("A different person must approve your refund request.")
    refund.state = Refund.State.APPROVED if approve else Refund.State.REJECTED
    refund.decided_by, refund.decided_at = actor, timezone.now()
    refund.save(update_fields=["state", "decided_by", "decided_at", "updated_at"])
    if approve:
        invoice = Invoice.objects.select_for_update().get(pk=refund.payment.invoice_id)
        invoice.amount_paid = money(invoice.amount_paid - refund.amount)
        invoice.refresh_status()
        invoice.save(update_fields=["amount_paid", "status", "updated_at"])
    audit_log(actor, "refund." + refund.state, refund, {"amount": str(refund.amount)}, request=request, school=refund.payment.invoice.school)
    return refund
