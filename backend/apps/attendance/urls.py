from rest_framework.routers import DefaultRouter

from .views import AttendanceViewSet, CorrectionViewSet

router = DefaultRouter()
router.register("attendance", AttendanceViewSet, basename="attendance")
router.register("attendance-corrections", CorrectionViewSet, basename="attendance-correction")
urlpatterns = router.urls
