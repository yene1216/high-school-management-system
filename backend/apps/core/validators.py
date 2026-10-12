import os

from django.conf import settings
from django.core.exceptions import ValidationError

DOCUMENT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"]
_SIGNATURES = {
    ".pdf": (b"%PDF",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
}


def validate_upload_size(f):
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    if f.size > limit:
        raise ValidationError(f"The file is larger than {settings.MAX_UPLOAD_MB} MB.")


def validate_document(f):
    """Extension must be allowed and the first bytes must match it (blocks renamed executables and scripts)."""
    signatures = _SIGNATURES.get(os.path.splitext(f.name)[1].lower())
    if not signatures:
        raise ValidationError("Upload a PDF, JPG or PNG file.")
    head = f.read(8)
    f.seek(0)
    if not any(head.startswith(s) for s in signatures):
        raise ValidationError("The file content does not match its extension.")
