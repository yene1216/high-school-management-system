from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import TimeStampedModel


class Payment(TimeStampedModel):
    SCHOOL_LOOKUP = "invoice__school_id"

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        MOBILE_MONEY = "mobile_money", "Mobile money"
        ONLINE = "online", "Online (gateway)"

    class Status(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmed"
        REVERSED = "reversed", "Reversed"

    invoice = models.ForeignKey("billing.Invoice", on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=14, choices=Method.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CONFIRMED)
    paid_on = models.DateField(default=timezone.localdate)
    reference = models.CharField(max_length=100, blank=True, help_text="Bank slip / transaction reference")
    provider = models.CharField(max_length=30, blank=True)
    provider_ref = models.CharField(max_length=100, blank=True)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # A gateway event can be delivered many times; only the first one may create a payment.
            models.UniqueConstraint(fields=["provider", "provider_ref"], condition=~Q(provider_ref=""), name="uniq_provider_event"),
        ]


class Receipt(models.Model):
    SCHOOL_LOOKUP = "payment__invoice__school_id"

    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name="receipt")
    number = models.CharField(max_length=40, unique=True)
    issued_at = models.DateTimeField(auto_now_add=True)


class Refund(TimeStampedModel):
    SCHOOL_LOOKUP = "payment__invoice__school_id"

    class State(models.TextChoices):
        REQUESTED = "requested", "Requested"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="refunds")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255)
    state = models.CharField(max_length=10, choices=State.choices, default=State.REQUESTED)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    decided_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
