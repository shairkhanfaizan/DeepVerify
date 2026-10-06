"""
DeepVerify — Canonical Preprocessing Pipeline
Part of deepverify_ml.preprocessing.

Implements the canonical, deterministic image preprocessing pipeline defined in
docs/research/data-contract.md and docs/api/inference-contract.md.

Invariants:
- Validation, test, and production inference transformations MUST be strictly deterministic.
- Output tensor dimensions: [3, 224, 224], Float32.
- Normalization: ImageNet mean [0.485, 0.456, 0.406], std [0.229, 0.224, 0.225].
"""

import io
from pathlib import Path
from typing import Tuple, Union, Optional
import numpy as np
from PIL import Image

# Canonical ImageNet normalization constants
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)
TARGET_IMAGE_SIZE = (224, 224)
ALLOWED_FORMATS = {"JPEG", "PNG", "JPG"}


def validate_and_decode(
    image_input: Union[str, Path, bytes, io.BytesIO, Image.Image]
) -> Image.Image:
    """
    Validates, decodes, and standardizes input into an RGB PIL Image.

    Rejects:
    - Non-existent files
    - Corrupt / unreadable streams
    - Unsupported formats

    Guarantees:
    - Returned image is in 3-channel 'RGB' mode.
    """
    if isinstance(image_input, Image.Image):
        img = image_input
    elif isinstance(image_input, (str, Path)):
        path = Path(image_input)
        if not path.is_file():
            raise FileNotFoundError(f"Image file does not exist: {path}")
        try:
            with open(path, "rb") as f:
                img_bytes = f.read()
            img = Image.open(io.BytesIO(img_bytes))
            img.load()  # Force decode to detect truncation / corruption
        except Exception as e:
            raise ValueError(f"Failed to decode image at {path}: {str(e)}") from e
    elif isinstance(image_input, (bytes, io.BytesIO)):
        bio = image_input if isinstance(image_input, io.BytesIO) else io.BytesIO(image_input)
        try:
            img = Image.open(bio)
            img.load()
        except Exception as e:
            raise ValueError(f"Failed to decode image from bytes: {str(e)}") from e
    else:
        raise TypeError(f"Unsupported image input type: {type(image_input)}")

    # Verify recognized format if available
    if img.format and img.format.upper() not in ALLOWED_FORMATS:
        raise ValueError(
            f"Unsupported image format: {img.format}. Allowed: {sorted(ALLOWED_FORMATS)}"
        )

    # Convert to 3-channel RGB (handles RGBA, Grayscale, CMYK safely)
    if img.mode != "RGB":
        img = img.convert("RGB")

    return img


def resize_and_crop(
    image: Image.Image,
    target_size: Tuple[int, int] = TARGET_IMAGE_SIZE
) -> Image.Image:
    """
    Aspect-preserving resize followed by center crop to target dimensions.
    Deterministic, using bilinear interpolation.
    """
    target_w, target_h = target_size
    src_w, src_h = image.size

    if src_w == target_w and src_h == target_h:
        return image

    # Compute scale factor preserving aspect ratio
    scale = max(target_w / src_w, target_h / src_h)
    new_w = int(round(src_w * scale))
    new_h = int(round(src_h * scale))

    # Resize with bilinear interpolation
    resized = image.resize((new_w, new_h), resample=Image.Resampling.BILINEAR)

    # Center crop to exact target_size
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    right = left + target_w
    bottom = top + target_h

    return resized.crop((left, top, right, bottom))


def to_normalized_array(
    image: Image.Image,
    mean: np.ndarray = IMAGENET_MEAN,
    std: np.ndarray = IMAGENET_STD
) -> np.ndarray:
    """
    Converts a PIL RGB Image into a normalized Float32 numpy array with shape [3, H, W].
    Channel values scaled from [0, 255] to [0.0, 1.0], then standard ImageNet normalized.
    """
    # [H, W, 3] uint8
    arr = np.asarray(image, dtype=np.float32)

    # Scale to [0.0, 1.0]
    arr = arr / 255.0

    # Transpose to channel-first [3, H, W]
    arr = np.transpose(arr, (2, 0, 1))

    # Normalize: (x - mean) / std
    arr = (arr - mean) / std

    return arr.astype(np.float32)


def preprocess_image(
    image_input: Union[str, Path, bytes, io.BytesIO, Image.Image],
    target_size: Tuple[int, int] = TARGET_IMAGE_SIZE,
    is_training: bool = False
) -> np.ndarray:
    """
    Canonical end-to-end preprocessing pipeline.

    When is_training=False (default):
    Strictly deterministic transform:
    Decode -> RGB -> Resize/Center-Crop(224, 224) -> ToArray -> Normalize.

    When is_training=True:
    Applies training augmentations (horizontal flip p=0.5, rotation ±10°,
    brightness/contrast jitter ±0.1) before normalization.
    """
    img = validate_and_decode(image_input)

    # Training augmentation boundary: only applied when explicitly in training mode
    if is_training:
        from PIL import ImageEnhance
        
        # Horizontal flip, p=0.5
        if np.random.rand() > 0.5:
            img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            
        # Subtle brightness/contrast jitter, ±0.1
        brightness_factor = 1.0 + np.random.uniform(-0.1, 0.1)
        contrast_factor = 1.0 + np.random.uniform(-0.1, 0.1)
        img = ImageEnhance.Brightness(img).enhance(brightness_factor)
        img = ImageEnhance.Contrast(img).enhance(contrast_factor)
        
        # Slight rotation, ±10 degrees
        angle = np.random.uniform(-10.0, 10.0)
        img = img.rotate(angle, resample=Image.Resampling.BILINEAR, expand=False)

    # Deterministic spatial transform
    img = resize_and_crop(img, target_size=target_size)

    # Deterministic tensor conversion & normalization
    tensor_arr = to_normalized_array(img)

    return tensor_arr
