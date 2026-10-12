"""Create a demo school with users for every role, students, fees, attendance and grades.

    python manage.py seed_demo    # password from DEMO_PASSWORD, or a random one printed at the end

To rebuild from scratch, reset the dev database (docker compose down -v) and run migrate + seed_demo again.
"""
import os
import secrets
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.academics.models import Enrollment, GradeLevel, Section, Subject, TeacherAssignment
from apps.accounts.models import Role, User
from apps.assessments import services as assess
from apps.assessments.models import Assessment
from apps.attendance.models import AttendanceRecord
from apps.billing import services as billing
from apps.billing.models import Discount, FeeCategory, FeeStructure
from apps.schools.models import AcademicYear, School, Term
from apps.students.models import EmergencyContact, Guardian, GuardianStudent, Student

DOMAIN = "demo.school"
STUDENTS = [
    ("Abel", "Tesfaye", "2015-03-14", "M"), ("Selam", "Tesfaye", "2017-08-02", "F"), ("Meron", "Alemu", "2015-11-21", "F"),
    ("Dawit", "Haile", "2016-01-30", "M"), ("Hana", "Mulugeta", "2015-06-09", "F"), ("Yonas", "Girma", "2016-09-17", "M"),
    ("Liya", "Tadesse", "2015-12-25", "F"), ("Nahom", "Kebede", "2016-04-05", "M"),
]


class Command(BaseCommand):
    help = "Seed a demo school (safe to run more than once)."

    @transaction.atomic
    def handle(self, *args, **opts):
        password = os.environ.get("DEMO_PASSWORD") or secrets.token_urlsafe(12)
        if School.objects.filter(code="ADA").exists():
            self.stdout.write("Demo school already exists; nothing to do.")
            return

        school = School.objects.create(name="Addis Demo Academy", code="ADA", currency="ETB", late_fee_percent=Decimal("2.5"))
        today = timezone.localdate()
        year = AcademicYear.objects.create(school=school, name="2026/27", start_date=today.replace(month=9, day=1) if today.month >= 9 else today.replace(year=today.year - 1, month=9, day=1),
                                           end_date=today.replace(year=today.year + 1, month=6, day=30) if today.month >= 9 else today.replace(month=6, day=30), is_current=True)
        term = Term.objects.create(academic_year=year, name="Term 1", order=1, start_date=year.start_date, end_date=year.start_date + timedelta(days=120))

        def user(local, role, first, last, phone=""):
            return User.objects.create_user(f"{local}@{DOMAIN}", password, role=role, school=school, first_name=first, last_name=last, phone=phone)

        admin = user("admin", Role.SCHOOL_ADMIN, "Almaz", "Bekele")
        user("registrar", Role.REGISTRAR, "Rahel", "Desta")
        user("principal", Role.PRINCIPAL, "Solomon", "Wondimu")
        user("accountant", Role.ACCOUNTANT, "Betelhem", "Assefa")
        t1 = user("teacher1", Role.TEACHER, "Tigist", "Ayele")
        t2 = user("teacher2", Role.TEACHER, "Kaleb", "Negash")
        p1 = user("parent1", Role.PARENT, "Tesfaye", "Bekele", phone="+251911000001")
        p2 = user("parent2", Role.PARENT, "Marta", "Alemu", phone="+251911000002")
        user("counselor", Role.COUNSELOR, "Eden", "Worku")

        grade = GradeLevel.objects.create(school=school, name="Grade 3", order=3)
        sec_a = Section.objects.create(grade_level=grade, academic_year=year, name="A", homeroom_teacher=t1, room="101")
        sec_b = Section.objects.create(grade_level=grade, academic_year=year, name="B", homeroom_teacher=t2, room="102")
        math = Subject.objects.create(school=school, name="Mathematics", code="MATH")
        eng = Subject.objects.create(school=school, name="English", code="ENG")
        TeacherAssignment.objects.create(teacher=t1, section=sec_a, subject=math)
        TeacherAssignment.objects.create(teacher=t2, section=sec_b, subject=eng)

        students = []
        for i, (first, last, dob, gender) in enumerate(STUDENTS):
            s = Student.objects.create(school=school, first_name=first, last_name=last, date_of_birth=dob, gender=gender)
            Enrollment.objects.create(student=s, section=sec_a if i % 2 == 0 else sec_b)
            EmergencyContact.objects.create(student=s, name="Family contact", relationship="Relative", phone="+251911000099")
            students.append(s)

        for guardian_user, kids in ((p1, students[:2]), (p2, students[2:3])):
            g = Guardian.objects.create(school=school, user=guardian_user, first_name=guardian_user.first_name, last_name=guardian_user.last_name, phone=guardian_user.phone, email=guardian_user.email)
            for j, kid in enumerate(kids):
                GuardianStudent.objects.create(guardian=g, student=kid, relationship="father" if guardian_user is p1 else "mother", is_primary=j == 0, can_pickup=True)

        tuition, reg, lib = (FeeCategory.objects.create(school=school, name=n, code=c) for n, c in (("Tuition", "TUI"), ("Registration", "REG"), ("Library", "LIB")))
        for cat, amount in ((tuition, 4500), (reg, 500), (lib, 200)):
            FeeStructure.objects.create(academic_year=year, grade_level=grade, category=cat, amount=amount, frequency="yearly")
        Discount.objects.create(school=school, name="Sibling discount (10%)", kind="percent", value=10, auto_rule="sibling")

        for s in students:
            inv = billing.generate_invoice(student=s, academic_year=year, due_date=today + timedelta(days=14), actor=admin)
            billing.issue_invoice(invoice=inv, actor=admin)

        # Ten school days of attendance, mostly present.
        pattern = ["present", "present", "late", "present", "absent", "present", "present", "excused", "present", "present"]
        day, marked = today, 0
        while marked < 10:
            day -= timedelta(days=1)
            if day.weekday() >= 5:
                continue
            for idx, s in enumerate(students):
                sec = s.enrollments.first().section
                AttendanceRecord.objects.create(student=s, section=sec, date=day, status=pattern[(marked + idx) % len(pattern)], marked_by=sec.homeroom_teacher)
            marked += 1

        quiz = Assessment.objects.create(section=sec_a, subject=math, term=term, name="Quiz 1", kind="quiz", max_score=20, weight=20, date=today - timedelta(days=5), created_by=t1)
        roster = [s for i, s in enumerate(students) if i % 2 == 0]
        assess.enter_grades(actor=t1, assessment=quiz, entries=[{"student": s.pk, "score": Decimal(12 + i * 2), "remarks": ""} for i, s in enumerate(roster)])
        assess.publish(actor=t1, assessment=quiz)

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write(f"Sign in with any of these accounts (password: {password}):")
        for email in ("admin", "registrar", "principal", "accountant", "teacher1", "teacher2", "parent1", "parent2", "counselor"):
            self.stdout.write(f"  {email}@{DOMAIN}")
