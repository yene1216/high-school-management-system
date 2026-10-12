from rest_framework.routers import DefaultRouter

from .views import AcademicYearViewSet, SchoolViewSet, TermViewSet

router = DefaultRouter()
router.register("schools", SchoolViewSet, basename="school")
router.register("academic-years", AcademicYearViewSet, basename="academic-year")
router.register("terms", TermViewSet, basename="term")
urlpatterns = router.urls
