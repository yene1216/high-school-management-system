from datetime import date
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.academics.models import Enrollment
from apps.audit.services import log as audit_log
from apps.core.utils import money
from apps.students.models import Student

from .models import Discount, FeeStructure, Invoice, InvoiceItem, StudentDiscount
from .tasks import notify_invoice_issued


def has_older_sibling(student):
    """Siblings = students sharing a guardian. The eldest pays full fees; younger ones get the sibling discount."""
    return (
        Student.objects.filter(guardian_links__guardian__student_links__student=student, status=Student.Status.ACTIVE)
        .exclude(pk=student.pk)
        .filter(date_of_birth__lt=student.date_of_birth)
        .exists()
    )


def _discount_amount(discount, base):
    if discount.kind == Discount.Kind.PERCENT:
        return money(base * discount.value / 100)
    return money(min(discount.value, base))


@transaction.atomic
def generate_invoice(*, student, academic_year, due_date, actor=None, request=None):
    enrollment = (
        Enrollment.objects.filter(student=student, academic_year=academic_year, status="active")
        .select_related("section__grade_level")
        .first()
    )
    if not enrollment:
        raise ValidationError(f"{student.full_name} has no active enrollment in {academic_year.name}.")
    structures = list(
        FeeStructure.objects.filter(academic_year=academic_year, grade_level=enrollment.section.grade_level, is_active=True)
        .select_related("category")
    )
    if not structures:
        raise ValidationError(f"No fee structure defined for {enrollment.section.grade_level.name} in {academic_year.name}.")

    invoice = Invoice.objects.create(school=student.school, student=student, academic_year=academic_year, due_date=due_date)
    charges = Decimal(0)
    for s in structures:
        InvoiceItem.objects.create(
            invoice=invoice, kind=InvoiceItem.Kind.CHARGE, description=s.category.name, category=s.category,
            unit_price=s.amount, amount=s.amount,
        )
        charges += s.amount

    today = timezone.localdate()
    assigned = StudentDiscount.objects.filter(student=student, discount__is_active=True, valid_from__lte=today).exclude(valid_to__lt=today)
    discounts = [a.discount for a in assigned.select_related("discount")]
    if has_older_sibling(student):
        discounts += list(Discount.objects.filter(school=student.school, auto_rule=Discount.AutoRule.SIBLING, is_active=True))
    remaining = money(charges)
    for d in discounts:
        amount = min(_discount_amount(d, charges), remaining)  # never discount below zero
        if amount <= 0:
            continue
        InvoiceItem.objects.create(invoice=invoice, kind=InvoiceItem.Kind.DISCOUNT, description=d.name, unit_price=-amount, amount=-amount)
        remaining -= amount
    invoice.recalculate()
    audit_log(actor, "invoice.created", invoice, {"total": str(invoice.total)}, request=request)
    return invoice


@transaction.atomic
def issue_invoice(*, invoice, actor=None, request=None):
    if invoice.status != Invoice.Status.DRAFT:
        raise ValidationError("Only draft invoices can be issued.")
    if invoice.total <= 0:
        raise ValidationError("An invoice with no amount due cannot be issued.")
    invoice.status, invoice.issue_date = Invoice.Status.ISSUED, timezone.localdate()
    invoice.save(update_fields=["status", "issue_date", "updated_at"])
    audit_log(actor, "invoice.issued", invoice, request=request)
    transaction.on_commit(lambda: notify_invoice_issued.delay(invoice.pk))
    return invoice


@transaction.atomic
def void_invoice(*, invoice, actor, reason, request=None):
    if invoice.amount_paid > 0:
        raise ValidationError("Refund the payments on this invoice before voiding it.")
    invoice.status = Invoice.Status.VOID
    invoice.save(update_fields=["status", "updated_at"])
    audit_log(actor, "invoice.voided", invoice, {"reason": reason}, request=request)
    return invoice


@transaction.atomic
def bulk_generate(*, school, academic_year, grade_level, due_date, actor, issue=True, request=None):
    """Invoice every actively enrolled student of a grade once per (year, due date)."""
    enrollments = Enrollment.objects.filter(
        academic_year=academic_year, status="active", section__grade_level=grade_level, student__school=school
    ).select_related("student")
    created, skipped = [], []
    for e in enrollments:
        if Invoice.objects.filter(student=e.student, academic_year=academic_year, due_date=due_date).exclude(status=Invoice.Status.VOID).exists():
            skipped.append(e.student_id)
            continue
        invoice = generate_invoice(student=e.student, academic_year=academic_year, due_date=due_date, actor=actor, request=request)
        if issue:
            issue_invoice(invoice=invoice, actor=actor, request=request)
        created.append(invoice)
    return created, skipped


@transaction.atomic
def apply_late_fees(today: date | None = None):
    """Add one late-fee line to each overdue invoice of schools that configured a late-fee percentage."""
    today = today or timezone.localdate()
    invoices = (
        Invoice.objects.select_for_update(of=("self",))
        .filter(status__in=(Invoice.Status.ISSUED, Invoice.Status.PARTIAL), due_date__lt=today, late_fee_applied=False, school__late_fee_percent__gt=0)
        .select_related("school")
    )
    count = 0
    for inv in invoices:
        fee = money(inv.balance * inv.school.late_fee_percent / 100)
        if fee <= 0:
            continue
        InvoiceItem.objects.create(invoice=inv, kind=InvoiceItem.Kind.LATE_FEE, description="Late fee", unit_price=fee, amount=fee)
        inv.late_fee_applied = True
        inv.recalculate()
        inv.refresh_status()
        inv.save(update_fields=["late_fee_applied", "status", "updated_at"])
        count += 1
    return count
