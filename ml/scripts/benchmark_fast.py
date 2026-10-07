import sys
import time
import argparse
from pathlib import Path
import torch
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "ml"))

from deepverify_ml.data.dataset import build_dataloader_from_config

def run_benchmark(config, num_workers, batches_to_run=5):
    print(f"\n--- Benchmarking DataLoader with num_workers={num_workers} ---")
    config["training"]["num_workers"] = num_workers
    device = torch.device("cpu")
    
    start_setup = time.time()
    train_loader = build_dataloader_from_config(config, split="train", repo_root=REPO_ROOT)
    setup_time = time.time() - start_setup
    print(f"DataLoader setup time: {setup_time:.4f}s")
    
    loader_iter = iter(train_loader)
    total_acq = 0.0
    total_step = 0.0
    overall_start = time.time()
    
    for i in range(batches_to_run):
        t0 = time.time()
        inputs, targets = next(loader_iter)
        acq = time.time() - t0
        total_acq += acq
        
        t1 = time.time()
        time.sleep(0.05) # mock GPU step time
        step = time.time() - t1
        total_step += step
        print(f"  Batch {i+1} - Acq: {acq:.4f}s | Step: {step:.4f}s")
        
    e2e = time.time() - overall_start
    print(f"  Avg Acq: {total_acq/batches_to_run:.4f}s | Avg Step: {total_step/batches_to_run:.4f}s | Throughput: {batches_to_run/e2e:.2f} b/s")

def main():
    config_path = REPO_ROOT / "experiments" / "configs" / "EXP-001.yaml"
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
    run_benchmark(config, 0)
    run_benchmark(config, 4)

if __name__ == "__main__":
    main()
