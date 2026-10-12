from django.conf import settings
from django.db import models


class Category(models.TextChoices):
    ATTENDANCE = "attendance", "Attendance"
    GRADES = "grades", "Grades"
    BILLING = "billing", "Billing"
    ANNOUNCEMENT = "announcement", "Announcements"
    EVENT = "event", "Events"
    GENERAL = "general", "General"


class Priority(models.TextChoices):
    INFO = "info", "Informational"
    WARNING = "warning", "Warning"
    URGENT = "urgent", "Urgent"


class Channel(models.TextChoices):
    IN_APP = "in_app", "In-app"
    EMAIL = "email", "Email"
    SMS = "sms", "SMS"


class NotificationTemplate(models.Model):
    """School-specific override of a built-in message. school=null applies to every school."""

    school = models.ForeignKey("schools.School", null=True, blank=True, on_delete=models.CASCADE, related_name="+")
    code = models.CharField(max_length=60)
    language = models.CharField(max_length=5, default="en")
    subject = models.CharField(max_length=200)
    body = models.TextField(help_text="Use $variables such as $student_name, $invoice_number, $due_date")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["school", "code", "language"], name="uniq_template")]


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.GENERAL)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.INFO)
    title = models.CharField(max_length=200)
    body = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    show_in_app = models.BooleanField(default=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.user_id}: {self.title}"


class NotificationPreference(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preferences")
    category = models.CharField(max_length=20, choices=Category.choices)
    in_app = models.BooleanField(default=True)
    email = models.BooleanField(default=True)
    sms = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "category"], name="uniq_pref_per_category")]


class NotificationDelivery(models.Model):
    """One row per (notification, channel): the delivery log with retry tracking."""

    SCHOOL_LOOKUP = "notification__user__school_id"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name="deliveries")
    channel = models.CharField(max_length=10, choices=Channel.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=500, blank=True)
    provider_ref = models.CharField(max_length=100, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
