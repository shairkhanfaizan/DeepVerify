"""
EXP-001 CPU Smoke Test
======================
Validates that the configuration, dataset, dataloader, and model all integrate
successfully, and performs a single forward pass on the CPU.
No training, no backwards pass, no checkpointing.
"""

import sys
import yaml
import torch
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = REPO_ROOT / "experiments" / "configs" / "EXP-001.yaml"

sys.path.insert(0, str(REPO_ROOT / "ml"))

from deepverify_ml.data.dataset import build_dataloader_from_config
from deepverify_ml.models.efficientnet import build_model_from_config


def run_smoke_test():
    print("--- EXP-001 CPU Smoke Test ---")
    
    # 1. Load config
    with open(CONFIG_PATH, "r") as f:
        config = yaml.safe_load(f)
    print("1. Config loaded successfully.")
    
    # 2. Construct Dataset / DataLoader (use val for determinism and speed)
    print("2. Constructing validation DataLoader...")
    val_loader = build_dataloader_from_config(config, split="val")
    print(f"   Batch size: {val_loader.batch_size}")
    
    # 3. Obtain minimal batch
    print("3. Fetching a single batch from the dataset...")
    batch_images, batch_labels = next(iter(val_loader))
    print(f"   Batch images shape: {batch_images.shape}, dtype: {batch_images.dtype}")
    print(f"   Batch labels shape: {batch_labels.shape}, dtype: {batch_labels.dtype}")
    
    # 4. Construct Model
    print("4. Constructing EfficientNet-B0 model from config...")
    model = build_model_from_config(config)
    model.eval()  # Set to evaluation mode
    print("   Model constructed successfully.")
    
    # 5. Run CPU Forward Inference
    print("5. Running forward inference on CPU...")
    # Force CPU to comply with CPU-only smoke test requirement
    device = torch.device("cpu")
    model.to(device)
    batch_images = batch_images.to(device)
    
    with torch.no_grad():
        logits = model(batch_images)
        
    # 6. & 7. Verify outputs
    print("6. Verifying outputs...")
    print(f"   Output shape: {logits.shape}")
    print(f"   Output dtype: {logits.dtype}")
    
    assert logits.shape == (val_loader.batch_size, 2), "Output shape mismatch!"
    assert logits.dtype == torch.float32, "Output dtype mismatch!"
    
    print("---------------------------------")
    print("Smoke test PASSED successfully! ")
    print("---------------------------------")


if __name__ == "__main__":
    run_smoke_test()
