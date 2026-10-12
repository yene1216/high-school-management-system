from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import TimeStampedModel


class GradeLevel(TimeStampedModel):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="grade_levels")
    name = models.CharField(max_length=50)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]
        constraints = [models.UniqueConstraint(fields=["school", "name"], name="uniq_grade_name_per_school")]

    def __str__(self):
        return self.name


class Subject(TimeStampedModel):
    school = models.ForeignKey("schools.School", on_delete=models.CASCADE, related_name="subjects")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["school", "code"], name="uniq_subject_code_per_school")]

    def __str__(self):
        return self.name


class Section(TimeStampedModel):
    SCHOOL_LOOKUP = "grade_level__school_id"

    grade_level = models.ForeignKey(GradeLevel, on_delete=models.CASCADE, related_name="sections")
    academic_year = models.ForeignKey("schools.AcademicYear", on_delete=models.CASCADE, related_name="sections")
    name = models.CharField(max_length=20)
    homeroom_teacher = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="homeroom_sections")
    room = models.CharField(max_length=30, blank=True)
    capacity = models.PositiveSmallIntegerField(default=40)

    class Meta:
        ordering = ["grade_level__order", "name"]
        constraints = [models.UniqueConstraint(fields=["grade_level", "academic_year", "name"], name="uniq_section")]

    def __str__(self):
        return f"{self.grade_level.name}{self.name}"


class TeacherAssignment(TimeStampedModel):
    SCHOOL_LOOKUP = "section__grade_level__school_id"

    teacher = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="teaching_assignments")
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="teacher_assignments")
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="teacher_assignments")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["teacher", "section", "subject"], name="uniq_teacher_assignment")]


class Enrollment(TimeStampedModel):
    SCHOOL_LOOKUP = "student__school_id"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        PROMOTED = "promoted", "Promoted"
        WITHDRAWN = "withdrawn", "Withdrawn"

    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="enrollments")
    section = models.ForeignKey(Section, on_delete=models.PROTECT, related_name="enrollments")
    academic_year = models.ForeignKey("schools.AcademicYear", on_delete=models.PROTECT, related_name="enrollments", editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    enrolled_on = models.DateField(default=timezone.localdate)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["student", "academic_year"], condition=Q(status="active"), name="one_active_enrollment_per_year"
            )
        ]

    def save(self, *args, **kwargs):
        self.academic_year_id = self.section.academic_year_id
        super().save(*args, **kwargs)
