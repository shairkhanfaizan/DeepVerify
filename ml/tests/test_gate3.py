"""
Gate 3 Tests for EXP-001 (Training Infrastructure)
"""

import os
import yaml
import json
import pytest
import torch
import torch.nn as nn
from pathlib import Path
from tempfile import TemporaryDirectory

from deepverify_ml.models.efficientnet import build_model_from_config
from deepverify_ml.training.trainer import (
    DeepVerifyTrainer,
    set_seed,
    build_optimizer,
    build_scheduler,
    build_loss,
    get_device
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = REPO_ROOT / "experiments" / "configs" / "EXP-001.yaml"


@pytest.fixture(scope="module")
def exp_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

@pytest.fixture
def dummy_model(exp_config):
    # Use a tiny dummy model for speed in tests instead of full EfficientNet
    class DummyModel(nn.Module):
        def __init__(self):
            super().__init__()
            self.linear = nn.Linear(3 * 224 * 224, 2)
            
        def forward(self, x):
            x = x.view(x.size(0), -1)
            return self.linear(x)
            
    return DummyModel()

def test_deterministic_seeding():
    set_seed(42)
    a = torch.rand(1).item()
    set_seed(42)
    b = torch.rand(1).item()
    assert a == b, "PyTorch RNG was not deterministic"

def test_training_components_construction(exp_config, dummy_model):
    optimizer = build_optimizer(dummy_model, exp_config)
    assert isinstance(optimizer, torch.optim.AdamW)
    assert optimizer.param_groups[0]["lr"] == exp_config["training"]["learning_rate"]
    assert optimizer.param_groups[0]["weight_decay"] == exp_config["training"]["weight_decay"]
    
    scheduler = build_scheduler(optimizer, exp_config)
    assert isinstance(scheduler, torch.optim.lr_scheduler.CosineAnnealingLR)
    assert scheduler.T_max == exp_config["training"]["epochs"]
    
    loss_fn = build_loss(exp_config)
    assert isinstance(loss_fn, torch.nn.CrossEntropyLoss)

def test_device_policy(exp_config):
    # Verify parsing
    device = get_device(exp_config)
    if torch.cuda.is_available():
        assert device.type == "cuda"
    else:
        assert device.type == "cpu"

def test_trainer_artifact_structure(exp_config):
    with TemporaryDirectory() as tmpdir:
        run_dir = Path(tmpdir) / "test_run_01"
        trainer = DeepVerifyTrainer(exp_config, run_dir)
        
        # Verify initial artifacts
        assert run_dir.exists()
        assert (run_dir / "config.yaml").exists()
        assert (run_dir / "training.log").exists()
        
        # Verify log output works
        trainer.log("Test log entry")
        with open(run_dir / "training.log", "r") as f:
            log_content = f.read()
            assert "Test log entry" in log_content
            
        # Verify metrics recording
        trainer.record_metrics(1, 0.5, 0.8, 0.6, 0.7, 0.001)
        assert (run_dir / "metrics.json").exists()
        with open(run_dir / "metrics.json", "r") as f:
            metrics = json.load(f)
            assert len(metrics) == 1
            assert metrics[0]["epoch"] == 1
            assert metrics[0]["train_loss"] == 0.5

def test_checkpoint_save_and_load(exp_config, dummy_model):
    with TemporaryDirectory() as tmpdir:
        run_dir = Path(tmpdir) / "ckpt_test"
        trainer = DeepVerifyTrainer(exp_config, run_dir)
        
        optimizer = build_optimizer(dummy_model, exp_config)
        scheduler = build_scheduler(optimizer, exp_config)
        
        # Modify dummy model weights to test loading
        with torch.no_grad():
            dummy_model.linear.weight.fill_(0.5)
            
        trainer.save_checkpoint(dummy_model, optimizer, scheduler, epoch=5, val_loss=0.3, val_acc=0.9, filename="model_best.pth")
        
        ckpt_path = run_dir / "model_best.pth"
        assert ckpt_path.exists()
        
        # Verify loading compatibility
        checkpoint = torch.load(ckpt_path, map_location="cpu")
        assert checkpoint["epoch"] == 5
        assert checkpoint["val_loss"] == 0.3
        
        new_model = dummy_model.__class__()
        new_model.load_state_dict(checkpoint["model_state_dict"])
        
        # Verify weights were restored
        assert torch.allclose(new_model.linear.weight, torch.tensor(0.5)), "Model weights did not restore correctly"
        
        # Verify optimizer/scheduler state keys exist
        assert "optimizer_state_dict" in checkpoint
        assert "scheduler_state_dict" in checkpoint

def test_best_model_tracking_and_final_checkpoint(exp_config, dummy_model):
    from unittest.mock import MagicMock
    from torch.amp import GradScaler
    
    with TemporaryDirectory() as tmpdir:
        run_dir = Path(tmpdir) / "tracking_test"
        trainer = DeepVerifyTrainer(exp_config, run_dir)
        
        optimizer = build_optimizer(dummy_model, exp_config)
        scheduler = build_scheduler(optimizer, exp_config)
        
        # Mock train and validate to return specific predetermined losses
        # We simulate:
        # Epoch 1: val_loss=0.8
        # Epoch 2: val_loss=0.4 (New best)
        # Epoch 3: val_loss=0.6 (Worse, should not overwrite)
        
        # We need mock side effects for validate_one_epoch
        val_losses = [(0.8, 0.5), (0.4, 0.9), (0.6, 0.7)]
        val_mock = MagicMock(side_effect=val_losses)
        train_mock = MagicMock(return_value=(1.0, 0.1))
        
        trainer.train_one_epoch = train_mock
        trainer.validate_one_epoch = val_mock
        
        # We can pass None for dataloaders/criterion/scaler since the methods are mocked
        scaler = GradScaler("cpu", enabled=False)
        
        # Run training loop for 3 epochs
        trainer.fit(
            model=dummy_model,
            train_loader=None,
            val_loader=None,
            optimizer=optimizer,
            scheduler=scheduler,
            criterion=None,
            scaler=scaler,
            epochs=3
        )
        
        # Verify model_best.pth corresponds to Epoch 2
        best_ckpt_path = run_dir / "model_best.pth"
        assert best_ckpt_path.exists()
        
        best_checkpoint = torch.load(best_ckpt_path, map_location="cpu")
        assert best_checkpoint["epoch"] == 2
        assert best_checkpoint["val_loss"] == 0.4
        
        # Verify model_final.pth corresponds to Epoch 3
        final_ckpt_path = run_dir / "model_final.pth"
        assert final_ckpt_path.exists()
        
        final_checkpoint = torch.load(final_ckpt_path, map_location="cpu")
        assert final_checkpoint["epoch"] == 3
        assert final_checkpoint["val_loss"] == 0.6
