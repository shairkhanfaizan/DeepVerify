import hashlib
import io
import filetype
from PIL import Image
from app.core.config import settings

def validate_and_hash_image(content: bytes) -> tuple[str, str]:
    """
    Validates the magic bytes of the content to ensure it is a safe image.
    Returns the SHA-256 hash and the validated extension.
    Raises ValueError if invalid or unsafe.
    """
    if len(content) > settings.MAX_IMAGE_SIZE_BYTES:
        raise ValueError("Uploaded file exceeds the maximum allowed size.")

    kind = filetype.guess(content)
    
    if kind is None or not kind.mime.startswith('image/'):
        raise ValueError("Invalid file type. Must be a valid image (e.g., JPEG, PNG).")
        
    # Disallow vector formats like SVG because they can contain executable scripts (XSS)
    if kind.extension == 'svg' or kind.mime == 'image/svg+xml':
        raise ValueError("SVG images are not allowed due to security risks.")
        
    try:
        img = Image.open(io.BytesIO(content))
        img.load()
        if img.width > settings.MAX_IMAGE_RESOLUTION or img.height > settings.MAX_IMAGE_RESOLUTION:
            raise ValueError("Image resolution exceeds max allowed.")
    except ValueError as e:
        raise e
    except Exception:
        raise ValueError("Image cannot be decoded or is corrupt.")
        
    sha256_hash = hashlib.sha256(content).hexdigest()
    return sha256_hash, kind.extension
