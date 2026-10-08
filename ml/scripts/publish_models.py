#!/usr/bin/env python3
"""
DeepVerify V1 Model Publishing Script

Prepares the approved production model artifacts for Hugging Face hosting.
Validates SHA256 hashes to ensure strict adherence to the frozen V1 ML milestone.
"""

import os
import sys
import json
import shutil
import hashlib
import argparse
from pathlib import Path

try:
    from huggingface_hub import HfApi
    HAS_HF_HUB = True
except ImportError:
    HAS_HF_HUB = False

# Approved Production Models
APPROVED_MODELS = {
    "spatial": {
        "path": "experiments/runs/EXP-001/run_20261007_141902_9e04eeda/model_best.pth",
        "sha256": "b05a302c9283783fdc7352abe967baa4e4ab278028a2ba08cf40bd290e521d03",
        "experiment_id": "EXP-001",
        "run_id": "run_20261007_141902_9e04eeda",
        "architecture": "EfficientNet-B0",
        "pretrained_initialization": "ImageNet",
        "input_size": [3, 224, 224],
        "preprocessing_representation": "Spatial RGB",
        "class_convention": "0=REAL, 1=FAKE",
        "probability_convention": "P(REAL)",
        "dataset_version": "140k-real-and-fake-faces-v1.0",
        "test_accuracy": "99.895%",
        "test_roc_auc": "0.999995"
    },
    "frequency": {
        "path": "experiments/runs/EXP-002/run_20261008_080128_559d2631/model_best.pth",
        "sha256": "507f9d6cf9aadc633d336f236df140555f4847fdc29697a8fc576a3fe3aa4c52",
        "experiment_id": "EXP-002",
        "run_id": "run_20261008_080128_559d2631",
        "architecture": "EfficientNet-B0",
        "pretrained_initialization": "ImageNet",
        "input_size": [3, 224, 224],
        "preprocessing_representation": "Frequency-domain log-magnitude FFT",
        "class_convention": "0=REAL, 1=FAKE",
        "probability_convention": "P(REAL)",
        "dataset_version": "140k-real-and-fake-faces-v1.0",
        "test_accuracy": "81.73%",
        "test_roc_auc": "0.9014"
    }
}

MANIFEST = {
    "model_bundle_version": "v1.0.0",
    "ensemble_weights": {
        "spatial": 0.60,
        "frequency": 0.40
    },
    "models": {}
}

MODEL_CARD = """---
tags:
- deepfake-detection
- computer-vision
- efficientnet
- forensics
---

# DeepVerify V1 Models

DeepVerify is an AI-generated/manipulated media detection project. 
This repository contains the V1 production model bundle, utilizing a 60/40 spatial-frequency probability ensemble.

## Models Included

1. **Spatial Model (EXP-001)**
   - Architecture: EfficientNet-B0
   - Representation: Spatial RGB
   - Weight: 60% of ensemble

2. **Frequency Model (EXP-002)**
   - Architecture: EfficientNet-B0
   - Representation: Frequency-domain log-magnitude FFT
   - Weight: 40% of ensemble

## Input & Output
- **Expected Input**: 224x224 RGB image
- **Output Interpretation**: Both models predict `P(REAL)`. The final ensemble score is `0.60 * Spatial_P(REAL) + 0.40 * Frequency_P(REAL)`. A score `>= 0.5` is considered `LIKELY_AUTHENTIC`, while `< 0.5` is considered `LIKELY_AI_GENERATED`.

## Limitations
- **Dataset Limitations**: Trained exclusively on the 140k Real and Fake Faces v1.0 benchmark. Does not guarantee out-of-distribution generalization to all generative models or non-face semantics.
- **Model Limitations**: This model is **not** a universal deepfake detector. It is highly specific to the domain it was trained on.
- **Confidence**: The probability score is a statistical confidence metric, **not** absolute ground truth.
- **Explainability**: Spatial Grad-CAM visual evidence indicates regions of model activation/saliency. It is **not** causal proof of manipulation.
"""

def compute_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def prepare_bundle(repo_root: Path, output_dir: Path):
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    
    print(f"Preparing bundle in {output_dir}...")
    
    for model_name, info in APPROVED_MODELS.items():
        src_path = repo_root / info["path"]
        if not src_path.exists():
            print(f"ERROR: Missing approved checkpoint for {model_name}: {src_path}")
            sys.exit(1)
            
        print(f"Verifying {model_name} hash...")
        actual_hash = compute_sha256(src_path)
        if actual_hash != info["sha256"]:
            print(f"ERROR: Hash mismatch for {model_name}!")
            print(f"  Expected: {info['sha256']}")
            print(f"  Actual:   {actual_hash}")
            sys.exit(1)
        print(f"  Hash matches: {actual_hash}")
        
        # Create dir and copy
        model_dir = output_dir / model_name
        model_dir.mkdir()
        shutil.copy2(src_path, model_dir / "model_best.pth")
        
        # Write metadata
        metadata = {
            "experiment_id": info["experiment_id"],
            "run_id": info["run_id"],
            "architecture": info["architecture"],
            "pretrained_initialization": info["pretrained_initialization"],
            "input_size": info["input_size"],
            "preprocessing_representation": info["preprocessing_representation"],
            "class_convention": info["class_convention"],
            "probability_convention": info["probability_convention"],
            "dataset_version": info["dataset_version"],
            "checkpoint_filename": "model_best.pth",
            "sha256": info["sha256"],
            "relevant_metrics": {
                "test_accuracy": info["test_accuracy"],
                "test_roc_auc": info["test_roc_auc"]
            },
            "known_limitations": "Trained on 140k face benchmark. Not a universal deepfake detector."
        }
        with open(model_dir / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)
            
        # Add to manifest
        MANIFEST["models"][model_name] = {
            "experiment_id": info["experiment_id"],
            "run_id": info["run_id"],
            "checkpoint_filename": f"{model_name}/model_best.pth",
            "sha256": info["sha256"]
        }
        
    # Write manifest
    with open(output_dir / "manifest.json", "w") as f:
        json.dump(MANIFEST, f, indent=2)
        
    # Write README
    with open(output_dir / "README.md", "w") as f:
        f.write(MODEL_CARD)
        
    print(f"Success! Model bundle prepared at {output_dir}")

def publish_to_hf(output_dir: Path, repo_id: str):
    if not HAS_HF_HUB:
        print("ERROR: huggingface_hub is not installed.")
        sys.exit(1)
        
    print(f"Publishing to Hugging Face Hub: {repo_id}...")
    api = HfApi()
    
    # Check if repo exists, if not create it
    try:
        api.repo_info(repo_id=repo_id)
    except Exception:
        print(f"Repository {repo_id} not found. Creating...")
        api.create_repo(repo_id=repo_id, private=True, exist_ok=True)
        
    api.upload_folder(
        folder_path=str(output_dir),
        repo_id=repo_id,
        commit_message="Publish DeepVerify V1 Model Bundle",
        ignore_patterns=["*.tmp", ".DS_Store"]
    )
    print(f"Successfully published to https://huggingface.co/{repo_id}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DeepVerify V1 Model Publishing Script")
    parser.add_argument("--publish", action="store_true", help="Actually upload to Hugging Face Hub")
    args = parser.parse_args()
    
    repo_root = Path(__file__).parent.parent.parent.resolve()
    bundle_dir = repo_root / "deepverify-models"
    
    prepare_bundle(repo_root, bundle_dir)
    
    if args.publish:
        repo_id = os.environ.get("HF_REPO_ID")
        if not repo_id:
            print("ERROR: HF_REPO_ID environment variable is required to publish.")
            sys.exit(1)
        publish_to_hf(bundle_dir, repo_id)
    else:
        print("\nDry run complete. Use --publish and set HF_REPO_ID to upload to Hugging Face.")
