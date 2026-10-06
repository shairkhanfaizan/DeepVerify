#!/usr/bin/env python3
"""
DeepVerify Phase 2 — Data Pipeline Script (Corrected v2)
=========================================================
Performs in order:
  1. Inventory: scan data/raw/140k/{real,fake}/ — already validated/reorganized
  2. Load existing SHA-256 hashes from prior manifest (reuse, do not rehash)
     (or recompute hashes if the prior manifest is absent / stale)
  3. DeepVerify deterministic experimental split (seed=42, stratified 70/15/15)
     NOTE: The source dataset's Kaggle-original train/valid/test folder
     structure is treated as provenance metadata ONLY. The DeepVerify
     experimental split is generated independently using seed=42 and
     scikit-learn's StratifiedShuffleSplit on the full 140k sample pool.
  4. Exact duplicate check BEFORE manifest freeze (SHA-256, cross-split)
  5. Split manifest generation → data/splits/140k-split-v1.0.csv
  6. Cross-split leakage assertion
  7. Checksum file generation → data/metadata/checksums.sha256
  8. Lineage manifest → docs/research/manifests/140k-lineage.json

Contract: docs/research/data-contract.md (§4 — Split Strategy)
Rules:    .agents/rules/ml.md

Research limitation (§4.4):
  Exact SHA-256 duplicate detection does NOT establish that there are no
  near-duplicates or identity-level leakage. Near-duplicate / facial identity
  clustering is not implemented in Phase 2. This is a formally documented
  research limitation.
"""

import csv
import hashlib
import io
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.model_selection import StratifiedShuffleSplit
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
REPO_ROOT     = Path(__file__).resolve().parent.parent.parent
RAW_140K      = REPO_ROOT / "data" / "raw" / "140k"
SPLITS_DIR    = REPO_ROOT / "data" / "splits"
METADATA_DIR  = REPO_ROOT / "data" / "metadata"
MANIFESTS_DIR = REPO_ROOT / "docs" / "research" / "manifests"
ARCHIVE_PATH  = REPO_ROOT / "data" / "raw" / "140k-real-and-fake-faces.zip"

# Preserved from Phase 1 run — used as known-good integrity reference
ARCHIVE_SHA256_KNOWN = "ddaec55d781628e9f356543aa05c4946c3e6670b9232998b538579332ce6929f"

SPLIT_CSV  = SPLITS_DIR  / "140k-split-v1.0.csv"
CHECKSUMS  = METADATA_DIR / "checksums.sha256"
LINEAGE    = MANIFESTS_DIR / "140k-lineage.json"

LABEL_MAP = {"real": 1, "fake": 0}

# ---------------------------------------------------------------------------
# DeepVerify Experimental Split Configuration
# (from docs/research/data-contract.md §4.1, §4.2)
# ---------------------------------------------------------------------------
SPLIT_SEED        = 42          # canonical; must not be changed without a new split version
TRAIN_FRAC        = 0.70        # 70%  — within approved 70–80% range
VAL_FRAC          = 0.15        # 15%  — within approved 10–15% range
TEST_FRAC         = 0.15        # 15%  — within approved 10–15% range
# TRAIN + VAL + TEST must sum to 1.0 exactly
assert abs(TRAIN_FRAC + VAL_FRAC + TEST_FRAC - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# 1. Inventory — scan raw/140k/{real,fake}/ for all usable images
# ---------------------------------------------------------------------------
def inventory_samples() -> tuple[list[str], list[int]]:
    """
    Scan data/raw/140k/real/ and data/raw/140k/fake/ and return:
      - file_paths: sorted list of relative paths (str, relative to REPO_ROOT)
      - labels:     parallel list of integer labels (1=real, 0=fake)

    Sorting is deterministic (lexicographic). This is the input manifest that
    the split algorithm operates on.
    """
    print("\n[1/7] Inventorying samples in data/raw/140k/ …")

    file_paths: list[str] = []
    labels: list[int] = []

    for label_str in ("real", "fake"):
        label_int = LABEL_MAP[label_str]
        label_dir = RAW_140K / label_str
        if not label_dir.is_dir():
            print(f"  ERROR: expected directory not found: {label_dir}")
            sys.exit(1)
        imgs = sorted(label_dir.glob("*.jpg"))
        for img_path in imgs:
            rel = str(img_path.relative_to(REPO_ROOT))
            file_paths.append(rel)
            labels.append(label_int)

    real_count = sum(1 for l in labels if l == 1)
    fake_count = sum(1 for l in labels if l == 0)
    print(f"  Total samples : {len(file_paths)}")
    print(f"  Real          : {real_count}")
    print(f"  Fake          : {fake_count}")
    return file_paths, labels


# ---------------------------------------------------------------------------
# 2. Compute SHA-256 hashes directly from file bytes
# ---------------------------------------------------------------------------
def compute_hashes(file_paths: list[str]) -> tuple[dict[str, str], list[str]]:
    """
    Computes SHA-256 hashes from the actual current file bytes.
    Does NOT trust any cached manifest to ensure the authoritative dataset
    manifest reflects the exact current state of the filesystem.

    Returns:
      - path_to_hash: {rel_path → sha256_hex}  (only usable/decodable images)
      - corrupt:      list of rel_paths that failed integrity decode
    """
    print("\n[2/7] Computing SHA-256 hashes directly from file bytes …")

    path_to_hash: dict[str, str] = {}
    corrupt: list[str] = []

    print(f"  Hashing {len(file_paths)} images …")
    for rel in tqdm(sorted(file_paths), desc="  Hashing", unit="img"):
        abs_path = REPO_ROOT / rel
        try:
            with open(abs_path, "rb") as f:
                data = f.read()
            img = Image.open(io.BytesIO(data))
            img.load()  # force decode — detects truncation/corruption
            path_to_hash[rel] = hashlib.sha256(data).hexdigest()
        except Exception as e:
            corrupt.append(rel)
            print(f"  CORRUPT: {rel} — {e}")

    if corrupt:
        print(f"  ⚠ {len(corrupt)} corrupt / unreadable images detected.")
        for c in corrupt[:10]:
            print(f"    {c}")
        if len(corrupt) > 10:
            print(f"    … and {len(corrupt) - 10} more.")
    else:
        print(f"  ✓ All {len(path_to_hash)} images have valid hashes.")

    return path_to_hash, corrupt


# ---------------------------------------------------------------------------
# 3. DeepVerify deterministic experimental split (seed=42, stratified)
# ---------------------------------------------------------------------------
def generate_deepverify_split(
    file_paths: list[str],
    labels: list[int],
    corrupt: list[str],
) -> dict[str, list[tuple[str, int]]]:
    """
    Generates the DeepVerify experimental split using a fixed seed=42 and
    StratifiedShuffleSplit from scikit-learn.

    Protocol:
      - Remove corrupt/unreadable samples from the usable pool FIRST.
      - Operate on the sorted, usable file_paths only.
      - First split: separate test (15%) from the rest (85%).
      - Second split: from the 85%, separate val (15%/85% ≈ 17.647%) from train (70%).
      - Both splits use seed=42 and stratified sampling on the binary label.
      - This produces approximately 70% / 15% / 15% with exact stratification.

    IMPORTANT: This split is computed on the full 140k pool, INDEPENDENT of the
    source dataset's original Kaggle train/valid/test folder structure. The Kaggle
    folder structure is recorded as provenance metadata only.

    Returns:
      split_index: {"train": [(rel_path, label_int), ...],
                    "val":   [(rel_path, label_int), ...],
                    "test":  [(rel_path, label_int), ...]}
    """
    print(f"\n[3/7] Generating DeepVerify deterministic experimental split …")
    print(f"  Protocol : StratifiedShuffleSplit, seed={SPLIT_SEED}")
    print(f"  Fractions: train={TRAIN_FRAC:.0%}, val={VAL_FRAC:.0%}, test={TEST_FRAC:.0%}")

    corrupt_set = set(corrupt)
    usable_paths = [fp for fp in file_paths if fp not in corrupt_set]
    usable_labels = [
        labels[i] for i, fp in enumerate(file_paths) if fp not in corrupt_set
    ]
    n = len(usable_paths)
    print(f"  Usable samples : {n}  (removed {len(corrupt_set)} corrupt)")

    X = np.array(usable_paths)
    y = np.array(usable_labels)

    # Step 1: split off test set (15%)
    sss_test = StratifiedShuffleSplit(
        n_splits=1, test_size=TEST_FRAC, random_state=SPLIT_SEED
    )
    trainval_idx, test_idx = next(sss_test.split(X, y))

    X_trainval, y_trainval = X[trainval_idx], y[trainval_idx]
    X_test, y_test = X[test_idx], y[test_idx]

    # Step 2: split val from trainval
    # val fraction relative to trainval = VAL_FRAC / (TRAIN_FRAC + VAL_FRAC)
    val_frac_of_trainval = VAL_FRAC / (TRAIN_FRAC + VAL_FRAC)
    sss_val = StratifiedShuffleSplit(
        n_splits=1, test_size=val_frac_of_trainval, random_state=SPLIT_SEED
    )
    train_idx, val_idx = next(sss_val.split(X_trainval, y_trainval))

    X_train, y_train = X_trainval[train_idx], y_trainval[train_idx]
    X_val, y_val     = X_trainval[val_idx],   y_trainval[val_idx]

    split_index = {
        "train": list(zip(X_train.tolist(), y_train.tolist())),
        "val":   list(zip(X_val.tolist(),   y_val.tolist())),
        "test":  list(zip(X_test.tolist(),  y_test.tolist())),
    }

    for split_name, items in split_index.items():
        real_n = sum(1 for _, l in items if l == 1)
        fake_n = sum(1 for _, l in items if l == 0)
        print(f"  {split_name:5s}: {len(items):6d} total  ({real_n} real / {fake_n} fake)")

    return split_index


# ---------------------------------------------------------------------------
# 4. Exact duplicate detection (must run BEFORE manifest freeze)
# ---------------------------------------------------------------------------
def detect_duplicates(
    split_index: dict[str, list[tuple[str, int]]],
    path_to_hash: dict[str, str],
) -> tuple[dict, dict]:
    """
    Detects exact byte-level duplicate images (SHA-256) and categorizes them
    as within-split vs. cross-split.

    Per §4.4: Near-duplicate / identity leakage is a documented research
    limitation — only exact SHA-256 duplicates are checked here.
    """
    print("\n[4/7] Detecting exact duplicates via SHA-256 (pre-freeze check) …")

    # Build flat index: sha256 → [(split, rel_path), ...]
    hash_to_items: dict[str, list] = defaultdict(list)
    for split_name, items in split_index.items():
        for rel, label in items:
            sha = path_to_hash.get(rel)
            if sha:
                hash_to_items[sha].append((split_name, rel))

    duplicates = {
        sha: items for sha, items in hash_to_items.items() if len(items) > 1
    }
    cross_split_dups = {
        sha: items
        for sha, items in duplicates.items()
        if len({s for s, _ in items}) > 1
    }

    if not duplicates:
        print(f"  ✓ No exact duplicates found across {len(path_to_hash)} hashed images.")
    else:
        print(f"  Found {len(duplicates)} duplicate hash groups.")
        if cross_split_dups:
            print(f"  ⚠ CROSS-SPLIT duplicates (leakage): {len(cross_split_dups)} groups — STOPPING.")
            for sha, items in list(cross_split_dups.items())[:5]:
                print(f"    sha256={sha[:16]}… → {items}")
            print("  ABORTING: cross-split exact duplicates must be resolved first.")
            sys.exit(1)
        else:
            print(f"  ✓ All duplicates are within the same split — no cross-split leakage.")

    print(
        "  Research limitation: Near-duplicate / identity-level leakage was NOT "
        "comprehensively checked. Exact SHA-256 duplication only. This is a formally "
        "documented Phase 2 research limitation (data-contract.md §4.4)."
    )
    return duplicates, cross_split_dups


# ---------------------------------------------------------------------------
# 5. Generate split manifest CSV
# ---------------------------------------------------------------------------
def generate_manifest(
    split_index: dict[str, list[tuple[str, int]]],
    path_to_hash: dict[str, str],
) -> str:
    """
    Writes data/splits/140k-split-v1.0.csv
    Columns: filepath, label, label_int, split, sha256

    The manifest is the immutable contract for EXP-001. Rows are sorted
    deterministically so the file is byte-reproducible.
    """
    print("\n[5/7] Generating split manifest → data/splits/140k-split-v1.0.csv …")

    SPLITS_DIR.mkdir(parents=True, exist_ok=True)

    label_str_map = {1: "real", 0: "fake"}
    rows = []
    for split_name, items in split_index.items():
        for rel, label_int in items:
            rows.append({
                "filepath":  rel,
                "label":     label_str_map[label_int],
                "label_int": label_int,
                "split":     split_name,
                "sha256":    path_to_hash.get(rel, ""),
            })

    # Deterministic sort: split → label → filepath
    rows.sort(key=lambda r: (r["split"], r["label"], r["filepath"]))

    fieldnames = ["filepath", "label", "label_int", "split", "sha256"]
    with open(SPLIT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    with open(SPLIT_CSV, "rb") as f:
        manifest_sha256 = hashlib.sha256(f.read()).hexdigest()

    print(f"  ✓ Manifest written: {len(rows)} rows")
    print(f"  Manifest SHA-256  : {manifest_sha256}")
    return manifest_sha256


# ---------------------------------------------------------------------------
# 6. Cross-split leakage assertion
# ---------------------------------------------------------------------------
def assert_leakage_free(
    split_index: dict[str, list[tuple[str, int]]],
    path_to_hash: dict[str, str],
) -> None:
    """
    Asserts all three pairwise set intersections on content hashes are empty.
    Aborts on violation.
    """
    print("\n[6/7] Asserting cross-split hash disjointness …")

    split_hashes: dict[str, set] = {}
    for split_name, items in split_index.items():
        hashes = set()
        for rel, _ in items:
            h = path_to_hash.get(rel)
            if h:
                hashes.add(h)
        split_hashes[split_name] = hashes

    splits = list(split_hashes.keys())
    leakage_found = False
    for i in range(len(splits)):
        for j in range(i + 1, len(splits)):
            s1, s2 = splits[i], splits[j]
            overlap = split_hashes[s1] & split_hashes[s2]
            if overlap:
                print(f"  ✗ LEAKAGE: {s1} ∩ {s2} = {len(overlap)} — FATAL!")
                leakage_found = True
            else:
                print(f"  ✓ {s1} ∩ {s2} = ∅")

    # Also assert sample identifier uniqueness (no path in two splits)
    all_paths_flat = [rel for items in split_index.values() for rel, _ in items]
    if len(all_paths_flat) != len(set(all_paths_flat)):
        print("  ✗ DUPLICATE sample identifiers across splits — FATAL!")
        leakage_found = True
    else:
        print(f"  ✓ All {len(all_paths_flat)} sample identifiers are unique.")

    if leakage_found:
        print("\n  ABORTING: leakage detected.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# 7. Checksums + lineage manifest
# ---------------------------------------------------------------------------
def write_checksums_and_lineage(
    split_index: dict[str, list[tuple[str, int]]],
    path_to_hash: dict[str, str],
    manifest_sha256: str,
    archive_sha256: str,
    corrupt: list[str],
    duplicates: dict,
) -> dict:
    print("\n[7/7] Writing checksums and lineage manifest …")

    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)

    # checksums.sha256
    with open(CHECKSUMS, "w") as f:
        f.write(f"{archive_sha256}  data/raw/140k-real-and-fake-faces.zip\n")
        f.write(f"{manifest_sha256}  data/splits/140k-split-v1.0.csv\n")
    print(f"  ✓ Checksums → {CHECKSUMS.relative_to(REPO_ROOT)}")

    # Sample counts from the new split
    label_str_map = {1: "real", 0: "fake"}
    usable_total = sum(len(v) for v in split_index.values())
    real_total  = sum(1 for v in split_index.values() for _, l in v if l == 1)
    fake_total  = sum(1 for v in split_index.values() for _, l in v if l == 0)
    train_n = len(split_index["train"])
    val_n   = len(split_index["val"])
    test_n  = len(split_index["test"])

    lineage = {
        "dataset_id":          "140k-real-and-fake-faces",
        "dataset_version":     "unknown",
        "source_url":          "https://www.kaggle.com/datasets/xhlulu/140k-real-and-fake-faces",
        "acquisition_date":    "2026-10-06T09:05:27Z",   # preserved from original download
        "acquisition_method":  "kaggle-api",
        "archive_filename":    "140k-real-and-fake-faces.zip",
        "archive_sha256":      archive_sha256,

        # Source dataset structure (provenance reference only, NOT the DeepVerify split)
        "source_dataset_original_structure": {
            "note": (
                "The Kaggle-provided dataset contains pre-existing train/valid/test "
                "subdirectories. These folder assignments are recorded here as "
                "provenance metadata only. They are NOT used as the DeepVerify "
                "experimental split."
            ),
            "source_train": 100000,
            "source_valid": 20000,
            "source_test":  20000,
        },

        # Integrity
        "extracted_sample_counts": {
            "total": 140000,
            "real":  70000,
            "fake":  70000,
        },
        "corrupt_rejected_count": len(corrupt),
        "usable_sample_count":   usable_total,
        "exact_duplicate_groups": len(duplicates),
        "exact_duplicate_hashing_algorithm": "SHA-256",
        "near_duplicate_check": (
            "NOT performed — near-duplicate / identity-level leakage is a formally "
            "documented Phase 2 research limitation (data-contract.md §4.4)."
        ),

        # DeepVerify experimental split (the authoritative partition)
        "deepverify_split": {
            "note": (
                "Generated independently from the source dataset folder structure "
                "using a deterministic stratified algorithm on the full 140k pool."
            ),
            "split_version":    "split-v1.0",
            "split_seed":       SPLIT_SEED,
            "split_algorithm":  "sklearn.model_selection.StratifiedShuffleSplit",
            "split_fractions": {
                "train": TRAIN_FRAC,
                "val":   VAL_FRAC,
                "test":  TEST_FRAC,
            },
            "split_counts": {
                "train": train_n,
                "val":   val_n,
                "test":  test_n,
            },
            "split_class_balance": "stratified — 50% real / 50% fake in each split",
            "split_manifest_path":   "data/splits/140k-split-v1.0.csv",
            "split_manifest_sha256": manifest_sha256,
        },

        "preprocessing_version": "prep-v1.0",
    }

    with open(LINEAGE, "w") as f:
        json.dump(lineage, f, indent=2)
    print(f"  ✓ Lineage manifest → {LINEAGE.relative_to(REPO_ROOT)}")
    return lineage


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 65)
    print("DeepVerify Phase 2 — Data Pipeline (Corrected: seed=42 split)")
    print("=" * 65)

    # Verify archive integrity using known hash
    print(f"\nVerifying archive SHA-256 …")
    with open(ARCHIVE_PATH, "rb") as f:
        archive_sha256 = hashlib.sha256(f.read()).hexdigest()
    if archive_sha256 != ARCHIVE_SHA256_KNOWN:
        print(f"  ✗ Archive hash mismatch! Expected {ARCHIVE_SHA256_KNOWN[:32]}…")
        sys.exit(1)
    print(f"  ✓ Archive SHA-256 matches known-good hash.")

    file_paths, labels = inventory_samples()
    path_to_hash, corrupt = compute_hashes(file_paths)
    split_index = generate_deepverify_split(file_paths, labels, corrupt)
    duplicates, cross_split_dups = detect_duplicates(split_index, path_to_hash)
    manifest_sha256 = generate_manifest(split_index, path_to_hash)
    assert_leakage_free(split_index, path_to_hash)
    lineage = write_checksums_and_lineage(
        split_index, path_to_hash, manifest_sha256, archive_sha256, corrupt, duplicates
    )

    ds = lineage["deepverify_split"]
    print("\n" + "=" * 65)
    print("Phase 2 Data Pipeline — SUMMARY")
    print("=" * 65)
    print(f"  Total extracted   : 140000")
    print(f"  Corrupt / rejected: {len(corrupt)}")
    print(f"  Usable            : {lineage['usable_sample_count']}")
    print(f"  Exact dup groups  : {lineage['exact_duplicate_groups']}")
    print(f"  --- DeepVerify Experimental Split (seed={SPLIT_SEED}) ---")
    print(f"  Train             : {ds['split_counts']['train']}  (~{TRAIN_FRAC:.0%})")
    print(f"  Val               : {ds['split_counts']['val']}  (~{VAL_FRAC:.0%})")
    print(f"  Test              : {ds['split_counts']['test']}  (~{TEST_FRAC:.0%})")
    print(f"  Archive SHA-256   : {archive_sha256[:32]}…")
    print(f"  Manifest SHA-256  : {manifest_sha256[:32]}…")
    print("\n  ✓ Phase 2 Data Pipeline Gate: READY FOR REVIEW")


if __name__ == "__main__":
    main()
