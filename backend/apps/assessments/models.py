from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class Assessment(TimeStampedModel):
    SCHOOL_LOOKUP = "section__grade_level__school_id"

    class Kind(models.TextChoices):
        QUIZ = "quiz", "Quiz"
        ASSIGNMENT = "assignment", "Assignment"
        MIDTERM = "midterm", "Midterm"
        FINAL = "final", "Final exam"
        OTHER = "other", "Other"

    section = models.ForeignKey("academics.Section", on_delete=models.CASCADE, related_name="assessments")
    subject = models.ForeignKey("academics.Subject", on_delete=models.PROTECT, related_name="assessments")
    term = models.ForeignKey("schools.Term", null=True, blank=True, on_delete=models.SET_NULL, related_name="assessments")
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.QUIZ)
    max_score = models.DecimalField(max_digits=6, decimal_places=2)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=10, help_text="Share of the term grade")
    date = models.DateField()
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.name} ({self.section})"


class Grade(models.Model):
    SCHOOL_LOOKUP = "assessment__section__grade_level__school_id"

    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE, related_name="grades")
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="grades")
    score = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    remarks = models.CharField(max_length=255, blank=True)
    entered_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["assessment", "student"], name="one_grade_per_student_assessment")]
