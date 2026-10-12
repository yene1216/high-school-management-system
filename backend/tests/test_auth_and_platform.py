from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .helpers import World, client_for

XHR = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"}
PASSWORD = "Str0ng-pass-123"


class AuthTests(TestCase):
    def setUp(self):
        self.w = World("AUT")

    def login(self, client=None, email=None):
        client = client or APIClient()
        return client, client.post("/api/v1/auth/login/", {"email": email or self.w.parent.email, "password": PASSWORD}, format="json")

    def test_login_sets_httponly_refresh_cookie_and_hides_refresh_from_body(self):
        _, res = self.login()
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.json())
        self.assertNotIn("refresh", res.json())
        self.assertEqual(res.json()["user"]["role"], "parent")
        cookie = res.cookies["refresh_token"]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Strict")

    def test_wrong_password_rejected(self):
        res = APIClient().post("/api/v1/auth/login/", {"email": self.w.parent.email, "password": "nope"}, format="json")
        self.assertEqual(res.status_code, 401)

    def test_refresh_uses_cookie_rotates_it_and_requires_xhr_header(self):
        client, _ = self.login()
        self.assertEqual(client.post("/api/v1/auth/refresh/", {}, format="json").status_code, 403)  # no header
        old = client.cookies["refresh_token"].value
        res = client.post("/api/v1/auth/refresh/", {}, format="json", **XHR)
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.json())
        self.assertNotEqual(client.cookies["refresh_token"].value, old)  # rotated

    def test_rotated_refresh_token_cannot_be_reused(self):
        client, _ = self.login()
        old = client.cookies["refresh_token"].value
        client.post("/api/v1/auth/refresh/", {}, format="json", **XHR)
        thief = APIClient()
        thief.cookies["refresh_token"] = old
        self.assertEqual(thief.post("/api/v1/auth/refresh/", {}, format="json", **XHR).status_code, 401)

    def test_logout_blacklists_refresh_token(self):
        client, _ = self.login()
        token = client.cookies["refresh_token"].value
        self.assertEqual(client.post("/api/v1/auth/logout/", {}, format="json", **XHR).status_code, 204)
        replay = APIClient()
        replay.cookies["refresh_token"] = token
        self.assertEqual(replay.post("/api/v1/auth/refresh/", {}, format="json", **XHR).status_code, 401)

    def test_password_reset_flow_and_no_account_enumeration(self):
        c = APIClient()
        self.assertEqual(c.post("/api/v1/auth/password-reset/", {"email": "nobody@x.test"}, format="json").status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(c.post("/api/v1/auth/password-reset/", {"email": self.w.parent.email}, format="json").status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        body = mail.outbox[0].body
        uid = body.split("uid=")[1].split("&")[0]
        token = body.split("token=")[1].split()[0]
        bad = c.post("/api/v1/auth/password-reset/confirm/", {"uid": uid, "token": "wrong", "new_password": "An0ther-strong-pass"}, format="json")
        self.assertEqual(bad.status_code, 400)
        ok = c.post("/api/v1/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "An0ther-strong-pass"}, format="json")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(c.post("/api/v1/auth/login/", {"email": self.w.parent.email, "password": "An0ther-strong-pass"}, format="json").status_code, 200)
        reuse = c.post("/api/v1/auth/password-reset/confirm/", {"uid": uid, "token": token, "new_password": "Yet-an0ther-pass1"}, format="json")
        self.assertEqual(reuse.status_code, 400)  # token is single-use


class PlatformTests(TestCase):
    def setUp(self):
        self.w = World("PLT")

    def test_health_endpoints(self):
        c = APIClient()
        self.assertEqual(c.get("/healthz").status_code, 200)
        self.assertEqual(c.get("/readyz").json()["database"], "ok")

    def test_duplicate_returns_409_not_500(self):
        c = client_for(self.w.admin)
        body = {"name": "Physics", "code": "PHY"}
        self.assertEqual(c.post("/api/v1/subjects/", body, format="json").status_code, 201)
        res = c.post("/api/v1/subjects/", body, format="json")
        self.assertIn(res.status_code, (400, 409))

    def test_audit_log_is_append_only(self):
        from apps.audit.models import AuditLog
        from apps.audit.services import log

        entry = log(self.w.admin, "test.event")
        entry.action = "tampered"
        with self.assertRaises(PermissionError):
            entry.save()
        with self.assertRaises(PermissionError):
            AuditLog.objects.all().delete()

    def test_document_upload_validation_and_private_download(self):
        registrar = client_for(self.w.registrar)
        url = "/api/v1/student-documents/"
        exe = SimpleUploadedFile("id.pdf", b"MZ\x90\x00 not really a pdf")
        self.assertEqual(registrar.post(url, {"student": self.w.older.pk, "doc_type": "birth", "file": exe}, format="multipart").status_code, 400)
        txt = SimpleUploadedFile("id.txt", b"hello")
        self.assertEqual(registrar.post(url, {"student": self.w.older.pk, "doc_type": "birth", "file": txt}, format="multipart").status_code, 400)
        pdf = SimpleUploadedFile("birth.pdf", b"%PDF-1.4 fake but correctly signed")
        res = registrar.post(url, {"student": self.w.older.pk, "doc_type": "birth", "file": pdf}, format="multipart")
        self.assertEqual(res.status_code, 201, res.content)
        doc_id = res.json()["id"]
        self.assertNotIn("file", res.json())  # no direct file URL is ever exposed
        # Linked parent may download; other parents and teachers may not.
        self.assertEqual(client_for(self.w.parent).get(f"/api/v1/student-documents/{doc_id}/download/").status_code, 200)
        self.assertEqual(client_for(self.w.stranger).get(f"/api/v1/student-documents/{doc_id}/download/").status_code, 404)
        self.assertEqual(client_for(self.w.teacher_a).get(f"/api/v1/student-documents/{doc_id}/download/").status_code, 404)

    def test_login_throttled_per_email(self):
        from django.core.cache import cache
        from django.test import override_settings
        from rest_framework.throttling import SimpleRateThrottle

        cache.clear()
        with override_settings():
            from apps.core.throttles import LoginEmailThrottle

            LoginEmailThrottle.THROTTLE_RATES = {**SimpleRateThrottle.THROTTLE_RATES, "login_email": "3/hour"}
            try:
                c = APIClient()
                codes = [c.post("/api/v1/auth/login/", {"email": self.w.parent.email, "password": "bad"}, format="json").status_code for _ in range(5)]
            finally:
                LoginEmailThrottle.THROTTLE_RATES = SimpleRateThrottle.THROTTLE_RATES
        self.assertIn(429, codes)
        cache.clear()
