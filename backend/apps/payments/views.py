import logging

from django.db import IntegrityError
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.billing.models import Invoice
from apps.billing.selectors import visible_invoices
from apps.core.permissions import FINANCE_ROLES, has_role

from . import services
from .models import Payment, Refund
from .providers import WebhookVerificationError, get_provider
from .serializers import PaymentSerializer, ReceiptSerializer, RefundSerializer

logger = logging.getLogger(__name__)
CASHIERS = (Role.SCHOOL_ADMIN, Role.ACCOUNTANT)


class PaymentViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = PaymentSerializer
    filterset_fields = ["invoice", "method", "status"]

    def get_queryset(self):
        return Payment.objects.filter(invoice__in=visible_invoices(self.request.user)).select_related("invoice", "receipt")

    def create(self, request, *args, **kwargs):
        """Record an offline (cash / bank transfer / mobile money) payment."""
        if not has_role(request.user, *CASHIERS):
            return Response({"detail": "Only cashiers and school admins can record payments."}, status=status.HTTP_403_FORBIDDEN)
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        if d["method"] == Payment.Method.ONLINE:
            raise ValidationError({"method": "Online payments are recorded automatically by the payment gateway."})
        invoice = visible_invoices(request.user).filter(pk=d["invoice"].pk).first()
        if not invoice:
            raise ValidationError({"invoice": "Unknown invoice."})
        payment, _ = services.record_payment(
            invoice=invoice, amount=d["amount"], method=d["method"], actor=request.user, reference=d.get("reference", ""),
            paid_on=d.get("paid_on"), notes=d.get("notes", ""), request=request,
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def receipt(self, request, pk=None):
        return Response(ReceiptSerializer(self.get_object().receipt).data)


class RefundViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = RefundSerializer
    filterset_fields = ["state", "payment"]

    def get_queryset(self):
        if not has_role(self.request.user, *FINANCE_ROLES):
            return Refund.objects.none()
        return Refund.objects.filter(payment__invoice__in=visible_invoices(self.request.user))

    def create(self, request, *args, **kwargs):
        if not has_role(request.user, *CASHIERS):
            return Response({"detail": "Only cashiers and school admins can request refunds."}, status=status.HTTP_403_FORBIDDEN)
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        payment = Payment.objects.filter(pk=ser.validated_data["payment"].pk, invoice__in=visible_invoices(request.user)).first()
        if not payment:
            raise ValidationError({"payment": "Unknown payment."})
        refund = services.request_refund(actor=request.user, payment=payment, amount=ser.validated_data["amount"], reason=ser.validated_data["reason"], request=request)
        return Response(RefundSerializer(refund).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def decide(self, request, pk=None):
        refund = services.decide_refund(actor=request.user, refund=self.get_object(), approve=bool(request.data.get("approve")), request=request)
        return Response(RefundSerializer(refund).data)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def provider_webhook(request, provider):
    """POST /payments/webhook/<provider>/ - signature-verified and idempotent."""
    try:
        adapter = get_provider(provider)
    except KeyError:
        return Response(status=status.HTTP_404_NOT_FOUND)
    try:
        event = adapter.parse_webhook(request.headers, request.body)
    except WebhookVerificationError:
        return Response(status=status.HTTP_400_BAD_REQUEST)
    except (KeyError, ValueError):
        return Response({"detail": "Malformed payload."}, status=status.HTTP_400_BAD_REQUEST)
    if not event.paid:
        return Response({"detail": "ignored"})
    invoice = Invoice.objects.filter(pk=event.invoice_id).first()
    if not invoice:
        return Response({"detail": "Unknown invoice."}, status=status.HTTP_404_NOT_FOUND)
    if Payment.objects.filter(provider=adapter.name, provider_ref=event.event_id).exists():
        return Response({"detail": "duplicate"})  # already processed
    try:
        services.record_payment(
            invoice=invoice, amount=event.amount, method=Payment.Method.ONLINE, provider=adapter.name,
            provider_ref=event.event_id, reference=event.event_id,
        )
    except IntegrityError:
        return Response({"detail": "duplicate"})
    except ValidationError as exc:
        logger.error("Webhook %s could not be applied: %s", event.event_id, exc.detail)
        return Response({"detail": "Cannot apply payment; flagged for manual review."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
    return Response({"detail": "ok"})
