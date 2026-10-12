from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AssessmentViewSet, ReportCardView

router = DefaultRouter()
router.register("assessments", AssessmentViewSet, basename="assessment")
urlpatterns = [path("report-cards/", ReportCardView.as_view(), name="report-card")] + router.urls
