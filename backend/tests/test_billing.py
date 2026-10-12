import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.billing import services as billing
from apps.billing.models import Invoice
from apps.payments.models import Payment

from .helpers import World, client_for


class BillingTests(TestCase):
    def setUp(self):
        self.w = World("BIL")
        self.due = timezone.localdate() + timedelta(days=10)

    def invoice(self, student, issue=True):
        inv = billing.generate_invoice(student=student, academic_year=self.w.year, due_date=self.due, actor=self.w.admin)
        if issue:
            billing.issue_invoice(invoice=inv, actor=self.w.admin)
        return inv

    def test_sibling_discount_applies_to_younger_child_only(self):
        self.assertEqual(self.invoice(self.w.older).total, Decimal("1000.00"))
        self.assertEqual(self.invoice(self.w.younger).total, Decimal("900.00"))

    def test_partial_then_full_payment(self):
        inv = self.invoice(self.w.older)
        c = client_for(self.w.accountant)
        r1 = c.post("/api/v1/payments/", {"invoice": inv.pk, "amount": "400.00", "method": "cash"}, format="json")
        self.assertEqual(r1.status_code, 201)
        inv.refresh_from_db()
        self.assertEqual((inv.status, inv.balance), ("partial", Decimal("600.00")))
        r2 = c.post("/api/v1/payments/", {"invoice": inv.pk, "amount": "600.00", "method": "bank_transfer", "reference": "TX1"}, format="json")
        self.assertEqual(r2.status_code, 201)
        inv.refresh_from_db()
        self.assertEqual(inv.status, "paid")
        self.assertTrue(r2.json()["receipt_number"].startswith("BIL-RCT-"))

    def test_overpayment_rejected(self):
        inv = self.invoice(self.w.older)
        res = client_for(self.w.accountant).post("/api/v1/payments/", {"invoice": inv.pk, "amount": "1000.01", "method": "cash"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Payment.objects.count(), 0)

    def test_parent_sees_own_invoices_but_cannot_pay_or_see_drafts(self):
        draft = self.invoice(self.w.older, issue=False)
        issued = self.invoice(self.w.younger)
        stranger_inv = self.invoice(self.w.other)
        c = client_for(self.w.parent)
        ids = {r["id"] for r in c.get("/api/v1/invoices/").json()["results"]}
        self.assertEqual(ids, {issued.pk})
        self.assertNotIn(draft.pk, ids)
        self.assertNotIn(stranger_inv.pk, ids)
        self.assertEqual(c.post("/api/v1/payments/", {"invoice": issued.pk, "amount": "10", "method": "cash"}, format="json").status_code, 403)

    def test_refund_requires_second_person(self):
        inv = self.invoice(self.w.older)
        c = client_for(self.w.accountant)
        pay = c.post("/api/v1/payments/", {"invoice": inv.pk, "amount": "1000", "method": "cash"}, format="json").json()
        ref = c.post("/api/v1/refunds/", {"payment": pay["id"], "amount": "300", "reason": "Overpaid"}, format="json")
        self.assertEqual(ref.status_code, 201)
        rid = ref.json()["id"]
        self.assertEqual(c.post(f"/api/v1/refunds/{rid}/decide/", {"approve": True}, format="json").status_code, 403)
        ok = client_for(self.w.admin).post(f"/api/v1/refunds/{rid}/decide/", {"approve": True}, format="json")
        self.assertEqual(ok.status_code, 200)
        inv.refresh_from_db()
        self.assertEqual((inv.status, inv.balance), ("partial", Decimal("300.00")))

    def test_late_fee_applied_once(self):
        inv = self.invoice(self.w.older)
        Invoice.objects.filter(pk=inv.pk).update(due_date=timezone.localdate() - timedelta(days=3))
        self.assertEqual(billing.apply_late_fees(), 1)
        self.assertEqual(billing.apply_late_fees(), 0)
        inv.refresh_from_db()
        self.assertEqual(inv.total, Decimal("1050.00"))  # 5% of 1000

    def test_bulk_generate_is_idempotent(self):
        c = client_for(self.w.accountant)
        body = {"academic_year": self.w.year.pk, "grade_level": self.w.grade.pk, "due_date": self.due.isoformat()}
        first = c.post("/api/v1/invoices/bulk-generate/", body, format="json").json()
        second = c.post("/api/v1/invoices/bulk-generate/", body, format="json").json()
        self.assertEqual(first["created"], 3)
        self.assertEqual((second["created"], second["skipped_existing"]), (0, 3))

    @override_settings(PAYMENT_MOCK_WEBHOOK_SECRET="s3cret")
    def test_webhook_verifies_signature_and_is_idempotent(self):
        from rest_framework.test import APIClient

        inv = self.invoice(self.w.older)
        body = json.dumps({"event_id": "evt_1", "invoice_id": inv.pk, "amount": "1000", "status": "paid"}).encode()
        sig = hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
        c = APIClient()
        url = "/api/v1/payments/webhook/mock/"
        self.assertEqual(c.post(url, body, content_type="application/json", HTTP_X_SIGNATURE="bad").status_code, 400)
        self.assertEqual(c.post(url, body, content_type="application/json", HTTP_X_SIGNATURE=sig).status_code, 200)
        self.assertEqual(c.post(url, body, content_type="application/json", HTTP_X_SIGNATURE=sig).json()["detail"], "duplicate")
        self.assertEqual(Payment.objects.count(), 1)
        inv.refresh_from_db()
        self.assertEqual(inv.status, "paid")
