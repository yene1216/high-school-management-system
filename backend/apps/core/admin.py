"""Back-office admin for *platform* operators only.

The Django admin is not tenant-scoped: anyone with is_staff can see every school. School staff use the SPA;
keep is_staff / is_superuser for the operating team, and move the admin to a private URL (ADMIN_URL).
"""
from django.apps import apps
from django.contrib import admin

SKIP = {"accounts.User", "audit.AuditLog"}
APP_LABELS = ["schools", "students", "academics", "attendance", "assessments", "billing", "payments", "notifications", "communications"]

for label in APP_LABELS:
    for model in apps.get_app_config(label).get_models():
        if f"{label}.{model.__name__}" in SKIP or admin.site.is_registered(model):
            continue
        admin.site.register(model)
