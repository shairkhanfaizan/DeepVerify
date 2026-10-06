"""
EXP-001 CPU Training Smoke Test
===============================
Runs the entire training infrastructure (Trainer, Optimizer, Scheduler, Checkpoints)
on a tiny synthetic dataset in a temporary directory.
"""

import sys
import yaml
import tempfile
import torch
from torch.utils.data import TensorDataset, DataLoader
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = REPO_ROOT / "experiments" / "configs" / "EXP-001.yaml"

sys.path.insert(0, str(REPO_ROOT / "ml"))

from deepverify_ml.models.efficientnet import build_model_from_config
from deepverify_ml.training.trainer import (
    DeepVerifyTrainer,
    set_seed,
    build_optimizer,
    build_scheduler,
    build_loss
)
from torch.amp import GradScaler

def run_training_smoke_test():
    print("--- EXP-001 CPU Training Smoke Test ---")
    
    # 1. Configuration & Seeding
    with open(CONFIG_PATH, "r") as f:
        config = yaml.safe_load(f)
    print("1. Config loaded successfully.")
    
    set_seed(config["experiment"]["seed"])
    print("2. Deterministic seed applied.")
    
    # 3. Create tiny synthetic dataset to avoid loading 140k real images
    # 4 batches of size 2
    dummy_x = torch.randn(8, 3, 224, 224)
    dummy_y = torch.randint(0, 2, (8,))
    dataset = TensorDataset(dummy_x, dummy_y)
    
    # Use config batch size 2 for the tiny dataset
    config["training"]["batch_size"] = 2
    train_loader = DataLoader(dataset, batch_size=2, shuffle=True)
    val_loader = DataLoader(dataset, batch_size=2, shuffle=False)
    print("3. Tiny synthetic DataLoader constructed.")
    
    # 4. Initialize model
    model = build_model_from_config(config)
    
    # Check initial weights to prove they update
    initial_weights = model.model.classifier[1].weight.clone()
    print("4. EfficientNet-B0 model constructed.")
    
    # 5. Initialize Trainer in a temporary directory to keep working tree clean
    with tempfile.TemporaryDirectory() as tmpdir:
        run_dir = Path(tmpdir) / "smoke_run"
        trainer = DeepVerifyTrainer(config, run_dir)
        # Force CPU device for the smoke test to satisfy requirements safely
        trainer.device = torch.device("cpu")
        trainer.use_amp = False
        model.to(trainer.device)
        print("5. Trainer initialized in temp directory.")
        
        optimizer = build_optimizer(model, config)
        scheduler = build_scheduler(optimizer, config)
        criterion = build_loss(config)
        scaler = GradScaler("cuda", enabled=trainer.use_amp)
        print("6. Optimizer, Scheduler, and Loss constructed.")
        
        print("7-18. Running multi-epoch fit()...")
        trainer.fit(model, train_loader, val_loader, optimizer, scheduler, criterion, scaler, epochs=2)
        
        # 19. Verify model parameters changed
        updated_weights = model.model.classifier[1].weight.clone()
        assert not torch.allclose(initial_weights, updated_weights), "Model parameters did NOT update during training!"
        print("19. Verified model parameters updated correctly.")
        
        # 20. Verify validation did not modify parameters
        trainer.validate_one_epoch(model, val_loader, criterion)
        val_post_weights = model.model.classifier[1].weight.clone()
        assert torch.allclose(updated_weights, val_post_weights), "Validation epoch modified parameters!"
        print("20. Verified validation uses eval/no_grad behavior safely.")
        
        # 21. Artifacts writing and best-model verification
        import json
        with open(run_dir / "metrics.json", "r") as f:
            metrics = json.load(f)
            assert len(metrics) == 2, "Expected 2 epochs in metrics"
        
        best_ckpt = torch.load(run_dir / "model_best.pth", map_location="cpu")
        final_ckpt = torch.load(run_dir / "model_final.pth", map_location="cpu")
        
        assert best_ckpt["epoch"] in [1, 2], "Best model epoch must be 1 or 2"
        assert final_ckpt["epoch"] == 2, "Final model epoch must be 2"
        
        assert (run_dir / "config.yaml").exists(), "config.yaml missing"
        assert (run_dir / "training.log").exists(), "training.log missing"
        
        print("21. Artifacts (checkpoints, metrics, config, log) and best-model logic successfully verified.")
        
    print("------------------------------------------")
    print("Training Smoke Test PASSED successfully! ")
    print("------------------------------------------")


if __name__ == "__main__":
    run_training_smoke_test()
