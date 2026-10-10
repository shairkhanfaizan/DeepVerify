import os
import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import yaml
import torch
import numpy as np

from evaluate_exp001 import evaluate, compute_sha256

def setup_mock_exp002_run_dir(tmp_path):
    repo_root = tmp_path / "repo"
    run_id = "run_20261008_080128_559d2631"
    run_dir = repo_root / "experiments" / "runs" / "EXP-002" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    
    # Fake config for EXP-002
    config = {
        "experiment": {"id": "EXP-002-frequency-baseline", "seed": 42},
        "dataset": {
            "name": "140k",
            "split_manifest": "data/splits/manifest.csv",
            "labels": ["FAKE", "REAL"]
        },
        "preprocessing": {
            "domain": "frequency"
        },
        "model": {"architecture": "efficientnet-b0"},
        "runtime": {"device_policy": "cpu"}
    }
    with open(run_dir / "config.yaml", "w") as f:
        yaml.dump(config, f)
        
    # Fake manifest
    manifest_path = repo_root / "data/splits/manifest.csv"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text("file,split\nfake/1.jpg,test\nreal/2.jpg,test\n")
    
    config["dataset"]["split_manifest_sha256"] = compute_sha256(manifest_path)
    with open(run_dir / "config.yaml", "w") as f:
        yaml.dump(config, f)
        
    # Fake checkpoints (both final and best)
    ckpt_path_best = run_dir / "model_best.pth"
    torch.save({"model_state_dict": {}}, ckpt_path_best)
    
    ckpt_path_final = run_dir / "model_final.pth"
    torch.save({"model_state_dict": {}}, ckpt_path_final)
    
    return repo_root, run_dir, config

def mock_dataloader():
    """Yields 1 batch of fake data"""
    yield torch.zeros((2, 3, 224, 224)), torch.tensor([0, 1])

@patch("evaluate_exp001.REPO_ROOT", new_callable=lambda: None)
@patch("evaluate_exp001.build_dataloader_from_config")
@patch("evaluate_exp001.build_model_from_config")
@patch("evaluate_exp001.get_git_commit")
def test_exp002_evaluation_success(mock_git, mock_build_model, mock_build_dl, mock_repo_root, tmp_path):
    repo_root, run_dir, config = setup_mock_exp002_run_dir(tmp_path)
    mock_git.return_value = "dummy_git_sha"
    
    with patch("evaluate_exp001.REPO_ROOT", repo_root):
        mock_model = MagicMock()
        # Logits [FAKE, REAL]
        logits1 = torch.tensor([[1.0, -1.0], [-1.0, 1.0]]) # FAKE, REAL (100% correct)
        mock_model.side_effect = [logits1]
        mock_build_model.return_value = mock_model
        
        dl_mock = MagicMock()
        dl_mock.__iter__.return_value = mock_dataloader()
        dl_mock.dataset = [1]*2 # 2 samples
        mock_build_dl.return_value = dl_mock
        
        # Test evaluating with save_predictions=True
        evaluate(run_dir, smoke_test=False, save_predictions=True)
        
        # VERIFICATIONS:
        
        # 1. Test that the TEST split is selected
        mock_build_dl.assert_called_once_with(config, split="test", repo_root=repo_root)
        
        # 2. Test that frequency preprocessing is used (via config propagation)
        passed_config = mock_build_model.call_args[0][0]
        assert passed_config["preprocessing"]["domain"] == "frequency"
        
        # Artifacts should exist
        eval_dir = run_dir / "evaluation"
        assert eval_dir.exists()
        assert (eval_dir / "test_metrics.json").exists()
        assert (eval_dir / "confusion_matrix.json").exists()
        assert (eval_dir / "evaluation_metadata.json").exists()
        assert (eval_dir / "sample_predictions.npz").exists()
        
        # 3. Test metric/artifact generation & Label Mapping [FAKE, REAL]
        with open(eval_dir / "confusion_matrix.json") as f:
            cm = json.load(f)
            assert cm["labels"] == ["FAKE", "REAL"]
            assert cm["matrix"] == [[1, 0], [0, 1]] # Perfect prediction
            
        with open(eval_dir / "test_metrics.json") as f:
            metrics = json.load(f)
            assert metrics["Accuracy"] == 1.0
            
        # 4. Test metadata contains required provenance fields
        with open(eval_dir / "evaluation_metadata.json") as f:
            meta = json.load(f)
            assert meta["experiment_id"] == "EXP-002-frequency-baseline"
            assert meta["run_id"] == "run_20261008_080128_559d2631"
            assert meta["git_sha"] == "dummy_git_sha"
            assert meta["split_counts"]["FAKE"] == 1
            assert meta["split_counts"]["REAL"] == 1
            # 5. Test that model_best.pth is selected rather than model_final.pth
            assert meta["evaluated_checkpoint"] == "model_best.pth"
            assert "checkpoint_sha256" in meta
