"""
DeepVerify Training Infrastructure
==================================
Provides deterministic seeding, epoch execution, logging, metric tracking,
and artifact management for EXP-001.
"""

import os
import sys
import json
import yaml
import time
import shutil
import logging
import random
from pathlib import Path
from typing import Dict, Any, Tuple

from tqdm.auto import tqdm

import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader
from torch.amp import GradScaler, autocast


def set_seed(seed: int = 42):
    """
    Ensures deterministic behavior across Python, NumPy, PyTorch.
    Limits: perfect bit-for-bit determinism across different GPUs is not guaranteed.
    """
    random.seed(seed)
    os.environ['PYTHONHASHSEED'] = str(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    
    if torch.cuda.is_available():
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def build_optimizer(model: nn.Module, config: dict) -> torch.optim.Optimizer:
    train_cfg = config["training"]
    if train_cfg["optimizer"] != "AdamW":
        raise ValueError(f"Unsupported optimizer: {train_cfg['optimizer']}")
        
    return AdamW(
        model.parameters(),
        lr=train_cfg["learning_rate"],
        weight_decay=train_cfg["weight_decay"]
    )


def build_scheduler(optimizer: torch.optim.Optimizer, config: dict) -> torch.optim.lr_scheduler.LRScheduler:
    train_cfg = config["training"]
    if train_cfg["scheduler"] != "CosineAnnealingLR":
        raise ValueError(f"Unsupported scheduler: {train_cfg['scheduler']}")
        
    return CosineAnnealingLR(optimizer, T_max=train_cfg["epochs"])


def build_loss(config: dict) -> nn.Module:
    train_cfg = config["training"]
    if train_cfg["loss"] != "CrossEntropyLoss":
        raise ValueError(f"Unsupported loss: {train_cfg['loss']}")
        
    return nn.CrossEntropyLoss()


def get_device(config: dict) -> torch.device:
    policy = config["runtime"]["device_policy"]
    if policy == "cuda_if_available_else_cpu":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    return torch.device("cpu")


class DeepVerifyTrainer:
    def __init__(self, config: dict, run_dir: Path):
        self.config = config
        self.run_dir = Path(run_dir)
        self.run_id = self.run_dir.name
        self.experiment_id = config["experiment"]["id"]
        
        self.device = get_device(config)
        self.use_amp = config["training"].get("mixed_precision", False) and self.device.type == "cuda"
        
        # Setup directories
        self.run_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy config
        with open(self.run_dir / "config.yaml", "w") as f:
            yaml.dump(self.config, f)
            
        self.metrics_file = self.run_dir / "metrics.json"
        self.metrics = []
        
        self._setup_logger()
        
    def _setup_logger(self):
        self.logger = logging.getLogger(self.run_id)
        self.logger.setLevel(logging.INFO)
        
        # Avoid duplicate handlers if initialized multiple times
        if not self.logger.handlers:
            fh = logging.FileHandler(self.run_dir / "training.log")
            fh.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
            self.logger.addHandler(fh)
            
            ch = logging.StreamHandler()
            ch.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))
            self.logger.addHandler(ch)

    def log(self, message: str):
        self.logger.info(message)
        
    def train_one_epoch(
        self, 
        model: nn.Module, 
        dataloader: DataLoader, 
        optimizer: torch.optim.Optimizer, 
        criterion: nn.Module, 
        scaler: GradScaler,
        epoch: int = 1,
        epochs: int = 1
    ) -> Tuple[float, float]:
        
        model.train()
        total_loss = 0.0
        correct = 0
        total = 0
        
        pbar = tqdm(
            dataloader, 
            desc=f"Epoch {epoch}/{epochs} [Train]", 
            leave=False, 
            dynamic_ncols=True,
            file=sys.stdout
        )
        
        for batch_idx, (inputs, targets) in enumerate(pbar):
            if (batch_idx + 1) % 100 == 0:
                print(f"Heartbeat: Epoch {epoch}/{epochs} [Train] - Batch {batch_idx + 1}/{len(dataloader)}", flush=True)
                
            inputs, targets = inputs.to(self.device), targets.to(self.device)
            
            optimizer.zero_grad()
            
            # Forward
            if self.use_amp:
                with autocast(device_type="cuda"):
                    logits = model(inputs)
                    loss = criterion(logits, targets)
                
                # Backward
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                logits = model(inputs)
                loss = criterion(logits, targets)
                
                loss.backward()
                optimizer.step()
                
            total_loss += loss.item() * inputs.size(0)
            preds = torch.argmax(logits, dim=1)
            correct += (preds == targets).sum().item()
            total += inputs.size(0)
            
            pbar.set_postfix({
                "loss": f"{total_loss/total:.4f}",
                "acc": f"{correct/total:.4f}"
            })
            
        pbar.close()
        epoch_loss = total_loss / total
        epoch_acc = correct / total
        return epoch_loss, epoch_acc
        
    def validate_one_epoch(
        self, 
        model: nn.Module, 
        dataloader: DataLoader, 
        criterion: nn.Module,
        epoch: int = 1,
        epochs: int = 1
    ) -> Tuple[float, float]:
        
        model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        pbar = tqdm(
            dataloader, 
            desc=f"Epoch {epoch}/{epochs} [Val  ]", 
            leave=False, 
            dynamic_ncols=True,
            file=sys.stdout
        )
        
        with torch.no_grad():
            for batch_idx, (inputs, targets) in enumerate(pbar):
                if (batch_idx + 1) % 100 == 0:
                    print(f"Heartbeat: Epoch {epoch}/{epochs} [Val  ] - Batch {batch_idx + 1}/{len(dataloader)}", flush=True)
                    
                inputs, targets = inputs.to(self.device), targets.to(self.device)
                
                # We do not use autocast in eval to ensure stable deterministic fp32 results
                logits = model(inputs)
                loss = criterion(logits, targets)
                
                total_loss += loss.item() * inputs.size(0)
                preds = torch.argmax(logits, dim=1)
                correct += (preds == targets).sum().item()
                total += inputs.size(0)
                
                pbar.set_postfix({
                    "loss": f"{total_loss/total:.4f}",
                    "acc": f"{correct/total:.4f}"
                })
                
        pbar.close()
        epoch_loss = total_loss / total
        epoch_acc = correct / total
        return epoch_loss, epoch_acc
        
    def save_checkpoint(
        self, 
        model: nn.Module, 
        optimizer: torch.optim.Optimizer, 
        scheduler: torch.optim.lr_scheduler.LRScheduler, 
        epoch: int, 
        val_loss: float, 
        val_acc: float, 
        filename: str
    ):
        checkpoint = {
            "epoch": epoch,
            "val_loss": val_loss,
            "val_acc": val_acc,
            "run_id": self.run_id,
            "experiment_id": self.experiment_id,
            "model_state_dict": model.state_dict(),
            "optimizer_state_dict": optimizer.state_dict(),
            "scheduler_state_dict": scheduler.state_dict()
        }
        torch.save(checkpoint, self.run_dir / filename)
        
    def record_metrics(
        self, 
        epoch: int, 
        train_loss: float, 
        train_acc: float, 
        val_loss: float, 
        val_acc: float, 
        lr: float
    ):
        metric_dict = {
            "epoch": epoch,
            "train_loss": train_loss,
            "train_accuracy": train_acc,
            "val_loss": val_loss,
            "val_accuracy": val_acc,
            "learning_rate": lr,
            "run_id": self.run_id,
            "experiment_id": self.experiment_id
        }
        self.metrics.append(metric_dict)
        with open(self.metrics_file, "w") as f:
            json.dump(self.metrics, f, indent=4)

    def fit(
        self, 
        model: nn.Module, 
        train_loader: DataLoader, 
        val_loader: DataLoader, 
        optimizer: torch.optim.Optimizer, 
        scheduler: torch.optim.lr_scheduler.LRScheduler, 
        criterion: nn.Module, 
        scaler: GradScaler,
        epochs: int
    ):
        best_val_loss = float('inf')
        
        for epoch in range(1, epochs + 1):
            epoch_start = time.time()
            self.log(f"--- Epoch {epoch}/{epochs} ---")
            
            train_loss, train_acc = self.train_one_epoch(model, train_loader, optimizer, criterion, scaler, epoch, epochs)
            val_loss, val_acc = self.validate_one_epoch(model, val_loader, criterion, epoch, epochs)
            
            scheduler.step()
            epoch_duration = time.time() - epoch_start
            
            current_lr = scheduler.get_last_lr()[0]
            self.record_metrics(epoch, train_loss, train_acc, val_loss, val_acc, current_lr)
            
            self.log(f"Epoch {epoch} Summary: Duration {epoch_duration:.2f}s | Train Loss: {train_loss:.4f} Acc: {train_acc:.4f} | Val Loss: {val_loss:.4f} Acc: {val_acc:.4f} | LR: {current_lr:.6f}")
            
            if val_loss < best_val_loss:
                self.log(f"Validation loss improved from {best_val_loss:.4f} to {val_loss:.4f}. Saving best model.")
                best_val_loss = val_loss
                self.save_checkpoint(model, optimizer, scheduler, epoch, val_loss, val_acc, "model_best.pth")
            else:
                self.log(f"Validation loss ({val_loss:.4f}) did not improve from {best_val_loss:.4f}.")
                
        self.log(f"Training complete. Best Validation Loss: {best_val_loss:.4f}. Saving final model.")
        # Ensure we pass the final state
        self.save_checkpoint(model, optimizer, scheduler, epochs, val_loss, val_acc, "model_final.pth")
