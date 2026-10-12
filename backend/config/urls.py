from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.health import healthz, readyz

api_v1 = [
    path("auth/", include("apps.accounts.urls_auth")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.schools.urls")),
    path("", include("apps.students.urls")),
    path("", include("apps.academics.urls")),
    path("", include("apps.attendance.urls")),
    path("", include("apps.assessments.urls")),
    path("", include("apps.billing.urls")),
    path("", include("apps.payments.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.communications.urls")),
    path("", include("apps.audit.urls")),
    path("", include("apps.reports.urls")),
]

urlpatterns = [
    path("healthz", healthz),
    path("readyz", readyz),
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/v1/", include(api_v1)),
]
if settings.ENABLE_API_DOCS:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    ]
