"""Payment-provider interface.

Every gateway (including any Ethiopian provider) is an adapter implementing PaymentProvider and registered in
PROVIDERS. Core billing never imports a specific gateway. Credentials come from environment variables read in the
adapter; nothing is hard-coded here.
"""
import hashlib
import hmac
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings


@dataclass
class CheckoutSession:
    url: str
    provider_ref: str


@dataclass
class WebhookEvent:
    event_id: str
    invoice_id: int
    amount: Decimal
    paid: bool


class WebhookVerificationError(Exception):
    pass


class PaymentProvider(ABC):
    name: str

    @abstractmethod
    def create_checkout(self, invoice, amount: Decimal, return_url: str) -> CheckoutSession: ...

    @abstractmethod
    def parse_webhook(self, headers, body: bytes) -> WebhookEvent:
        """Verify the signature and return a normalised event. Raise WebhookVerificationError if invalid."""


class MockProvider(PaymentProvider):
    """HMAC-signed provider used for local development and tests. Enabled only when a secret is configured."""

    name = "mock"

    def create_checkout(self, invoice, amount, return_url):
        return CheckoutSession(url=f"{return_url}?mock_invoice={invoice.pk}", provider_ref=f"mock-{invoice.pk}")

    def parse_webhook(self, headers, body):
        secret = settings.PAYMENT_MOCK_WEBHOOK_SECRET
        if not secret:
            raise WebhookVerificationError("Mock provider is not configured.")
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, headers.get("X-Signature", "")):
            raise WebhookVerificationError("Bad signature.")
        payload = json.loads(body)
        return WebhookEvent(
            event_id=str(payload["event_id"]), invoice_id=int(payload["invoice_id"]),
            amount=Decimal(str(payload["amount"])), paid=payload.get("status") == "paid",
        )


PROVIDERS = {MockProvider.name: MockProvider()}


def get_provider(name):
    try:
        return PROVIDERS[name]
    except KeyError:
        raise KeyError(f"Unknown payment provider: {name}") from None
