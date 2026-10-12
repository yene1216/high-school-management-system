from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel
from apps.core.utils import money


class FeeCategory(TimeStampedModel):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="fee_categories")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)

    class Meta:
        verbose_name_plural = "fee categories"
        constraints = [models.UniqueConstraint(fields=["school", "code"], name="uniq_fee_category_code")]

    def __str__(self):
        return self.name


class FeeStructure(TimeStampedModel):
    class Frequency(models.TextChoices):
        ONE_TIME = "one_time", "One-time"
        MONTHLY = "monthly", "Monthly"
        TERMLY = "termly", "Per term"
        YEARLY = "yearly", "Yearly"

    SCHOOL_LOOKUP = "academic_year__school_id"

    academic_year = models.ForeignKey("schools.AcademicYear", on_delete=models.CASCADE, related_name="fee_structures")
    grade_level = models.ForeignKey("academics.GradeLevel", on_delete=models.CASCADE, related_name="fee_structures")
    category = models.ForeignKey(FeeCategory, on_delete=models.PROTECT, related_name="structures")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.YEARLY)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["academic_year", "grade_level", "category"], name="uniq_fee_structure")]


class Discount(TimeStampedModel):
    class Kind(models.TextChoices):
        PERCENT = "percent", "Percent"
        FIXED = "fixed", "Fixed amount"

    class AutoRule(models.TextChoices):
        MANUAL = "manual", "Assigned manually (scholarship, promotion)"
        SIBLING = "sibling", "Applied automatically to younger siblings"

    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="discounts")
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.PERCENT)
    value = models.DecimalField(max_digits=10, decimal_places=2)
    auto_rule = models.CharField(max_length=10, choices=AutoRule.choices, default=AutoRule.MANUAL)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class StudentDiscount(TimeStampedModel):
    """Scholarship / promotional discount assigned to one student."""

    SCHOOL_LOOKUP = "student__school_id"

    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="discounts")
    discount = models.ForeignKey(Discount, on_delete=models.CASCADE, related_name="assignments")
    valid_from = models.DateField(default=timezone.localdate)
    valid_to = models.DateField(null=True, blank=True)


class Invoice(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ISSUED = "issued", "Issued"
        PARTIAL = "partial", "Partially paid"
        PAID = "paid", "Paid"
        VOID = "void", "Void"

    school = models.ForeignKey("schools.School", on_delete=models.PROTECT, related_name="invoices")
    student = models.ForeignKey("students.Student", on_delete=models.PROTECT, related_name="invoices")
    academic_year = models.ForeignKey("schools.AcademicYear", on_delete=models.PROTECT, related_name="invoices")
    number = models.CharField(max_length=40, unique=True, null=True, blank=True, editable=False)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.DRAFT)
    issue_date = models.DateField(null=True, blank=True)
    due_date = models.DateField()
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    late_fee_applied = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["school", "status", "due_date"])]

    @property
    def balance(self):
        return money(self.total - self.amount_paid)

    @property
    def is_overdue(self):
        return self.status in (self.Status.ISSUED, self.Status.PARTIAL) and self.due_date < timezone.localdate()

    def save(self, *args, **kwargs):
        creating = self._state.adding
        super().save(*args, **kwargs)
        if creating and not self.number:
            self.number = f"{self.school.code.upper()}-INV-{self.created_at.year}-{self.pk:06d}"
            super().save(update_fields=["number"])

    def recalculate(self):
        self.total = money(sum(i.amount for i in self.items.all()))
        self.save(update_fields=["total", "updated_at"])

    def refresh_status(self):
        """Derive issued/partial/paid from money received. Draft and void are left alone."""
        if self.status in (self.Status.DRAFT, self.Status.VOID):
            return
        if self.amount_paid <= 0:
            self.status = self.Status.ISSUED
        elif self.amount_paid >= self.total:
            self.status = self.Status.PAID
        else:
            self.status = self.Status.PARTIAL

    def __str__(self):
        return self.number or f"Invoice {self.pk}"


class InvoiceItem(models.Model):
    SCHOOL_LOOKUP = "invoice__school_id"

    class Kind(models.TextChoices):
        CHARGE = "charge", "Charge"
        DISCOUNT = "discount", "Discount"
        LATE_FEE = "late_fee", "Late fee"

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.CHARGE)
    description = models.CharField(max_length=200)
    category = models.ForeignKey(FeeCategory, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    quantity = models.PositiveSmallIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Signed: discounts are negative")
