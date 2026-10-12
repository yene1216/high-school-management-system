from celery import shared_task

from apps.notifications.models import Category
from apps.notifications.services import notify_user
from apps.students.selectors import guardian_users


@shared_task
def notify_grades_published(assessment_id):
    from .models import Assessment

    assessment = Assessment.objects.select_related("subject").get(pk=assessment_id)
    for grade in assessment.grades.filter(score__isnull=False).select_related("student"):
        student = grade.student
        recipients = list(guardian_users(student))
        if student.user_id and student.user.is_active:
            recipients.append(student.user)
        for user in recipients:
            notify_user(
                user=user, category=Category.GRADES, code="grades.published",
                context={"student_name": student.full_name, "subject": assessment.subject.name, "assessment": assessment.name},
                data={"student": student.pk, "assessment": assessment.pk},
            )
