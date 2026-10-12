from django.urls import path

from .views import AttendanceReportView, DashboardSummaryView, FinanceReportView

urlpatterns = [
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("reports/attendance/", AttendanceReportView.as_view(), name="report-attendance"),
    path("reports/finance/", FinanceReportView.as_view(), name="report-finance"),
]
