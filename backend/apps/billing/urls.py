from rest_framework.routers import DefaultRouter

from .views import DiscountViewSet, FeeCategoryViewSet, FeeStructureViewSet, InvoiceViewSet, StudentDiscountViewSet

router = DefaultRouter()
router.register("fee-categories", FeeCategoryViewSet, basename="fee-category")
router.register("fee-structures", FeeStructureViewSet, basename="fee-structure")
router.register("discounts", DiscountViewSet, basename="discount")
router.register("student-discounts", StudentDiscountViewSet, basename="student-discount")
router.register("invoices", InvoiceViewSet, basename="invoice")
urlpatterns = router.urls
