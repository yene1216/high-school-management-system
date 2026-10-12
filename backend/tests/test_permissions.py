from django.test import TestCase

from apps.accounts.models import Role

from .helpers import World, client_for, make_user


class ObjectPermissionTests(TestCase):
    def setUp(self):
        self.w = World("AAA")

    def test_parent_sees_only_linked_children(self):
        res = client_for(self.w.parent).get("/api/v1/students/")
        self.assertEqual(res.status_code, 200)
        ids = {r["id"] for r in res.json()["results"]}
        self.assertEqual(ids, {self.w.older.pk, self.w.younger.pk})

    def test_parent_cannot_open_unlinked_child(self):
        c = client_for(self.w.parent)
        self.assertEqual(c.get(f"/api/v1/students/{self.w.other.pk}/").status_code, 404)
        self.assertEqual(c.get(f"/api/v1/students/{self.w.other.pk}/attendance/").status_code, 404)

    def test_parent_cannot_write_students(self):
        res = client_for(self.w.parent).post("/api/v1/students/", {"first_name": "X"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_teacher_sees_only_own_sections(self):
        ids = {r["id"] for r in client_for(self.w.teacher_a).get("/api/v1/students/").json()["results"]}
        self.assertEqual(ids, {self.w.older.pk, self.w.younger.pk})

    def test_cross_school_isolation(self):
        other = World("BBB")
        res = client_for(other.admin).get(f"/api/v1/students/{self.w.older.pk}/")
        self.assertEqual(res.status_code, 404)
        ids = {r["id"] for r in client_for(other.admin).get("/api/v1/students/").json()["results"]}
        self.assertNotIn(self.w.older.pk, ids)

    def test_cannot_reference_other_schools_rows(self):
        other = World("CCC")
        res = client_for(self.w.admin).post(
            "/api/v1/enrollments/", {"student": other.older.pk, "section": self.w.sec_a.pk}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_support_records_restricted(self):
        url = f"/api/v1/students/{self.w.older.pk}/support-record/"
        self.assertEqual(client_for(self.w.registrar).get(url).status_code, 403)
        counselor = make_user(self.w.school, Role.COUNSELOR, "c@AAA.test")
        self.assertEqual(client_for(counselor).get(url).status_code, 200)

    def test_anonymous_is_rejected(self):
        from rest_framework.test import APIClient

        self.assertEqual(APIClient().get("/api/v1/students/").status_code, 401)
        self.assertEqual(APIClient().get("/api/v1/schools/").status_code, 401)
