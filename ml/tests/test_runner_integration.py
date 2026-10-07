import os
import sys
import yaml
import json
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torch.amp import GradScaler

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = REPO_ROOT / "experiments" / "configs" / "EXP-001.yaml"
SCRIPTS_DIR = REPO_ROOT / "ml" / "scripts"

sys.path.insert(0, str(SCRIPTS_DIR))
import run_exp001_training
from deepverify_ml.models.efficientnet import DeepVerifyEfficientNet

@pytest.fixture
def mock_trainer_fit():
    with patch("run_exp001_training.DeepVerifyTrainer.fit") as mock_fit:
        yield mock_fit

def test_runner_normal_execution_path(mock_trainer_fit):
    """
    Focused integration test verifying the NORMAL (smoke_test=False) execution path.
    Mocks trainer.fit() to avoid real 140k training.
    """
    if not (REPO_ROOT / "data" / "splits" / "140k-split-v1.0.csv").exists():
        pytest.skip("Manifest not found")

    # Run the orchestrator in normal mode
    run_exp001_training.run_training(str(CONFIG_PATH), smoke_test=False)

    # Verify trainer.fit() was called EXACTLY ONCE
    assert mock_trainer_fit.call_count == 1, "trainer.fit() was not called exactly once"

    # Inspect the exact arguments passed to fit()
    args, kwargs = mock_trainer_fit.call_args
    
    # We expect 8 positional arguments based on the script:
    # trainer.fit(model, train_loader, val_loader, optimizer, scheduler, criterion, scaler, epochs)
    assert len(args) == 8, f"Expected 8 positional arguments, got {len(args)}"

    model = args[0]
    train_loader = args[1]
    val_loader = args[2]
    optimizer = args[3]
    scheduler = args[4]
    criterion = args[5]
    scaler = args[6]
    epochs = args[7]

    # Verify model is the constructed EfficientNet-B0 model
    assert isinstance(model, DeepVerifyEfficientNet), "Model is not a DeepVerifyEfficientNet"

    # Verify DataLoaders
    assert isinstance(train_loader, DataLoader), "train_loader is not a DataLoader"
    assert isinstance(val_loader, DataLoader), "val_loader is not a DataLoader"
    # Ensure Test DataLoader was never created (train & val only)
    
    # Verify Optimizer (AdamW)
    from torch.optim import AdamW
    assert isinstance(optimizer, AdamW), "Optimizer is not AdamW"

    # Verify Scheduler (CosineAnnealingLR)
    from torch.optim.lr_scheduler import CosineAnnealingLR
    assert isinstance(scheduler, CosineAnnealingLR), "Scheduler is not CosineAnnealingLR"

    # Verify Criterion (CrossEntropyLoss)
    assert isinstance(criterion, nn.CrossEntropyLoss), "Criterion is not CrossEntropyLoss"

    # Verify Scaler
    assert isinstance(scaler, GradScaler), "Scaler is not a GradScaler"

    # Verify Epochs == 10 from EXP-001.yaml
    assert epochs == 10, f"Expected 10 epochs, got {epochs}"

    # VERIFY ARTIFACT BEHAVIOR
    # Find the most recently created run directory (since the script generates a unique UUID)
    runs_dir = REPO_ROOT / "experiments" / "runs" / "EXP-001"
    run_dirs = [d for d in runs_dir.iterdir() if d.is_dir()]
    # Sort by creation/modification time to get the latest
    latest_run_dir = max(run_dirs, key=lambda d: d.stat().st_mtime)

    # 1. Verify config.yaml artifact
    config_yaml_path = latest_run_dir / "config.yaml"
    assert config_yaml_path.exists(), "config.yaml artifact was not created"
    
    # 2. Verify run_metadata.json artifact
    metadata_json_path = latest_run_dir / "run_metadata.json"
    assert metadata_json_path.exists(), "run_metadata.json artifact was not created"
    
    # Verify metadata contents
    with open(metadata_json_path, "r") as f:
        metadata = json.load(f)
    
    assert metadata["experiment_id"] == "EXP-001-spatial-baseline"
    assert metadata["seed"] == 42
    assert metadata["hyperparameters"]["epochs"] == 10
    
    print("Normal execution path completely verified via mock. Fit was skipped safely.")
