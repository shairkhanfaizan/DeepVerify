import pytest
import yaml
import json
import re
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
import ml.scripts.run_exp002_training as run_exp002

@pytest.fixture
def dummy_manifest(tmp_path):
    manifest_path = tmp_path / "dummy.csv"
    manifest_path.write_text("filepath,split,label\nimg1.jpg,train,FAKE\nimg2.jpg,val,REAL\n")
    return manifest_path

@pytest.fixture
def valid_config(dummy_manifest, tmp_path):
    cfg = {
        "experiment": {
            "id": "EXP-002-frequency-baseline",
            "seed": 42
        },
        "dataset": {
            "name": "fake",
            "version": "1.0",
            "split_manifest": str(dummy_manifest.name),
            "split_manifest_sha256": "f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466"
        },
        "preprocessing": {
            "domain": "frequency"
        },
        "model": {
            "architecture": "efficientnet-b0",
            "pretrained_weights": "dummy"
        },
        "training": {
            "epochs": 1,
            "optimizer": "AdamW",
            "learning_rate": 0.001,
            "weight_decay": 0.0001,
            "scheduler": "CosineAnnealingLR",
            "loss": "CrossEntropyLoss"
        }
    }
    cfg_file = tmp_path / "EXP-002.yaml"
    with open(cfg_file, "w") as f:
        yaml.dump(cfg, f)
    return cfg_file

def test_rejects_incorrect_experiment_id(tmp_path):
    cfg = {"experiment": {"id": "EXP-001-spatial-baseline"}}
    cfg_file = tmp_path / "invalid.yaml"
    with open(cfg_file, "w") as f:
        yaml.dump(cfg, f)

    with pytest.raises(ValueError, match="Invalid experiment ID: EXP-001-spatial-baseline"):
        run_exp002.run_training(str(cfg_file))

@patch("ml.scripts.run_exp002_training.hashlib.sha256")
@patch("ml.scripts.run_exp002_training.DeepVerifyTrainer")
@patch("ml.scripts.run_exp002_training.build_model_from_config")
@patch("ml.scripts.run_exp002_training.build_dataloader_from_config")
@patch("ml.scripts.run_exp002_training.build_optimizer")
@patch("ml.scripts.run_exp002_training.build_scheduler")
@patch("ml.scripts.run_exp002_training.build_loss")
def test_valid_execution_orchestration(mock_build_loss, mock_build_scheduler, mock_build_opt, mock_build_dl, mock_build_model, mock_trainer, mock_sha, valid_config, tmp_path, monkeypatch):
    monkeypatch.setattr(run_exp002, "REPO_ROOT", tmp_path)

    # We must mock hashlib sha256 to avoid issues if runner checks it strictly against the real file
    mock_sha_obj = MagicMock()
    mock_sha_obj.hexdigest.return_value = "f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466"
    mock_sha.return_value = mock_sha_obj

    # Supress print to keep tests clean
    monkeypatch.setattr("builtins.print", lambda *a, **k: None)

    # Run in smoke test mode
    run_exp002.run_training(str(valid_config), smoke_test=True)

    # Verify mock trainer was created
    mock_trainer.assert_called_once()

    # Output directory verification
    exp_dir = tmp_path / "experiments" / "runs" / "EXP-002"
    assert exp_dir.exists(), "EXP-002 run directory not created"

    exp001_dir = tmp_path / "experiments" / "runs" / "EXP-001"
    assert not exp001_dir.exists(), "Should not create EXP-001 directory"

    run_folders = list(exp_dir.glob("run_*"))
    assert len(run_folders) == 1

    run_folder = run_folders[0]
    run_id = run_folder.name

    # Verify Run ID convention (run_YYYYMMDD_HHMMSS_8chars)
    assert re.match(r"^run_\d{8}_\d{6}_[a-f0-9]{8}$", run_id)

    # Verify config snapshot
    assert (run_folder / "config.yaml").exists()

    # Verify metadata
    metadata_file = run_folder / "run_metadata.json"
    assert metadata_file.exists()

    with open(metadata_file, "r") as f:
        metadata = json.load(f)

    assert metadata["experiment_id"] == "EXP-002-frequency-baseline"
    assert metadata["run_id"] == run_id

    # Verify Config propagation
    # We can inspect the arguments passed to DeepVerifyTrainer
    args, kwargs = mock_trainer.call_args_list[0]
    passed_config = args[0]
    assert passed_config["preprocessing"]["domain"] == "frequency"

@patch("ml.scripts.run_exp002_training.subprocess.run")
@patch("ml.scripts.run_exp002_training.get_git_commit")
@patch("ml.scripts.run_exp002_training.hashlib.sha256")
@patch("ml.scripts.run_exp002_training.DeepVerifyTrainer")
@patch("ml.scripts.run_exp002_training.build_model_from_config")
@patch("ml.scripts.run_exp002_training.build_dataloader_from_config")
@patch("ml.scripts.run_exp002_training.build_optimizer")
@patch("ml.scripts.run_exp002_training.build_scheduler")
@patch("ml.scripts.run_exp002_training.build_loss")
def test_backup_delegation(mock_loss, mock_sched, mock_opt, mock_dl, mock_model, mock_trainer, mock_sha, mock_git, mock_subprocess, valid_config, tmp_path, monkeypatch):
    monkeypatch.setattr(run_exp002, "REPO_ROOT", tmp_path)
    mock_sha_obj = MagicMock()
    mock_sha_obj.hexdigest.return_value = "f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466"
    mock_sha.return_value = mock_sha_obj
    mock_git.return_value = "dummy_commit"
    monkeypatch.setattr("builtins.print", lambda *a, **k: None)
    
    backup_target = "/content/drive/MyDrive/DeepVerify/experiments"
    run_exp002.run_training(str(valid_config), smoke_test=True, backup_dir=backup_target)
    
    mock_subprocess.assert_called_once()
    call_args = mock_subprocess.call_args[0][0]
    
    assert str(tmp_path / "ml/scripts/backup_experiment_artifacts.py") in call_args
    assert "--experiment" in call_args
    assert "EXP-002-frequency-baseline" in call_args
    assert "--destination" in call_args
    assert backup_target in call_args
