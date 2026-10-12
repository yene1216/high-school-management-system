import os
import uuid

from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel
from apps.core.validators import DOCUMENT_EXTENSIONS, validate_document, validate_upload_size


def student_photo_path(instance, filename):
    return f"students/photos/{uuid.uuid4().hex}{os.path.splitext(filename)[1].lower()}"


def student_document_path(instance, filename):
    return f"students/documents/{uuid.uuid4().hex}{os.path.splitext(filename)[1].lower()}"


class Student(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        WITHDRAWN = "withdrawn", "Withdrawn"
        TRANSFERRED = "transferred", "Transferred"
        GRADUATED = "graduated", "Graduated"

    class Gender(models.TextChoices):
        MALE = "M", "Male"
        FEMALE = "F", "Female"

    school = models.ForeignKey("schools.School", on_delete=models.PROTECT, related_name="students")
    student_code = models.CharField(max_length=40, unique=True, null=True, blank=True, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="student_profile")
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=Gender.choices)
    photo = models.ImageField(upload_to=student_photo_path, null=True, blank=True, validators=[validate_upload_size])
    address = models.CharField(max_length=255, blank=True)
    nationality = models.CharField(max_length=60, default="Ethiopian")
    admission_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        ordering = ["last_name", "first_name"]
        indexes = [models.Index(fields=["school", "status"])]

    @property
    def full_name(self):
        return " ".join(p for p in (self.first_name, self.middle_name, self.last_name) if p)

    def save(self, *args, **kwargs):
        creating = self._state.adding
        super().save(*args, **kwargs)
        if creating and not self.student_code:
            self.student_code = f"{self.school.code.upper()}-{self.admission_date.year}-{self.pk:05d}"
            super().save(update_fields=["student_code"])

    def __str__(self):
        return f"{self.full_name} ({self.student_code})"


class Guardian(TimeStampedModel):
    school = models.ForeignKey("schools.School", on_delete=models.PROTECT, related_name="guardians")
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="guardian_profile")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=100, blank=True)
    address = models.CharField(max_length=255, blank=True)
    students = models.ManyToManyField(Student, through="GuardianStudent", related_name="guardians")

    class Meta:
        ordering = ["last_name", "first_name"]

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return self.full_name


class GuardianStudent(models.Model):
    SCHOOL_LOOKUP = "student__school_id"

    class Relationship(models.TextChoices):
        FATHER = "father", "Father"
        MOTHER = "mother", "Mother"
        GUARDIAN = "guardian", "Legal guardian"
        OTHER = "other", "Other"

    guardian = models.ForeignKey(Guardian, on_delete=models.CASCADE, related_name="student_links")
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="guardian_links")
    relationship = models.CharField(max_length=10, choices=Relationship.choices, default=Relationship.GUARDIAN)
    is_primary = models.BooleanField(default=False)
    can_pickup = models.BooleanField(default=False, help_text="Authorized to pick the student up")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["guardian", "student"], name="uniq_guardian_student")]


class EmergencyContact(models.Model):
    SCHOOL_LOOKUP = "student__school_id"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="emergency_contacts")
    name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=60, blank=True)
    phone = models.CharField(max_length=32)


class StudentDocument(TimeStampedModel):
    SCHOOL_LOOKUP = "student__school_id"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=60)
    file = models.FileField(
        upload_to=student_document_path,
        validators=[FileExtensionValidator(DOCUMENT_EXTENSIONS), validate_upload_size, validate_document],
    )  # stored privately; downloaded only through the permission-checked API endpoint
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")


class SupportRecord(TimeStampedModel):
    """Medical / counselling notes. Visible only to counselors and school admins (see selectors)."""

    SCHOOL_LOOKUP = "student__school_id"

    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name="support_record")
    medical_notes = models.TextField(blank=True)
    allergies = models.TextField(blank=True)
    support_notes = models.TextField(blank=True)
