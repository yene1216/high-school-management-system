from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PaymentViewSet, RefundViewSet, provider_webhook

router = DefaultRouter()
router.register("payments", PaymentViewSet, basename="payment")
router.register("refunds", RefundViewSet, basename="refund")
urlpatterns = [path("payments/webhook/<str:provider>/", provider_webhook, name="payment-webhook")] + router.urls
