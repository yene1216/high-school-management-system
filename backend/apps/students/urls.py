from rest_framework.routers import DefaultRouter

from .views import GuardianViewSet, StudentDocumentViewSet, StudentViewSet

router = DefaultRouter()
router.register("students", StudentViewSet, basename="student")
router.register("guardians", GuardianViewSet, basename="guardian")
router.register("student-documents", StudentDocumentViewSet, basename="student-document")
urlpatterns = router.urls
