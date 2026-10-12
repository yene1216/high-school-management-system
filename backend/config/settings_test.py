import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret")
os.environ.setdefault("DJANGO_DEBUG", "1")
os.environ.pop("POSTGRES_DB", None)
os.environ.pop("REDIS_URL", None)

from .settings import *  # noqa: E402,F401,F403

CELERY_TASK_ALWAYS_EAGER = True
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"anon": "10000/min", "user": "10000/min", "login": "10000/min", "login_email": "10000/min"}}  # noqa: F405
PAYMENT_MOCK_WEBHOOK_SECRET = "test-webhook-secret"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}

STORAGES = {**STORAGES, "default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}  # noqa: F405
