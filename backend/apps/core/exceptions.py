import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """DRF's handler plus two conversions so ordinary conflicts don't surface as HTTP 500.

    Anything else still propagates as a 500, which Django logs (and Sentry captures when configured).
    """
    response = exception_handler(exc, context)
    if response is not None:
        return response
    if isinstance(exc, IntegrityError):
        logger.warning("Integrity error in %s: %s", context.get("view").__class__.__name__, exc)
        return Response(
            {"detail": "This change conflicts with existing data (for example, a duplicate name or code)."},
            status=status.HTTP_409_CONFLICT,
        )
    if isinstance(exc, DjangoValidationError):
        return Response({"detail": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
    return None
