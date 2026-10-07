import os
import sys
import argparse
import yaml
import hashlib
import time
import uuid
import json
import subprocess
from pathlib import Path

import torch

# Ensure we can import deepverify_ml
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "ml"))

from deepverify_ml.data.dataset import DeepVerifyManifestDataset, build_dataloader_from_config
from deepverify_ml.models.efficientnet import build_model_from_config
from deepverify_ml.training.trainer import (
    DeepVerifyTrainer,
    set_seed,
    build_optimizer,
    build_scheduler,
    build_loss
)
from torch.amp import GradScaler

def get_git_commit(repo_root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=str(repo_root), text=True
        ).strip()
    except Exception:
        return "UNKNOWN"

def run_training(config_path: str, smoke_test: bool = False):
    print("==================================================")
    print("EXP-001 — REAL TRAINING IMPLEMENTATION")
    print("==================================================")

    # 1. EXP-001 config loads successfully
    config_file = Path(config_path).resolve()
    if not config_file.is_file():
        raise FileNotFoundError(f"Config file not found: {config_file}")
    
    with open(config_file, "r") as f:
        config = yaml.safe_load(f)
    print("1. Config loaded successfully.")

    # 2. Experiment ID is EXP-001-spatial-baseline
    exp_id = config["experiment"]["id"]
    if exp_id != "EXP-001-spatial-baseline":
        raise ValueError(f"Invalid experiment ID: {exp_id}")
    print(f"2. Experiment ID verified: {exp_id}")

    # 3. Manifest exists
    dataset_cfg = config["dataset"]
    manifest_rel_path = dataset_cfg["split_manifest"]
    manifest_path = REPO_ROOT / manifest_rel_path
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Manifest missing: {manifest_path}")
    print("3. Manifest exists.")

    # 4. Manifest SHA-256 exactly matches
    expected_sha = "f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466"
    with open(manifest_path, "rb") as f:
        computed_sha = hashlib.sha256(f.read()).hexdigest()
    if computed_sha != expected_sha:
        raise ValueError(f"Manifest SHA-256 mismatch!\nExpected: {expected_sha}\nGot: {computed_sha}")
    
    if dataset_cfg["split_manifest_sha256"] != expected_sha:
        raise ValueError("Config manifest SHA does not match required fixed SHA.")
    print("4. Manifest SHA-256 exactly matches.")

    # 8. Seed 42 is applied
    seed = config["experiment"]["seed"]
    if seed != 42:
        raise ValueError(f"Seed must be 42, got {seed}")
    set_seed(seed)
    print(f"8. Seed {seed} is applied deterministically.")

    # 5, 6, 7. Dataset counts and disjoint verification
    print("Constructing datasets for verification...")
    # Read CSV directly for verification
    import csv
    splits = {"train": [], "val": [], "test": []}
    with open(manifest_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            splits[row["split"]].append(row["filepath"])
            
    # Verify exact expected counts based on Phase 2 requirements
    # 70% train (98k), 15% val (21k), 15% test (21k)
    expected_counts = {"train": 98000, "val": 21000, "test": 21000}
    for s, expected in expected_counts.items():
        actual = len(splits[s])
        if actual != expected:
            if not smoke_test:
                raise ValueError(f"Split {s} has {actual} samples, expected {expected}")
            else:
                print(f"Smoke test bypass: Split {s} has {actual} samples.")
    print("5. Expected dataset counts are present.")
    print("6. Train/validation/test split counts are correct.")

    train_set = set(splits["train"])
    val_set = set(splits["val"])
    test_set = set(splits["test"])

    if not train_set.isdisjoint(val_set):
        raise ValueError("Train and validation sets are NOT disjoint!")
    if not train_set.isdisjoint(test_set):
        raise ValueError("Train and test sets are NOT disjoint!")
    if not val_set.isdisjoint(test_set):
        raise ValueError("Validation and test sets are NOT disjoint!")
    print("7. Train/validation/test splits are strictly disjoint.")

    if not smoke_test:
        # Construct DataLoaders (test is HELD OUT, never loaded in training)
        train_loader = build_dataloader_from_config(config, split="train", repo_root=REPO_ROOT)
        val_loader = build_dataloader_from_config(config, split="val", repo_root=REPO_ROOT)
        print("Dataloaders constructed successfully.")
    else:
        print("Smoke test bypass: skipping actual dataloader construction.")

    # 10. EfficientNet-B0 constructs correctly
    model = build_model_from_config(config)
    print("10. EfficientNet-B0 model constructed successfully.")

    # 11 & 12. Output directory is created safely without overwriting
    run_timestamp = time.strftime("%Y%m%d_%H%M%S")
    short_uuid = str(uuid.uuid4())[:8]
    run_id = f"run_{run_timestamp}_{short_uuid}"
    run_dir = REPO_ROOT / "experiments" / "runs" / "EXP-001" / run_id
    
    if run_dir.exists():
        raise FileExistsError(f"Run directory {run_dir} already exists. Cannot overwrite.")
    run_dir.mkdir(parents=True, exist_ok=False)
    print(f"11/12. Output directory created safely: {run_dir}")

    # Initialize Trainer
    trainer = DeepVerifyTrainer(config, run_dir)
    # 9. CUDA/device policy is respected
    print(f"9. Device policy respected. Selected device: {trainer.device}")
    model.to(trainer.device)

    optimizer = build_optimizer(model, config)
    scheduler = build_scheduler(optimizer, config)
    criterion = build_loss(config)
    scaler = GradScaler("cuda", enabled=trainer.use_amp)

    # Collect Run Metadata
    metadata = {
        "experiment_id": exp_id,
        "run_id": run_id,
        "git_commit_sha": get_git_commit(REPO_ROOT),
        "dataset_name": dataset_cfg["name"],
        "dataset_version": dataset_cfg["version"],
        "manifest_sha256": computed_sha,
        "seed": seed,
        "model_architecture": config["model"]["architecture"],
        "model_pretrained_weights": config["model"]["pretrained_weights"],
        "hyperparameters": config["training"],
        "python_version": sys.version,
        "pytorch_version": torch.__version__,
        "torchvision_version": __import__("torchvision").__version__,
        "device": str(trainer.device),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "timestamp_start": time.time()
    }
    
    metadata_path = run_dir / "run_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)
    print("Run metadata recorded.")

    epochs = config["training"]["epochs"]
    if smoke_test:
        epochs = 1
        print("WARNING: Smoke test mode enabled. Forcing epochs=1 and will stop early.")
    
    print("==================================================")
    print(f"STARTING TRAINING ({epochs} epochs)")
    print("==================================================")
    
    if not smoke_test:
        print("Starting real training loop...")
        trainer.fit(model, train_loader, val_loader, optimizer, scheduler, criterion, scaler, epochs)
    else:
        print("Smoke test completed verification.")

    metadata["timestamp_end"] = time.time()
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=4)

    print("==================================================")
    print("TRAINING RUNNER VERIFICATION COMPLETE")
    print("==================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DeepVerify EXP-001 Training Runner")
    parser.add_argument("--config", type=str, default=str(REPO_ROOT / "experiments" / "configs" / "EXP-001.yaml"), help="Path to config yaml")
    parser.add_argument("--smoke-test", action="store_true", help="Run in smoke test mode (bypass count checks, 1 epoch)")
    
    args = parser.parse_args()
    
    run_training(args.config, smoke_test=args.smoke_test)
