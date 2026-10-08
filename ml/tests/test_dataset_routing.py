import pytest
import torch
import numpy as np
from pathlib import Path
from PIL import Image
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from deepverify_ml.data.dataset import DeepVerifyManifestDataset

@pytest.fixture
def dummy_manifest_and_image(tmp_path):
    # Create a dummy image
    img_path = tmp_path / "img1.jpg"
    img = Image.new("RGB", (300, 300), color=(128, 128, 128))
    img.save(img_path)

    # Create a dummy manifest
    manifest_path = tmp_path / "dummy.csv"
    manifest_path.write_text("filepath,split,label\nimg1.jpg,train,FAKE\nimg1.jpg,val,REAL\n")

    return manifest_path, img_path

@pytest.fixture
def config(dummy_manifest_and_image):
    manifest_path, _ = dummy_manifest_and_image
    import hashlib
    sha256 = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    return {
        "dataset": {
            "split_manifest": str(manifest_path.name),
            "split_manifest_sha256": sha256
        },
        "preprocessing": {
            # Omitted domain means spatial by default
        }
    }

def test_spatial_routing_default(config, tmp_path):
    ds = DeepVerifyManifestDataset(config, "val", repo_root=tmp_path)
    tensor, label = ds[0]

    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype == torch.float32

    # 128/255.0 = 0.50196
    # (0.50196 - 0.485) / 0.229 = ~0.074
    # Ensure ImageNet normalization is applied and we are not in [0, 1] range strictly for the uniform image
    # We just check the mean of the tensor
    assert torch.isfinite(tensor).all()
    # If the normalization was NOT applied, the mean would be exactly ~0.5.
    # With ImageNet normalization, mean is roughly ~0.015 for 128 grey.
    assert torch.abs(tensor.mean()) < 0.4

def test_spatial_routing_explicit(config, tmp_path):
    config["preprocessing"]["domain"] = "spatial"
    ds = DeepVerifyManifestDataset(config, "val", repo_root=tmp_path)
    tensor, label = ds[0]
    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype == torch.float32

def test_frequency_routing(config, tmp_path, monkeypatch):
    config["preprocessing"]["domain"] = "frequency"

    called_fft = False
    received_tensor_for_fft = None

    def mock_fft(tensor):
        nonlocal called_fft, received_tensor_for_fft
        called_fft = True
        received_tensor_for_fft = tensor.clone()
        # Return a dummy frequency tensor
        return torch.ones((3, 224, 224), dtype=torch.float32) * 0.5

    import deepverify_ml.preprocessing.frequency
    monkeypatch.setattr(deepverify_ml.preprocessing.frequency, "log_magnitude_fft", mock_fft)

    ds = DeepVerifyManifestDataset(config, "val", repo_root=tmp_path)
    tensor, label = ds[0]

    # Verify the route was hit
    assert called_fft
    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype == torch.float32

    # The output from the mock is entirely 0.5
    assert (tensor == 0.5).all()

    # Verify the input to the FFT was NOT ImageNet normalized
    # A grey image (128) un-normalized float should be ~0.5
    # If normalized, it would be close to 0.0
    assert torch.abs(received_tensor_for_fft.mean() - 0.5019) < 0.05
    assert received_tensor_for_fft.min() >= 0.0
    assert received_tensor_for_fft.max() <= 1.0

def test_frequency_integration(config, tmp_path):
    config["preprocessing"]["domain"] = "frequency"

    ds = DeepVerifyManifestDataset(config, "val", repo_root=tmp_path)
    tensor, label = ds[0]

    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype == torch.float32
    assert torch.isfinite(tensor).all()
    # log_magnitude_fft returns min-max normalized per-image [0, 1]
    assert tensor.min() >= 0.0
    assert tensor.max() <= 1.0

def test_invalid_domain_fails(config, tmp_path):
    config["preprocessing"]["domain"] = "invalid_domain_name"
    ds = DeepVerifyManifestDataset(config, "val", repo_root=tmp_path)

    with pytest.raises(ValueError, match="Unknown preprocessing domain"):
        _ = ds[0]

def test_train_val_behavior_preserved(config, tmp_path, monkeypatch):
    # Verify is_training propagates to pipeline
    called_training = None

    import deepverify_ml.data.dataset
    original_preprocess = deepverify_ml.data.dataset.preprocess_image

    def mock_preprocess(image_input, is_training, **kwargs):
        nonlocal called_training
        called_training = is_training
        return original_preprocess(image_input, is_training=is_training, **kwargs)

    monkeypatch.setattr(deepverify_ml.data.dataset, "preprocess_image", mock_preprocess)

    ds_train = DeepVerifyManifestDataset(config, "train", repo_root=tmp_path)
    _ = ds_train[0]
    assert called_training is True

    ds_val = DeepVerifyManifestDataset(config, "val", repo_root=tmp_path)
    _ = ds_val[0] # idx 0 because ds_val only contains val split rows
    assert called_training is False
