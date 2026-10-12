from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "super_admin", "Super admin"
    SCHOOL_ADMIN = "school_admin", "School admin"
    REGISTRAR = "registrar", "Registrar"
    TEACHER = "teacher", "Teacher"
    PARENT = "parent", "Parent / guardian"
    STUDENT = "student", "Student"
    ACCOUNTANT = "accountant", "Accountant / cashier"
    HR = "hr", "HR / staff manager"
    PRINCIPAL = "principal", "Principal / management"
    LIBRARIAN = "librarian", "Librarian"
    TRANSPORT = "transport", "Transport manager"
    COUNSELOR = "counselor", "Counselor / nurse"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", Role.SUPER_ADMIN)
        return self._create(email, password, **extra)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    school = models.ForeignKey("schools.School", null=True, blank=True, on_delete=models.PROTECT, related_name="users")
    phone = models.CharField(max_length=32, blank=True)
    language = models.CharField(max_length=5, choices=[("en", "English"), ("am", "አማርኛ")], default="en")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        ordering = ["first_name", "last_name"]

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def __str__(self):
        return f"{self.full_name} ({self.role})"
