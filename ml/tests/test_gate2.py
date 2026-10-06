"""
Gate 2 Tests for EXP-001 (Dataset + Model Wrapper)
"""

import os
import yaml
import pytest
import torch
from pathlib import Path
from PIL import Image

from deepverify_ml.data.dataset import DeepVerifyManifestDataset, build_dataloader_from_config
from deepverify_ml.models.efficientnet import DeepVerifyEfficientNet, build_model_from_config

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = REPO_ROOT / "experiments" / "configs" / "EXP-001.yaml"
MANIFEST_PATH = REPO_ROOT / "data" / "splits" / "140k-split-v1.0.csv"


@pytest.fixture(scope="module")
def exp_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

# -----------------------------------------------------------------------------
# Dataset Tests
# -----------------------------------------------------------------------------

def test_dataset_construction_and_labels(exp_config):
    if not MANIFEST_PATH.exists():
        pytest.skip("Manifest not found")
        
    dataset = DeepVerifyManifestDataset(exp_config, split="val")
    assert len(dataset) == 21000, f"Expected 21000 val samples, got {len(dataset)}"
    
    # Check labels mapping
    assert dataset.LABEL_MAP == {"fake": 0, "real": 1}

def test_dataset_item_contract(exp_config):
    if not MANIFEST_PATH.exists():
        pytest.skip("Manifest not found")
        
    # We test on the val split so it is deterministic
    dataset = DeepVerifyManifestDataset(exp_config, split="val")
    tensor, label = dataset[0]
    
    # C. Image loading / D. Tensor contract
    assert isinstance(tensor, torch.Tensor)
    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype == torch.float32
    
    assert isinstance(label, torch.Tensor)
    assert label.dtype == torch.long
    assert int(label.item()) in [0, 1]
    
    # E. Validation determinism
    tensor2, label2 = dataset[0]
    assert torch.equal(tensor, tensor2), "Validation output should be deterministic"
    assert label == label2
def test_invalid_sha256_rejection(exp_config):
    if not MANIFEST_PATH.exists():
        pytest.skip("Manifest not found")
        
    # Copy config and mutate the expected SHA
    bad_config = dict(exp_config)
    bad_config["dataset"] = dict(exp_config["dataset"])
    bad_config["dataset"]["split_manifest_sha256"] = "invalid_sha_123"
    
    with pytest.raises(ValueError, match="Manifest SHA-256 mismatch"):
        DeepVerifyManifestDataset(bad_config, split="val")

def test_training_augmentation_isolation(exp_config):
    if not MANIFEST_PATH.exists():
        pytest.skip("Manifest not found")
        
    train_dataset = DeepVerifyManifestDataset(exp_config, split="train")
    assert train_dataset.is_training is True, "Train split MUST enable training augmentations"
    
    val_dataset = DeepVerifyManifestDataset(exp_config, split="val")
    assert val_dataset.is_training is False, "Val split MUST strictly disable training augmentations"
    
    test_dataset = DeepVerifyManifestDataset(exp_config, split="test")
    assert test_dataset.is_training is False, "Test split MUST strictly disable training augmentations"

def test_dataloader_factory(exp_config):
    if not MANIFEST_PATH.exists():
        pytest.skip("Manifest not found")
        
    from torch.utils.data import SequentialSampler, RandomSampler
    dataloader = build_dataloader_from_config(exp_config, split="val")
    assert dataloader.batch_size == exp_config["training"]["batch_size"]
    assert isinstance(dataloader.sampler, SequentialSampler)

    train_dataloader = build_dataloader_from_config(exp_config, split="train")
    assert isinstance(train_dataloader.sampler, RandomSampler)

# -----------------------------------------------------------------------------
# Model Tests
# -----------------------------------------------------------------------------

def test_model_construction_from_config(exp_config):
    model = build_model_from_config(exp_config)
    assert isinstance(model, DeepVerifyEfficientNet)
    assert isinstance(model.model.classifier, torch.nn.Sequential)
    assert len(model.model.classifier) == 2
    assert isinstance(model.model.classifier[0], torch.nn.Dropout)
    assert model.model.classifier[0].p == 0.2
    assert isinstance(model.model.classifier[1], torch.nn.Linear)
    assert model.model.classifier[1].out_features == 2

def test_model_forward_pass(exp_config):
    model = build_model_from_config(exp_config)
    model.eval()
    
    # H. Model forward pass
    batch_size = 2
    dummy_input = torch.randn(batch_size, 3, 224, 224)
    
    with torch.no_grad():
        output = model(dummy_input)
        
    assert isinstance(output, torch.Tensor)
    assert output.shape == (batch_size, 2)
    assert output.dtype == torch.float32
    
    # Verify no softmax was applied
    # Softmax outputs are strictly positive and sum to 1. Logits are not.
    # It is highly improbable for random logits to sum to exactly 1.0.
    sums = output.sum(dim=-1)
    assert not torch.allclose(sums, torch.ones_like(sums)), "Output appears to be probabilities, expected logits"
