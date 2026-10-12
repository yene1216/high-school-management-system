from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse


def healthz(request):
    """Liveness: the process is up."""
    return JsonResponse({"status": "ok"})


def readyz(request):
    """Readiness: the database and cache answer."""
    checks = {}
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:  # noqa: BLE001
        checks["database"] = "error"
    try:
        cache.set("readyz", "1", 5)
        checks["cache"] = "ok" if cache.get("readyz") == "1" else "error"
    except Exception:  # noqa: BLE001
        checks["cache"] = "error"
    healthy = all(v == "ok" for v in checks.values())
    return JsonResponse({"status": "ok" if healthy else "degraded", **checks}, status=200 if healthy else 503)
