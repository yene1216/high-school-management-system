from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DeliveryLogViewSet, NotificationViewSet, PreferencesView

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")
router.register("notification-deliveries", DeliveryLogViewSet, basename="notification-delivery")
urlpatterns = [path("notification-preferences/", PreferencesView.as_view(), name="notification-preferences")] + router.urls
