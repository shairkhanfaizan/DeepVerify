import os
import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import yaml
import torch
import numpy as np

# We assume evaluate_exp001 has been written and is importable
from evaluate_exp001 import evaluate, compute_sha256

def setup_mock_run_dir(tmp_path):
    repo_root = tmp_path / "repo"
    run_dir = repo_root / "experiments" / "runs" / "EXP-001" / "run_test"
    run_dir.mkdir(parents=True, exist_ok=True)
    
    # Fake config
    config = {
        "experiment": {"id": "EXP-001-spatial-baseline", "seed": 42},
        "dataset": {
            "name": "140k",
            "split_manifest": "data/splits/manifest.csv",
            "labels": ["FAKE", "REAL"]
        },
        "model": {"architecture": "efficientnet-b0"},
        "runtime": {"device_policy": "cpu"}
    }
    with open(run_dir / "config.yaml", "w") as f:
        yaml.dump(config, f)
        
    # Fake manifest
    manifest_path = repo_root / "data/splits/manifest.csv"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text("file,split\n1.jpg,test\n")
    
    config["dataset"]["split_manifest_sha256"] = compute_sha256(manifest_path)
    with open(run_dir / "config.yaml", "w") as f:
        yaml.dump(config, f)
        
    # Fake checkpoint
    ckpt_path = run_dir / "model_best.pth"
    torch.save({"model_state_dict": {}}, ckpt_path)
    
    return repo_root, run_dir, config

def mock_dataloader():
    """Yields 2 batches of fake data"""
    # Batch 1
    yield torch.zeros((4, 3, 224, 224)), torch.tensor([0, 1, 0, 1])
    # Batch 2
    yield torch.zeros((4, 3, 224, 224)), torch.tensor([0, 0, 1, 1])

@patch("evaluate_exp001.REPO_ROOT", new_callable=lambda: None)
@patch("evaluate_exp001.build_dataloader_from_config")
@patch("evaluate_exp001.build_model_from_config")
def test_evaluation_success(mock_build_model, mock_build_dl, mock_repo_root, tmp_path):
    repo_root, run_dir, config = setup_mock_run_dir(tmp_path)
    mock_repo_root.__class__ = Path
    
    with patch("evaluate_exp001.REPO_ROOT", repo_root):
        # Mock model to return deterministic logits
        mock_model = MagicMock()
        # Logits [FAKE, REAL]
        # Batch 1 targets: [0, 1, 0, 1]
        # Predictions: [0, 1, 1, 0] (2 correct, 2 incorrect)
        logits1 = torch.tensor([[1.0, -1.0], [-1.0, 1.0], [-1.0, 1.0], [1.0, -1.0]])
        # Batch 2 targets: [0, 0, 1, 1]
        # Predictions: [0, 0, 1, 1] (all correct)
        logits2 = torch.tensor([[1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [-1.0, 1.0]])
        mock_model.side_effect = [logits1, logits2]
        mock_build_model.return_value = mock_model
        
        # Mock dataloader
        dl_mock = MagicMock()
        dl_mock.__iter__.return_value = mock_dataloader()
        dl_mock.dataset = [1]*8 # 8 samples
        mock_build_dl.return_value = dl_mock
        
        evaluate(run_dir, smoke_test=False)
        
        # Verify dataloader was called ONLY with split="test"
        mock_build_dl.assert_called_once_with(config, split="test", repo_root=repo_root)
        
        # Artifacts should exist
        eval_dir = run_dir / "evaluation"
        assert eval_dir.exists()
        assert (eval_dir / "test_metrics.json").exists()
        assert (eval_dir / "confusion_matrix.json").exists()
        assert (eval_dir / "evaluation_metadata.json").exists()
        
        # Verify metrics (6/8 correct = 0.75 accuracy)
        with open(eval_dir / "test_metrics.json") as f:
            metrics = json.load(f)
            assert metrics["Accuracy"] == 0.75

@patch("evaluate_exp001.REPO_ROOT", new_callable=lambda: None)
def test_checkpoint_integrity_mismatch(mock_repo_root, tmp_path):
    repo_root, run_dir, config = setup_mock_run_dir(tmp_path)
    with patch("evaluate_exp001.REPO_ROOT", repo_root):
        with pytest.raises(ValueError, match="Checkpoint SHA-256 mismatch!"):
            evaluate(run_dir, expected_ckpt_sha256="wrong_hash")

@patch("evaluate_exp001.REPO_ROOT", new_callable=lambda: None)
def test_missing_files(mock_repo_root, tmp_path):
    repo_root, run_dir, config = setup_mock_run_dir(tmp_path)
    with patch("evaluate_exp001.REPO_ROOT", repo_root):
        (run_dir / "model_best.pth").unlink()
        with pytest.raises(FileNotFoundError, match="Checkpoint not found"):
            evaluate(run_dir)
