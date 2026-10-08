from fastapi import UploadFile, HTTPException
from app.core.config import settings
from PIL import Image
import io

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}

class ValidationError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code

async def validate_and_read_image(file: UploadFile) -> bytes:
    # 1. MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise ValidationError("UNSUPPORTED_FORMAT", "Unsupported image format.", 415)

    # 2. Extension
    ext = f".{file.filename.split('.')[-1].lower()}" if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError("UNSUPPORTED_FORMAT", "Unsupported file extension.", 415)

    # 4. File Size
    content = await file.read()
    if len(content) > settings.MAX_IMAGE_SIZE_BYTES:
        raise ValidationError("FILE_TOO_LARGE", "Uploaded file exceeds the maximum allowed size.", 413)

    # 3. Magic Bytes
    if content.startswith(b"\xFF\xD8\xFF"):
        detected_ext = ".jpg"
    elif content.startswith(b"\x89PNG\r\n\x1A\n"):
        detected_ext = ".png"
    else:
        raise ValidationError("INVALID_MAGIC_BYTES", "File signature does not match extension.", 400)

    # 5. Decodability & Resolution
    try:
        img = Image.open(io.BytesIO(content))
        img.load()
        if img.width > settings.MAX_IMAGE_RESOLUTION or img.height > settings.MAX_IMAGE_RESOLUTION:
            raise ValidationError("RESOLUTION_TOO_LARGE", "Image resolution exceeds max allowed.", 422)
    except Exception:
        raise ValidationError("DECOMPRESSION_FAILED", "Image cannot be decoded or is corrupt.", 422)

    return content
