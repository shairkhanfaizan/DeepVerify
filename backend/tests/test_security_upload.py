import pytest
from app.core.security_upload import validate_and_hash_image
import hashlib

def test_validate_valid_image():
    # Valid 1x1 JPEG magic bytes
    jpeg_data = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x03\x02\x02\x02\x02\x02\x03\x02\x02\x02\x03\x03\x03\x03\x04\x06\x04\x04\x04\x04\x04\x08\x06\x06\x05\x06\t\x08\n\n\t\x08\t\t\n\x0c\x0f\x0c\n\x0b\x0e\x0b\t\t\r\x11\r\x0e\x0f\x10\x10\x11\x10\n\x0c\x12\x13\x12\x10\x13\x0f\x10\x10\x10\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x00\xff\xd9"
    file_hash, ext = validate_and_hash_image(jpeg_data)
    assert ext == "jpg"
    assert file_hash == hashlib.sha256(jpeg_data).hexdigest()

def test_validate_invalid_image():
    # Not an image
    text_data = b"Hello world"
    with pytest.raises(ValueError, match="Must be a valid image"):
        validate_and_hash_image(text_data)

def test_validate_svg_rejected():
    xml_data = b"<?xml version=\"1.0\"?><svg></svg>"
    with pytest.raises(ValueError, match="Must be a valid image"):
        validate_and_hash_image(xml_data)

def test_oversized_image():
    from app.core.config import settings
    # Create fake oversized content
    data = b"x" * (settings.MAX_IMAGE_SIZE_BYTES + 1)
    with pytest.raises(ValueError, match="exceeds the maximum allowed size"):
        validate_and_hash_image(data)

def test_corrupt_image():
    # Has JPEG magic bytes, but invalid content so PIL decoding fails
    corrupt_data = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb"
    with pytest.raises(ValueError, match="cannot be decoded or is corrupt"):
        validate_and_hash_image(corrupt_data)
