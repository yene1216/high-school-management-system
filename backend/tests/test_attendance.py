from django.core import mail
from django.test import TestCase
from django.utils import timezone

from apps.attendance.models import AttendanceRecord
from apps.notifications.models import Notification

from .helpers import World, client_for


class AttendanceTests(TestCase):
    def setUp(self):
        self.w = World("ATT")
        self.today = timezone.localdate().isoformat()

    def mark(self, user, section, status="absent", student=None):
        student = student or self.w.older
        return client_for(user).post(
            "/api/v1/attendance/",
            {"section": section.pk, "date": self.today, "records": [{"student": student.pk, "status": status}]},
            format="json",
        )

    def test_teacher_can_mark_own_section_and_parent_is_notified(self):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.mark(self.w.teacher_a, self.w.sec_a)
        self.assertEqual(res.status_code, 201)
        note = Notification.objects.get(user=self.w.parent)
        self.assertEqual(note.category, "attendance")
        self.assertIn("Old Kid", note.body)
        self.assertEqual(len(mail.outbox), 1)  # email is on by default; SMS is off

    def test_teacher_cannot_mark_other_section(self):
        res = self.mark(self.w.teacher_a, self.w.sec_b, student=self.w.other)
        self.assertEqual(res.status_code, 403)
        self.assertFalse(AttendanceRecord.objects.exists())

    def test_student_must_be_enrolled_in_section(self):
        res = self.mark(self.w.teacher_a, self.w.sec_a, student=self.w.other)
        self.assertEqual(res.status_code, 400)

    def test_parent_cannot_mark(self):
        self.assertEqual(self.mark(self.w.parent, self.w.sec_a).status_code, 403)

    def test_later_change_needs_correction_workflow(self):
        self.mark(self.w.teacher_a, self.w.sec_a, "present")
        record = AttendanceRecord.objects.get()
        # Another teacher-level actor (not the original marker) cannot silently overwrite.
        res = self.mark(self.w.admin, self.w.sec_a, "absent")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["skipped"][0]["student"], self.w.older.pk)
        record.refresh_from_db()
        self.assertEqual(record.status, "present")

    def test_teacher_correction_needs_admin_approval(self):
        self.mark(self.w.teacher_a, self.w.sec_a, "present")
        record = AttendanceRecord.objects.get()
        res = client_for(self.w.teacher_a).post(f"/api/v1/attendance/{record.pk}/correct/", {"new_status": "excused", "reason": "Doctor's note"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["state"], "pending")
        record.refresh_from_db()
        self.assertEqual(record.status, "present")
        cid = res.json()["id"]
        # The requester cannot approve their own request.
        self.assertEqual(client_for(self.w.teacher_a).post(f"/api/v1/attendance-corrections/{cid}/review/", {"approve": True}, format="json").status_code, 403)
        ok = client_for(self.w.admin).post(f"/api/v1/attendance-corrections/{cid}/review/", {"approve": True}, format="json")
        self.assertEqual(ok.status_code, 200)
        record.refresh_from_db()
        self.assertEqual(record.status, "excused")

    def test_future_dates_rejected(self):
        res = client_for(self.w.teacher_a).post(
            "/api/v1/attendance/",
            {"section": self.w.sec_a.pk, "date": "2999-01-01", "records": [{"student": self.w.older.pk, "status": "present"}]},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
