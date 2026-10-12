from datetime import date, timedelta

from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import FINANCE_ROLES, MANAGEMENT_ROLES, has_role
from apps.accounts.models import Role

from . import services


class DashboardSummaryView(APIView):
    def get(self, request):
        return Response(services.dashboard_for(request.user))


class AttendanceReportView(APIView):
    """GET /reports/attendance/?from=YYYY-MM-DD&to=YYYY-MM-DD[&section=id]"""

    def get(self, request):
        if not has_role(request.user, *MANAGEMENT_ROLES, Role.REGISTRAR, Role.TEACHER):
            return Response(status=403)
        try:
            end = date.fromisoformat(request.query_params.get("to", "")) if request.query_params.get("to") else timezone.localdate()
            start = date.fromisoformat(request.query_params.get("from", "")) if request.query_params.get("from") else end - timedelta(days=30)
        except ValueError:
            raise ValidationError("Dates must be YYYY-MM-DD.")
        return Response(services.attendance_counts(request.user, start, end, request.query_params.get("section")))


class FinanceReportView(APIView):
    def get(self, request):
        if not has_role(request.user, *FINANCE_ROLES):
            return Response(status=403)
        return Response({"summary": services.finance_summary(request.user), "aging": services.aging(request.user)})
