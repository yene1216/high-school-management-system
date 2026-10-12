"""Pluggable delivery providers. Add a class here (or anywhere importable) and point SMS_PROVIDER at it."""
import logging
from abc import ABC, abstractmethod

from django.conf import settings
from django.core.mail import send_mail
from django.utils.module_loading import import_string

logger = logging.getLogger(__name__)


class SMSProvider(ABC):
    @abstractmethod
    def send(self, to: str, body: str) -> str:
        """Send an SMS and return the provider's message id. Raise on failure so the task retries."""


class ConsoleSMSProvider(SMSProvider):
    """Default: logs the message. Replace with a real gateway adapter available in your country."""

    def send(self, to, body):
        logger.info("SMS to %s: %s", to, body)
        return "console"


def get_sms_provider() -> SMSProvider:
    return import_string(settings.SMS_PROVIDER)()


def send_email(to, subject, body):
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=False)
    return "email"
