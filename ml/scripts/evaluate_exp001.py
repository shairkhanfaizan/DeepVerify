import os
import sys
import argparse
import yaml
import hashlib
import time
import json
from pathlib import Path
import torch
import numpy as np

try:
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix
except ImportError:
    raise ImportError("scikit-learn is required for evaluation metrics")

# Ensure we can import deepverify_ml
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "ml"))

from deepverify_ml.data.dataset import build_dataloader_from_config
from deepverify_ml.models.efficientnet import build_model_from_config
from deepverify_ml.training.trainer import get_device

def compute_sha256(filepath: Path) -> str:
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def evaluate(run_dir: Path, expected_ckpt_sha256: str = None, smoke_test: bool = False):
    if not run_dir.exists() or not run_dir.is_dir():
        raise FileNotFoundError(f"Run directory not found: {run_dir}")

    config_path = run_dir / "config.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Config not found in run directory: {config_path}")

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    # 1. Manifest verification
    dataset_cfg = config["dataset"]
    manifest_rel_path = dataset_cfg["split_manifest"]
    manifest_path = REPO_ROOT / manifest_rel_path
    if not manifest_path.is_file():
        raise FileNotFoundError(f"Manifest missing: {manifest_path}")

    expected_manifest_sha = dataset_cfg.get("split_manifest_sha256")
    manifest_sha = compute_sha256(manifest_path)
    
    if expected_manifest_sha and manifest_sha != expected_manifest_sha:
        raise ValueError(f"Manifest SHA-256 mismatch! Expected {expected_manifest_sha}, got {manifest_sha}")

    # 2. Checkpoint integrity
    ckpt_path = run_dir / "model_best.pth"
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")
        
    print(f"Computing SHA-256 for checkpoint {ckpt_path.name}...")
    ckpt_sha = compute_sha256(ckpt_path)
    
    if expected_ckpt_sha256 and ckpt_sha != expected_ckpt_sha256:
        raise ValueError(f"Checkpoint SHA-256 mismatch! Expected {expected_ckpt_sha256}, got {ckpt_sha}")

    # 3. Model construction and loading
    device = get_device(config)
    print(f"Using device: {device}")
    
    model = build_model_from_config(config)
    
    # Load weights safely
    state_dict = torch.load(ckpt_path, map_location=device, weights_only=True)
    if "model_state_dict" in state_dict:
        model.load_state_dict(state_dict["model_state_dict"])
    else:
        model.load_state_dict(state_dict)
        
    model.to(device)
    model.eval()

    # 4. DataLoader construction (STRICTLY 'test' split)
    print("Constructing test DataLoader...")
    test_loader = build_dataloader_from_config(config, split="test", repo_root=REPO_ROOT)
    test_count = len(test_loader.dataset)
    print(f"Test split contains {test_count} samples.")

    if smoke_test:
        print("SMOKE TEST enabled: Limiting to 2 batches.")

    # 5. Inference
    all_preds = []
    all_probs = []
    all_targets = []
    
    print("Running inference over test split...")
    with torch.no_grad():
        for i, (inputs, targets) in enumerate(test_loader):
            inputs, targets = inputs.to(device), targets.to(device)
            
            # Disable AMP for strict deterministic FP32 evaluation
            logits = model(inputs)
            probs = torch.softmax(logits, dim=1)
            
            # Probabilities for the positive class (class 1 -> REAL)
            pos_probs = probs[:, 1]
            preds = torch.argmax(probs, dim=1)
            
            all_preds.extend(preds.cpu().numpy())
            all_probs.extend(pos_probs.cpu().numpy())
            all_targets.extend(targets.cpu().numpy())
            
            if smoke_test and i >= 1:
                break
                
    all_targets = np.array(all_targets)
    all_preds = np.array(all_preds)
    all_probs = np.array(all_probs)

    # 6. Metrics Calculation
    print("Computing metrics...")
    acc = accuracy_score(all_targets, all_preds)
    prec = precision_score(all_targets, all_preds, zero_division=0)
    rec = recall_score(all_targets, all_preds, zero_division=0)
    f1 = f1_score(all_targets, all_preds, zero_division=0)
    
    try:
        auc = roc_auc_score(all_targets, all_probs)
    except ValueError:
        # Happens in tiny smoke tests with only one class
        auc = 0.0
        
    cm = confusion_matrix(all_targets, all_preds, labels=[0, 1])

    metrics = {
        "Accuracy": float(acc),
        "Precision": float(prec),
        "Recall": float(rec),
        "F1": float(f1),
        "ROC-AUC": float(auc)
    }
    
    cm_dict = {
        "labels": dataset_cfg.get("labels", ["FAKE", "REAL"]),
        "matrix": cm.tolist()
    }

    # 7. Write Artifacts
    eval_dir = run_dir / "evaluation"
    eval_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now(timezone.utc).isoformat() if "datetime" in globals() else time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    metadata = {
        "experiment_id": config["experiment"]["id"],
        "evaluated_checkpoint": "model_best.pth",
        "checkpoint_sha256": ckpt_sha,
        "dataset_name": dataset_cfg["name"],
        "split_manifest_sha256": manifest_sha,
        "seed": config["experiment"]["seed"],
        "model_architecture": config["model"]["architecture"],
        "evaluation_timestamp": timestamp,
        "test_sample_count": len(all_targets),
        "smoke_test": smoke_test
    }
    
    with open(eval_dir / "test_metrics.json", "w") as f:
        json.dump(metrics, f, indent=4)
        
    with open(eval_dir / "confusion_matrix.json", "w") as f:
        json.dump(cm_dict, f, indent=4)
        
    with open(eval_dir / "evaluation_metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)

    print("==================================================")
    print("EVALUATION COMPLETE")
    print(f"Accuracy: {acc:.4f}")
    print(f"ROC-AUC:  {auc:.4f}")
    print(f"Artifacts saved to {eval_dir}")
    print("==================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate EXP-001 Held-out Test Split")
    parser.add_argument("--run-dir", required=True, type=Path, help="Path to the experiment run directory")
    parser.add_argument("--expected-sha256", type=str, default=None, help="Expected SHA-256 of model_best.pth")
    parser.add_argument("--smoke-test", action="store_true", help="Run in smoke test mode (2 batches)")
    
    args = parser.parse_args()
    evaluate(args.run_dir, args.expected_sha256, smoke_test=args.smoke_test)
