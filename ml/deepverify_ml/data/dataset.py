"""
Manifest-Driven Dataset for DeepVerify EXP-001.
"""

import csv
import hashlib
from pathlib import Path
from typing import Tuple, List, Dict
import torch
from torch.utils.data import Dataset, DataLoader

from deepverify_ml.preprocessing.pipeline import preprocess_image

class DeepVerifyManifestDataset(Dataset):
    """
    Dataset driven strictly by a canonical Phase 2 CSV manifest.
    """
    
    LABEL_MAP = {
        "fake": 0,
        "real": 1
    }
    
    def __init__(self, config: dict, split: str, repo_root: Path = None):
        """
        Initializes the dataset from configuration and split ('train', 'val', 'test').
        """
        super().__init__()
        
        self.split = split
        if split not in ["train", "val", "test"]:
            raise ValueError(f"Invalid split requested: {split}")
            
        self.is_training = (split == "train")
        
        if repo_root is None:
            import os
            if "DEEPVERIFY_REPO_ROOT" in os.environ:
                self.repo_root = Path(os.environ["DEEPVERIFY_REPO_ROOT"])
            else:
                self.repo_root = Path.cwd()
        else:
            self.repo_root = Path(repo_root)
            
        dataset_cfg = config["dataset"]
        manifest_rel_path = dataset_cfg["split_manifest"]
        expected_sha = dataset_cfg["split_manifest_sha256"]
        
        manifest_path = self.repo_root / manifest_rel_path
        
        if not manifest_path.is_file():
            raise FileNotFoundError(f"Manifest missing: {manifest_path}")
            
        # Verify SHA256 invariant
        with open(manifest_path, "rb") as f:
            file_bytes = f.read()
            computed_sha = hashlib.sha256(file_bytes).hexdigest()
            
        if computed_sha != expected_sha:
            raise ValueError(
                f"Manifest SHA-256 mismatch!\nExpected: {expected_sha}\nGot: {computed_sha}"
            )
            
        # Parse manifest and filter by split
        self.samples: List[Dict[str, str]] = []
        with open(manifest_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            
            # Verify columns
            required_columns = {"filepath", "split", "label"}
            if not required_columns.issubset(set(reader.fieldnames or [])):
                raise ValueError(f"Manifest missing required columns: {required_columns}")
                
            for row in reader:
                if row["split"] == split:
                    # Validate label
                    if row["label"].lower() not in self.LABEL_MAP:
                        raise ValueError(f"Unknown label {row['label']} in manifest")
                    self.samples.append(row)
                    
        # Verification: duplicate paths
        paths = set()
        for s in self.samples:
            if s["filepath"] in paths:
                raise ValueError(f"Duplicate path found in split {split}: {s['filepath']}")
            paths.add(s["filepath"])
            
    def __len__(self) -> int:
        return len(self.samples)
        
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        sample = self.samples[idx]
        image_path = self.repo_root / sample["filepath"]
        
        # Canonical preprocessing (uses config's augmentation on 'train' split)
        # Note: input_size/mean/std are hardcoded in preprocessing pipeline as ImageNet constants,
        # which matches our config. The config values are verified in test_exp001_config.py.
        numpy_tensor = preprocess_image(
            image_input=image_path,
            is_training=self.is_training
        )
        
        tensor = torch.from_numpy(numpy_tensor)
        label = torch.tensor(self.LABEL_MAP[sample["label"].lower()], dtype=torch.long)
        
        return tensor, label


def build_dataloader_from_config(config: dict, split: str, repo_root: Path = None) -> DataLoader:
    """
    Constructs a PyTorch DataLoader for the given split using EXP-001 config.
    """
    dataset = DeepVerifyManifestDataset(config, split, repo_root=repo_root)
    
    train_cfg = config["training"]
    batch_size = train_cfg["batch_size"]
    
    # Shuffle only on train
    shuffle = (split == "train")
    
    num_workers = train_cfg.get("num_workers", 4)
    device_policy = config.get("runtime", {}).get("device_policy", "cuda_if_available_else_cpu")
    pin_memory = (device_policy == "cuda_if_available_else_cpu" and torch.cuda.is_available())
    persistent_workers = (num_workers > 0)
    
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=persistent_workers,
        drop_last=False
    )

