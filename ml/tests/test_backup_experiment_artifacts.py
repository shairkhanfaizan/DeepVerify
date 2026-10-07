import os
import json
import pytest
from pathlib import Path
from unittest.mock import patch
from backup_experiment_artifacts import backup_artifacts, REQUIRED_ARTIFACTS

def setup_synthetic_run(repo_root: Path, experiment: str, run_id: str, missing_file: str = None) -> Path:
    """Creates a synthetic run directory with fake artifacts."""
    run_dir = repo_root / "experiments" / "runs" / experiment / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    
    for artifact in REQUIRED_ARTIFACTS:
        if artifact == missing_file:
            continue
        filepath = run_dir / artifact
        filepath.write_text(f"Synthetic data for {artifact}\n")
    return run_dir

def test_backup_success(tmp_path):
    repo_root = tmp_path / "repo"
    dest_base = tmp_path / "dest"
    
    experiment = "EXP-TEST"
    run_id = "run_123"
    
    source_dir = setup_synthetic_run(repo_root, experiment, run_id)
    
    backup_artifacts(repo_root, experiment, run_id, dest_base)
    
    dest_dir = dest_base / experiment / run_id
    assert dest_dir.exists()
    
    manifest_path = dest_dir / "backup_manifest.json"
    assert manifest_path.exists()
    
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
        
    assert manifest["experiment_id"] == experiment
    assert manifest["run_id"] == run_id
    for artifact in REQUIRED_ARTIFACTS:
        assert artifact in manifest["artifacts"]
        assert manifest["artifacts"][artifact]["source_sha256"] == manifest["artifacts"][artifact]["verified_sha256"]
        assert (dest_dir / artifact).exists()

def test_backup_missing_file(tmp_path):
    repo_root = tmp_path / "repo"
    dest_base = tmp_path / "dest"
    
    experiment = "EXP-TEST"
    run_id = "run_123"
    
    # Missing model_best.pth
    setup_synthetic_run(repo_root, experiment, run_id, missing_file="model_best.pth")
    
    with pytest.raises(FileNotFoundError, match="Missing required artifacts"):
        backup_artifacts(repo_root, experiment, run_id, dest_base)

def test_destination_collision_safety(tmp_path):
    repo_root = tmp_path / "repo"
    dest_base = tmp_path / "dest"
    
    experiment = "EXP-TEST"
    run_id = "run_123"
    
    setup_synthetic_run(repo_root, experiment, run_id)
    
    # Create the destination directory first
    dest_dir = dest_base / experiment / run_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    
    with pytest.raises(FileExistsError, match="Destination directory already exists"):
        backup_artifacts(repo_root, experiment, run_id, dest_base, overwrite=False)
        
    # Should pass if overwrite=True
    backup_artifacts(repo_root, experiment, run_id, dest_base, overwrite=True)
    assert (dest_dir / "backup_manifest.json").exists()

def test_hash_mismatch(tmp_path):
    repo_root = tmp_path / "repo"
    dest_base = tmp_path / "dest"
    
    experiment = "EXP-TEST"
    run_id = "run_123"
    
    setup_synthetic_run(repo_root, experiment, run_id)
    
    # Mock compute_sha256 to return a different hash on verification
    original_compute = __import__('backup_experiment_artifacts').compute_sha256
    
    call_count = 0
    def side_effect(filepath):
        nonlocal call_count
        hash_val = original_compute(filepath)
        # 6 source files + 6 verification checks = 12 calls.
        # Let's corrupt the verification hash on the first file (call #7)
        call_count += 1
        if call_count == 7:
            return "corrupted_hash"
        return hash_val
        
    with patch("backup_experiment_artifacts.compute_sha256", side_effect=side_effect):
        with pytest.raises(ValueError, match="Hash mismatch for"):
            backup_artifacts(repo_root, experiment, run_id, dest_base)

def test_source_files_untouched(tmp_path):
    repo_root = tmp_path / "repo"
    dest_base = tmp_path / "dest"
    
    experiment = "EXP-TEST"
    run_id = "run_123"
    
    source_dir = setup_synthetic_run(repo_root, experiment, run_id)
    
    # Store modification times before backup
    mtimes = {f: (source_dir / f).stat().st_mtime for f in REQUIRED_ARTIFACTS}
    
    backup_artifacts(repo_root, experiment, run_id, dest_base)
    
    # Verify modification times are identical
    for f in REQUIRED_ARTIFACTS:
        assert (source_dir / f).stat().st_mtime == mtimes[f]
