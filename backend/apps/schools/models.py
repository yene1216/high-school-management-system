from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel


def default_grading_scale():
    """[min_percent, letter] pairs, highest first. Schools can override in settings."""
    return [[90, "A"], [80, "B"], [70, "C"], [60, "D"], [0, "F"]]


class School(TimeStampedModel):
    SCHOOL_LOOKUP = "id"

    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=12, unique=True, help_text="Short code used in student IDs and invoice numbers")
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    currency = models.CharField(max_length=3, default="ETB")
    late_fee_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    reminder_days_before_due = models.PositiveSmallIntegerField(default=3)
    absence_alert_threshold = models.PositiveSmallIntegerField(default=3, help_text="Absences in 30 days that trigger a warning")
    grading_scale = models.JSONField(default=default_grading_scale)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Branch(TimeStampedModel):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="branches")
    name = models.CharField(max_length=200)
    address = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.school.code} / {self.name}"


class AcademicYear(TimeStampedModel):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name="academic_years")
    name = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ["-start_date"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uniq_year_name_per_school"),
            models.UniqueConstraint(fields=["school"], condition=Q(is_current=True), name="one_current_year_per_school"),
        ]

    def __str__(self):
        return f"{self.school.code} {self.name}"


class Term(TimeStampedModel):
    SCHOOL_LOOKUP = "academic_year__school_id"

    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name="terms")
    name = models.CharField(max_length=50)
    order = models.PositiveSmallIntegerField(default=1)
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        ordering = ["academic_year", "order"]
        constraints = [models.UniqueConstraint(fields=["academic_year", "name"], name="uniq_term_name_per_year")]

    def __str__(self):
        return f"{self.academic_year.name} {self.name}"
