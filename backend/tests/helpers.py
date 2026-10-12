from datetime import date, timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from apps.academics.models import Enrollment, GradeLevel, Section, Subject, TeacherAssignment
from apps.accounts.models import Role, User
from apps.billing.models import Discount, FeeCategory, FeeStructure
from apps.schools.models import AcademicYear, School
from apps.students.models import Guardian, GuardianStudent, Student


def make_user(school, role, email, **kw):
    return User.objects.create_user(email, "Str0ng-pass-123", role=role, school=school, **kw)


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class World:
    """A small school: 2 sections, 2 teachers, siblings with one parent, a stranger's child, fees."""

    def __init__(self, code="TST"):
        self.school = School.objects.create(name=f"School {code}", code=code, late_fee_percent=5)
        today = timezone.localdate()
        self.year = AcademicYear.objects.create(school=self.school, name="Y1", start_date=today - timedelta(days=100), end_date=today + timedelta(days=200), is_current=True)
        self.grade = GradeLevel.objects.create(school=self.school, name="Grade 1", order=1)
        self.admin = make_user(self.school, Role.SCHOOL_ADMIN, f"admin@{code}.test")
        self.accountant = make_user(self.school, Role.ACCOUNTANT, f"acc@{code}.test")
        self.registrar = make_user(self.school, Role.REGISTRAR, f"reg@{code}.test")
        self.teacher_a = make_user(self.school, Role.TEACHER, f"ta@{code}.test")
        self.teacher_b = make_user(self.school, Role.TEACHER, f"tb@{code}.test")
        self.parent = make_user(self.school, Role.PARENT, f"p@{code}.test", phone="+251900000000")
        self.stranger = make_user(self.school, Role.PARENT, f"s@{code}.test")
        self.sec_a = Section.objects.create(grade_level=self.grade, academic_year=self.year, name="A", homeroom_teacher=self.teacher_a)
        self.sec_b = Section.objects.create(grade_level=self.grade, academic_year=self.year, name="B", homeroom_teacher=self.teacher_b)
        self.math = Subject.objects.create(school=self.school, name="Math", code="M")
        TeacherAssignment.objects.create(teacher=self.teacher_a, section=self.sec_a, subject=self.math)
        self.older = self.student("Old", date(2014, 1, 1), self.sec_a)
        self.younger = self.student("Young", date(2016, 1, 1), self.sec_a)
        self.other = self.student("Other", date(2015, 5, 5), self.sec_b)
        g = Guardian.objects.create(school=self.school, user=self.parent, first_name="P", last_name="Parent")
        for kid in (self.older, self.younger):
            GuardianStudent.objects.create(guardian=g, student=kid)
        g2 = Guardian.objects.create(school=self.school, user=self.stranger, first_name="S", last_name="Stranger")
        GuardianStudent.objects.create(guardian=g2, student=self.other)
        cat = FeeCategory.objects.create(school=self.school, name="Tuition", code="TUI")
        FeeStructure.objects.create(academic_year=self.year, grade_level=self.grade, category=cat, amount=1000)
        Discount.objects.create(school=self.school, name="Sibling", kind="percent", value=10, auto_rule="sibling")

    def student(self, first, dob, section):
        s = Student.objects.create(school=self.school, first_name=first, last_name="Kid", date_of_birth=dob, gender="M")
        Enrollment.objects.create(student=s, section=section)
        return s
