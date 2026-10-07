import os
import sys
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

REQUIRED_ARTIFACTS = [
    "model_best.pth",
    "model_final.pth",
    "metrics.json",
    "config.yaml",
    "run_metadata.json",
    "training.log"
]

def compute_sha256(filepath: Path) -> str:
    """Computes the SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        # Read in chunks to avoid memory issues with large files
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def backup_artifacts(repo_root: Path, experiment: str, run_id: str, destination_base: Path, overwrite: bool = False):
    source_dir = repo_root / "experiments" / "runs" / experiment / run_id
    
    if not source_dir.exists() or not source_dir.is_dir():
        raise FileNotFoundError(f"Source run directory does not exist: {source_dir}")

    # 1. Validate required artifacts exist
    missing_files = []
    for artifact in REQUIRED_ARTIFACTS:
        if not (source_dir / artifact).exists():
            missing_files.append(artifact)
    
    if missing_files:
        raise FileNotFoundError(f"Missing required artifacts in source directory: {missing_files}")

    dest_dir = destination_base / experiment / run_id
    
    # 2. Collision Safety Check
    if dest_dir.exists():
        if not overwrite:
            raise FileExistsError(f"Destination directory already exists: {dest_dir}. Use --overwrite to force.")
    else:
        dest_dir.mkdir(parents=True)
    
    print(f"Backing up artifacts from {source_dir} to {dest_dir}...")
    manifest = {
        "experiment_id": experiment,
        "run_id": run_id,
        "backup_timestamp": datetime.now(timezone.utc).isoformat(),
        "artifacts": {}
    }

    try:
        # 3. Calculate source hashes and copy
        for artifact in REQUIRED_ARTIFACTS:
            src_path = source_dir / artifact
            dst_path = dest_dir / artifact
            
            # Collision check on individual file if dir existed
            if dst_path.exists() and not overwrite:
                raise FileExistsError(f"Destination file already exists: {dst_path}. Use --overwrite to force.")

            print(f"  Computing source SHA-256 for {artifact}...")
            src_hash = compute_sha256(src_path)
            file_size = src_path.stat().st_size
            
            print(f"  Copying {artifact}...")
            shutil.copy2(src_path, dst_path)
            
            manifest["artifacts"][artifact] = {
                "size_bytes": file_size,
                "source_sha256": src_hash
            }

        # 4. Verification post-copy
        print("Verifying copied artifacts...")
        for artifact in REQUIRED_ARTIFACTS:
            dst_path = dest_dir / artifact
            expected_hash = manifest["artifacts"][artifact]["source_sha256"]
            
            dst_hash = compute_sha256(dst_path)
            if dst_hash != expected_hash:
                raise ValueError(f"Hash mismatch for {artifact}! Expected {expected_hash}, got {dst_hash}")
            
            manifest["artifacts"][artifact]["verified_sha256"] = dst_hash
            print(f"  [OK] {artifact} verified ({dst_hash})")
        
        # 5. Write manifest
        manifest_path = dest_dir / "backup_manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
        print(f"Backup manifest generated at: {manifest_path}")
        print("Backup completed successfully.")

    except Exception as e:
        # In case of any error during backup, we don't attempt rollback here
        # to keep the script simple, but we fail explicitly.
        raise e


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backup and verify experiment artifacts.")
    parser.add_argument("--experiment", required=True, help="Experiment ID (e.g., EXP-001)")
    parser.add_argument("--run-id", required=True, help="Run ID to backup")
    parser.add_argument("--destination", required=True, type=Path, help="Backup destination base directory")
    parser.add_argument("--overwrite", action="store_true", help="Allow overwriting existing destination files")
    
    args = parser.parse_args()
    
    REPO_ROOT = Path(__file__).resolve().parent.parent.parent
    backup_artifacts(REPO_ROOT, args.experiment, args.run_id, args.destination, args.overwrite)
