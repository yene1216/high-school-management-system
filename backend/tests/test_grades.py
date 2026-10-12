from datetime import date
from decimal import Decimal

from django.test import TestCase

from apps.notifications.models import Notification

from .helpers import World, client_for


class GradeTests(TestCase):
    def setUp(self):
        self.w = World("GRD")
        c = client_for(self.w.teacher_a)
        res = c.post("/api/v1/assessments/", {"section": self.w.sec_a.pk, "subject": self.w.math.pk, "name": "Quiz", "kind": "quiz", "max_score": "20", "weight": "10", "date": date.today().isoformat()}, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.aid = res.json()["id"]

    def enter(self, score="15"):
        return client_for(self.w.teacher_a).put(f"/api/v1/assessments/{self.aid}/grades/", {"records": [{"student": self.w.older.pk, "score": score}]}, format="json")

    def test_unpublished_grades_hidden_from_parent_until_published(self):
        self.assertEqual(self.enter().status_code, 200)
        url = f"/api/v1/students/{self.w.older.pk}/grades/"
        self.assertEqual(client_for(self.w.parent).get(url).json(), [])
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(client_for(self.w.teacher_a).post(f"/api/v1/assessments/{self.aid}/publish/").status_code, 200)
        self.assertEqual(len(client_for(self.w.parent).get(url).json()), 1)
        self.assertTrue(Notification.objects.filter(user=self.w.parent, category="grades").exists())

    def test_score_cannot_exceed_max(self):
        self.assertEqual(self.enter("25").status_code, 400)

    def test_other_teacher_cannot_grade(self):
        res = client_for(self.w.teacher_b).put(f"/api/v1/assessments/{self.aid}/grades/", {"records": []}, format="json")
        self.assertEqual(res.status_code, 404)  # not even visible to them

    def test_report_card_uses_published_grades_only(self):
        self.enter("15")
        rc = client_for(self.w.parent).get(f"/api/v1/report-cards/?student={self.w.older.pk}").json()
        self.assertEqual(rc["subjects"], [])
        client_for(self.w.teacher_a).post(f"/api/v1/assessments/{self.aid}/publish/")
        rc = client_for(self.w.parent).get(f"/api/v1/report-cards/?student={self.w.older.pk}").json()
        self.assertEqual(Decimal(rc["subjects"][0]["percent"]), Decimal("75.00"))
        self.assertEqual(rc["subjects"][0]["letter"], "C")
