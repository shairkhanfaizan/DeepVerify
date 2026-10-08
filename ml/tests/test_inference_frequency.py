import pytest
import torch
import numpy as np
from pathlib import Path
from PIL import Image

from deepverify_ml.inference import FrequencyInferenceModel

@pytest.fixture
def dummy_config(tmp_path):
    config_path = tmp_path / "dummy_freq_config.yaml"
    config_path.write_text("""
model:
  architecture: "efficientnet-b0"
  pretrained: false
  num_classes: 2
  dropout: 0.2
""")
    return config_path

@pytest.fixture
def dummy_image(tmp_path):
    img_path = tmp_path / "dummy_image.png"
    # Create a simple deterministic 256x256 RGB image
    arr = np.zeros((256, 256, 3), dtype=np.uint8)
    arr[64:192, 64:192, :] = 128
    Image.fromarray(arr).save(img_path)
    return img_path

@pytest.fixture
def dummy_checkpoint(tmp_path, dummy_config):
    # instantiate a raw model to save a checkpoint
    model = FrequencyInferenceModel(dummy_config)
    ckpt_path = tmp_path / "dummy_ckpt.pth"
    torch.save({"model_state_dict": model.model.state_dict()}, ckpt_path)
    return ckpt_path

def test_frequency_inference_model_construction(dummy_config):
    model = FrequencyInferenceModel(dummy_config)
    assert model.device == "cpu"
    assert model.model is not None

def test_frequency_inference_model_load(dummy_config, dummy_checkpoint):
    model = FrequencyInferenceModel(dummy_config)
    model.load(dummy_checkpoint, device="cpu")
    # Verify model is in eval mode
    assert not model.model.training

def test_frequency_preprocessing(dummy_config, dummy_image):
    model = FrequencyInferenceModel(dummy_config)
    tensor = model.preprocess(str(dummy_image))

    # Check shape: [1, 3, 224, 224] due to batch dimension added
    assert tensor.shape == (1, 3, 224, 224)
    # Check it is floating point
    assert tensor.is_floating_point()
    # Check values are finite
    assert torch.isfinite(tensor).all()
    # Verify deterministic (running twice gives same output)
    tensor2 = model.preprocess(str(dummy_image))
    assert torch.allclose(tensor, tensor2)

def test_frequency_inference(dummy_config, dummy_checkpoint, dummy_image):
    model = FrequencyInferenceModel(dummy_config)
    model.load(dummy_checkpoint, device="cpu")

    tensor = model.preprocess(str(dummy_image))
    result = model.infer(tensor)

    assert result.model_version == "frequency-v1.0"
    assert result.model_type == "frequency"
    assert result.label in ["LIKELY_AUTHENTIC", "LIKELY_AI_GENERATED"]
    assert 0.0 <= result.score <= 1.0
    assert "REAL" in result.probabilities
    assert "FAKE" in result.probabilities
    assert abs((result.probabilities["REAL"] + result.probabilities["FAKE"]) - 1.0) < 1e-6
    # Check P(REAL) convention corresponds to score
    assert result.score == result.probabilities["REAL"]

def test_frequency_explain_returns_none(dummy_config, dummy_image):
    model = FrequencyInferenceModel(dummy_config)
    tensor = model.preprocess(str(dummy_image))
    result = model.explain(tensor)
    assert result is None
