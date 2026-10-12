from rest_framework import serializers

from .models import Payment, Receipt, Refund


class PaymentSerializer(serializers.ModelSerializer):
    receipt_number = serializers.CharField(source="receipt.number", read_only=True)
    invoice_number = serializers.CharField(source="invoice.number", read_only=True)

    class Meta:
        model = Payment
        fields = ("id", "invoice", "invoice_number", "amount", "method", "status", "paid_on", "reference", "notes", "receipt_number", "created_at")
        read_only_fields = ("status", "created_at")


class ReceiptSerializer(serializers.ModelSerializer):
    payment = PaymentSerializer(read_only=True)
    student = serializers.CharField(source="payment.invoice.student.full_name", read_only=True)
    school = serializers.CharField(source="payment.invoice.school.name", read_only=True)
    currency = serializers.CharField(source="payment.invoice.school.currency", read_only=True)

    class Meta:
        model = Receipt
        fields = ("number", "issued_at", "school", "student", "currency", "payment")


class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = ("id", "payment", "amount", "reason", "state", "requested_by", "decided_by", "decided_at", "created_at")
        read_only_fields = ("state", "requested_by", "decided_by", "decided_at", "created_at")
