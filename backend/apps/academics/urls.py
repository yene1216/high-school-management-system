from rest_framework.routers import DefaultRouter

from .views import EnrollmentViewSet, GradeLevelViewSet, SectionViewSet, SubjectViewSet, TeacherAssignmentViewSet

router = DefaultRouter()
router.register("grade-levels", GradeLevelViewSet, basename="grade-level")
router.register("subjects", SubjectViewSet, basename="subject")
router.register("sections", SectionViewSet, basename="section")
router.register("teacher-assignments", TeacherAssignmentViewSet, basename="teacher-assignment")
router.register("enrollments", EnrollmentViewSet, basename="enrollment")
urlpatterns = router.urls
