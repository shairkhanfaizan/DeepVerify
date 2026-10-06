# DeepVerify — ML & Data Pipeline Contract (Phase 2)

> **Status:** PHASE 2 COMPLETE (CONTRACT APPROVED, PIPELINE IMPLEMENTED & VERIFIED)  
> **Phase:** Phase 2 — Spatial Baseline (Data & ML Pipeline Contract & Implementation)  
> **Source of Truth:** DeepVerify Development Blueprint, `docs/architecture/system.md`, `.agents/rules/ml.md`, `.agents/rules/security.md`  
> **Execution State:** Phase 2 specification, data pipeline implementation, and pipeline verification are COMPLETE. Dataset acquisition, lineage, split manifest, and canonical preprocessing are complete and verified for the approved 140k dataset. Model training (EXP-001) has NOT STARTED; zero model checkpoints exist; backend/frontend are OUT OF SCOPE / NOT STARTED.

### Phase 2 Current State Summary

| Component / Milestone | Status | Description |
|---|---|---|
| **Phase 2 design/specification** | **COMPLETE** | Data contract approved and finalized. |
| **Phase 2 implementation** | **COMPLETE** | Data pipeline scripts, lineage generator, and canonical preprocessing implemented. |
| **Phase 2 verification** | **COMPLETE** | Test suite (`ml/tests/test_phase2_pipeline.py`) passing (18/18 tests); contract assertions validated. |
| **Dataset acquisition** | **COMPLETE** | Approved 140k Real and Fake Faces dataset acquired via Kaggle API. |
| **Dataset lineage** | **COMPLETE** | Recorded at `docs/research/manifests/140k-lineage.json` with source archive SHA-256. |
| **Split manifest** | **COMPLETE** | Generated at `data/splits/140k-split-v1.0.csv` (SHA-256: `f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466`). |
| **Canonical preprocessing** | **IMPLEMENTED** | Implemented at `ml/deepverify_ml/preprocessing/pipeline.py` (training augmentations + deterministic inference/eval). |
| **Training** | **NOT STARTED** | Parameter optimization has not begun. |
| **EXP-001** | **NOT STARTED** | Next ML milestone; execution has not started. |
| **Model checkpoints** | **NONE** | Zero weight files created. |
| **Backend/frontend** | **OUT OF SCOPE / NOT STARTED** | Application integration is out of scope for Phase 2; deferred to Phase 8. |

---

## 1. DATASET INVENTORY

The project architecture identifies three datasets across its development lifecycle. Their characteristics, pipeline roles, and decision statuses are cataloged below without unsupported claims:

| Dataset | Modality & Format | Manipulation / Class Categories | Pipeline Role | Decision Status | Provenance & Access |
|---|---|---|---|---|---|
| **140k Real and Fake Faces** | Static RGB images; aligned facial crops; ~256×256 JPEG | Binary: `real` (authentic human faces from FFHQ) vs. `fake` (StyleGAN synthetic faces) | Primary training and evaluation benchmark for M0 / EXP-001 spatial baseline | **Decided** (Primary spatial baseline) | Public dataset (Kaggle). Acquired via Kaggle API; lineage and integrity verified. |
| **CIFAKE** | Static RGB images; low resolution (32×32 PNG); 10 semantic classes | Binary: `REAL` (CIFAR-10 photographic images) vs. `FAKE` (Stable Diffusion v1.4 synthetic images) | Candidate for out-of-distribution (OOD) cross-generator generalization evaluation | **TBD (TBD-011)** — Phase 2 working decision: CIFAKE is excluded from EXP-001/M0 and reserved for later cross-dataset evaluation, subject to confirmation after baseline evaluation. | Public dataset (Kaggle). Download authorization: TBD upon acquisition. |
| **FaceForensics++ (FF++)** | Video sequences (H.264/MP4); 720p/1080p; ~10–30s duration; multi-frame | Real pristine videos vs. 4 manipulation types (Deepfakes, Face2Face, FaceSwap, NeuralTextures); 3 compression levels (raw, c23, c40) | Facial manipulation detection on video; frame extraction and video aggregation | **Decided for Video Work**; **Excluded from Phase 2 / M0** | Academic research dataset (TUM). Requires signed license agreement and official download script credentials. |

> [!IMPORTANT]
> - **M0 / EXP-001 Scope:** Only the **140k Real and Fake Faces** dataset is in scope for the initial spatial baseline.
> - **CIFAKE Scope:** Phase 2 working decision: CIFAKE is excluded from EXP-001/M0 and reserved for later cross-dataset evaluation, subject to confirmation after baseline evaluation.
> - **FaceForensics++ Scope:** Entirely deferred to later video phases (face extraction and video aggregation).

---

## 2. DATA LINEAGE SPECIFICATION

To ensure full research reproducibility per `.agents/rules/ml.md`, every acquired dataset must have an immutable lineage manifest recorded under `docs/research/manifests/<dataset_id>-lineage.json` before being used in training (implemented for the 140k dataset at `docs/research/manifests/140k-lineage.json`):

```json
{
  "dataset_id": "140k-real-and-fake-faces",
  "version": "1.0",
  "source_url": "https://www.kaggle.com/datasets/xhlulu/140k-real-and-fake-faces",
  "acquisition_date": "2026-10-06T09:05:27Z",
  "acquisition_method": "kaggle-api",
  "archive_sha256": "ddaec55d781628e9f356543aa05c4946c3e6670b9232998b538579332ce6929f",
  "sample_counts": {
    "total": 140000,
    "real": 70000,
    "fake": 70000,
    "train": 98000,
    "val": 21000,
    "test": 21000
  },
  "split_version": "split-v1.0",
  "split_manifest_path": "data/splits/140k-split-v1.0.csv",
  "split_manifest_sha256": "f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466",
  "preprocessing_version": "prep-v1.0"
}
```

---

## 3. DIRECTORY & DATA CONTRACT

Raw media, processed tensors, and large binary assets **MUST NEVER** be committed to Git.
`data/raw/`, `data/processed/`, and `data/metadata/` are ignored by `.gitignore`.

`data/splits/` is **version-controlled**: immutable split manifests are lightweight CSV/JSON
files (no images, no binaries) that must be available from Git to guarantee reproducibility
and to support remote/Colab execution where the working tree is not available.
Raw image binaries and archives must never be placed under `data/splits/`.

The local/Colab data directory layout is as follows:

```
data/
├── raw/                             # IGNORED — pristine downloaded archives and extracted files
│   ├── 140k/
│   │   ├── real/
│   │   └── fake/
│   ├── cifake/                      # (Acquired only when executing TBD-011)
│   └── ffpp/                        # (Deferred to Phase 6)
├── processed/                       # IGNORED — standardized resized crops ready for DataLoader
│   └── 140k_224x224/
│       ├── real/
│       └── fake/
├── splits/                          # TRACKED — immutable split manifests (CSV / JSON)
│   ├── 140k-split-v1.0.csv          # Maps filepath -> label -> split (train/val/test)
│   └── ffpp-video-splits.json       # (Deferred to Phase 6; video-level partition)
└── metadata/                        # IGNORED — integrity checksums and metadata
    └── checksums.sha256
```


---

## 4. SPLIT STRATEGY & LEAKAGE PREVENTION

### 4.1 Split Allocations
- **Train Set (70% – 80%):** Parameter optimization via gradient descent.
- **Validation Set (10% – 15%):** Hyperparameter tuning, learning rate scheduling, and early stopping. Evaluated after each training epoch.
- **Test Set (10% – 15%):** Held-out final benchmark evaluation. Evaluated **exactly once** after training concludes. Metrics reported in research logs must come exclusively from this split.

### 4.2 Split Ordering Invariants
1. **Splitting Occurs Before Augmentation:** Data augmentation is strictly prohibited prior to partitioning. Splitting operates strictly on raw, unaugmented file paths.
2. **Immutable Partition Manifests:** Splits are computed once using a recorded random seed (`split_seed: 42`) and serialized to `data/splits/<dataset>-split-<version>.csv`. Training loaders consume this fixed manifest.
3. **Stratified Sampling:** Binary class proportions (`real` vs. `fake`) must remain exactly balanced across all three splits.

### 4.3 Video-Level Partition Invariant (CRITICAL)
Per `.agents/rules/ml.md` Section 3:
- For video datasets (FaceForensics++ in Phase 6+), splits **MUST be partitioned by source video ID**, never by individual frame.
- **Invariant:** If video `V_001` is assigned to `train`, all frames extracted from `V_001` must reside strictly in `train`. No frame from `V_001` may ever appear in `val` or `test`.
- Violating this rule constitutes fatal data leakage and invalidates all experimental results.

### 4.4 Image Duplicate Leakage Prevention & Research Risk
To prevent data contamination in image datasets (such as 140k Real and Fake Faces):
1. **Exact Duplicate Detection via Content Hashing:** All candidate image files must be hashed (using cryptographic content hashes such as SHA-256) to identify byte-identical duplicate files across the dataset.
2. **Cross-Split Exclusion:** Identical samples MUST NOT appear across partition boundaries. If duplicate instances exist, they must be deduplicated or restricted strictly to the same partition, ensuring:
   $$\text{ContentHashes}(\text{Train}) \cap \text{ContentHashes}(\text{Val}) = \emptyset, \quad \text{ContentHashes}(\text{Train}) \cap \text{ContentHashes}(\text{Test}) = \emptyset$$
3. **Verification Before Manifest Freezing:** Duplicate detection checks must be executed and verified **before** split manifests are finalized and written to `data/splits/`.
4. **Near-Duplicate & Identity Leakage as Documented Research Risk:**
   While exact duplicate checks eliminate identical byte-level sample sharing, near-duplicate images (e.g., slight variations, minor re-compressions, or different photographic captures of the same underlying human subject/identity) represent a documented research risk. Because automated perceptual hashing and facial identity clustering are not yet implemented in Phase 2, this is formally recognized as an experimental limitation to be monitored and analyzed during evaluation.

---

## 5. PREPROCESSING CONTRACT (M0 BASELINE)

The preprocessing pipeline establishes strict parity between training evaluation and production inference. The canonical implementation in `ml/deepverify_ml/preprocessing/pipeline.py` executes the following deterministic transformations:

```
Raw Media Input (JPEG/PNG)
    │
    ▼
1. Validation & Decode       ── Verify magic bytes; decode to RGB (3-channel). Reject corrupted files.
    │
    ▼
2. Spatial Resize             ── Resize to target dimensions: 224 × 224 pixels (EfficientNet-B0 standard).
                                 Resize strategy: Bilinear interpolation with aspect-ratio preservation / center-crop.
    │
    ▼
3. Channel Scaling            ── Scale pixel intensities from [0, 255] to [0.0, 1.0] floating-point tensor.
    │
    ▼
4. ImageNet Normalization     ── Standard channel normalization:
                                 mean = [0.485, 0.456, 0.406]
                                 std  = [0.229, 0.224, 0.225]
    │
    ▼
Ready Tensor: Shape [3, 224, 224], Float32
```

### Augmentation Boundary
- **Training split only:** Random horizontal flip ($p=0.5$), slight rotation ($\pm 10^\circ$), subtle brightness/contrast jitter ($\pm 0.1$).
- **Validation, Test, and Production Inference:** **STRICTLY DETERMINISTIC.** Zero random operations. Preprocessing for validation, test, and production inference must be byte-for-byte identical.

---

## 6. M0 / EXP-001 EXPERIMENT BOUNDARY

The first ML milestone (M0 / EXP-001) establishes the smallest verifiable spatial baseline. Its boundaries and non-goals are strictly delimited:

```
Input Image (140k dataset)
    │
    ▼
Canonical Preprocessing (224×224, ImageNet norm)
    │
    ▼
Spatial Baseline Model (EfficientNet-B0, ImageNet pretrained)
    │
    ▼
Binary Classification Head (Dropout → Linear(1280, 2))
    │
    ▼
Prediction (Logits → Softmax / Sigmoid Probability)
    │
    ▼
Held-out Evaluation (Test split metrics: Accuracy, Precision, Recall, F1, ROC-AUC)
```

### Explicit Non-Goals for EXP-001 (What is NOT included)
- ❌ **No Frequency Model:** FFT/DCT analysis is excluded (deferred to Phase 4).
- ❌ **No Ensemble:** Multi-model fusion is excluded (deferred to Phase 5).
- ❌ **No Video Processing:** Frame extraction, video decoding, and aggregation are excluded (deferred to Phase 6 & 7).
- ❌ **No Grad-CAM:** Explainability heatmaps are excluded from EXP-001 (Grad-CAM is deferred until the trained spatial baseline is available and the evaluation/explainability phase).
- ❌ **No FastAPI Endpoints:** Backend routes are excluded (deferred to Phase 8).
- ❌ **No React Frontend:** UI integration is excluded (deferred to Phase 8).
- ❌ **No Cloud Deployment:** Docker and cloud hosting are excluded (deferred to Phase 9).

---

## 7. EXPERIMENT RECORD & TRACKING SCHEMA

Every training run must be governed by a configuration YAML under `experiments/configs/EXP-XXX.yaml` and logged to `experiments/registry.csv`.

### Configuration Schema (`experiments/configs/EXP-001.yaml` specification):

> [!NOTE]
> The hyperparameter values listed below (`batch_size`, `epochs`, `optimizer`, `learning_rate`, `weight_decay`, `scheduler`, `mixed_precision`, `dropout_rate`) are **initial candidate/proposed defaults for EXP-001**. They must not be interpreted as immutable Phase 2 decisions. The actual EXP-001 configuration will be frozen when EXP-001 implementation/execution begins.

```yaml
experiment_id: EXP-001-spatial-baseline
description: "Initial EfficientNet-B0 spatial baseline trained on 140k Real/Fake Faces"
tags: ["spatial", "efficientnet-b0", "baseline", "m0"]
seed: 42

dataset:
  name: "140k-real-and-fake-faces"
  version: "1.0"
  split_manifest: "data/splits/140k-split-v1.0.csv"
  split_seed: 42

model:
  architecture: "efficientnet-b0"
  pretrained: true
  weights: "IMAGENET1K_V1"
  num_classes: 2
  dropout_rate: 0.2

preprocessing:
  input_size: [224, 224]
  mean: [0.485, 0.456, 0.406]
  std: [0.229, 0.224, 0.225]
  resize_method: "bilinear_center_crop"

training:
  batch_size: 64
  epochs: 10
  optimizer: "AdamW"
  learning_rate: 0.0001
  weight_decay: 0.01
  loss_function: "CrossEntropyLoss"
  scheduler: "CosineAnnealingLR"
  mixed_precision: true

environment:
  runtime: "Google Colab"
  accelerator: "NVIDIA T4 / A100 GPU"
```

### Recorded Artifact Bundle
Each completed experiment must produce a versioned bundle:
1. `model.pth`: PyTorch model state dictionary.
2. `config.yaml`: Frozen snapshot of the exact config used.
3. `metrics.json`: Final evaluated metrics computed strictly on the held-out test split:
   - `accuracy`, `precision`, `recall`, `f1`, `roc_auc`, and `confusion_matrix`.
4. `README.md`: Model card documenting training data, hyperparameters, limitations, and intended usage.

---

## 8. PRE-TRAINING DATA LEAKAGE CHECKS

Before any training run is initiated, the execution script or test suite MUST verify the following invariants:

1. **Exact File & Content Hash Disjoint Assertion:**
   $$\text{ContentHashes}(\text{Train}) \cap \text{ContentHashes}(\text{Val}) = \emptyset, \quad \text{ContentHashes}(\text{Train}) \cap \text{ContentHashes}(\text{Test}) = \emptyset, \quad \text{ContentHashes}(\text{Val}) \cap \text{ContentHashes}(\text{Test}) = \emptyset$$
   Evaluated across all canonical file paths and cryptographic SHA-256 content hashes before freezing manifests.
2. **Video Grouping Assertion (for video data):**
   $$\text{VideoIDs}(\text{Train}) \cap \text{VideoIDs}(\text{Val}) = \emptyset, \quad \text{VideoIDs}(\text{Train}) \cap \text{VideoIDs}(\text{Test}) = \emptyset$$
3. **No Augmentation in Validation/Test Loader:**
   Assert that evaluation loaders contain zero random transformations.
4. **Frozen Split Manifest Verification:**
   Verify that `split_manifest_sha256` matches the pre-computed manifest hash before instantiating `DataLoader`.
5. **Evaluation Metric Hygiene:**
   Assert that `evaluate()` is called only on `test_loader` and that `train_loader` samples are never passed to benchmark metric computation.

---

## 9. OPEN DECISIONS (TBD) MAPPING

The relation between existing project TBDs and Phase 2 is formalized:

| ID | Open Decision | Status for Phase 2 | Resolution Phase |
|---|---|---|---|
| **TBD-011** | CIFAKE role (training co-data vs. cross-dataset evaluation only) | **Phase 2 working decision:** CIFAKE is excluded from EXP-001/M0 and reserved for later cross-dataset evaluation, subject to confirmation after baseline evaluation. Preserved as a future experimental decision. | Post-M0 baseline evaluation |
| **TBD-001** | Frequency-domain model architecture | **Deferred:** Does not affect Phase 2. Spatial baseline proceeds independently. | Phase 4 |
| **TBD-002** | Ensemble strategy | **Deferred:** Does not affect Phase 2. | Phase 5 |
| **TBD-003** | Video frame aggregation strategy | **Deferred:** Does not affect Phase 2. | Phase 7 |
| **TBD-004** | Grad-CAM target layer selection | **Deferred:** Grad-CAM is deferred until the trained spatial baseline is available and the evaluation/explainability phase. | Evaluation/explainability phase |
| **TBD-005** | Face detection library for FF++ | **Deferred:** Does not affect Phase 2 (140k faces are pre-cropped). | Phase 6 |
| **TBD-006** to **TBD-013** | Backend, persistence, hosting, and calibration | **Deferred:** Product/deployment concerns; zero impact on Phase 2 data contract. | Phases 8 & 9 |

---

## 10. VERIFICATION GATE & ACCEPTANCE CRITERIA

Phase 2 Data & ML Pipeline Contract and Implementation are verified when the following criteria are met:

- [x] **Inventory Complete:** 140k, CIFAKE, and FF++ documented with modalities, purposes, and boundary scopes.
- [x] **Lineage Protocol Established:** Provenance manifest schema defined with checksums and sample counts; lineage recorded at `docs/research/manifests/140k-lineage.json`.
- [x] **Directory Layout Contracted:** `data/raw/`, `data/processed/`, and `data/metadata/` are ignored by `.gitignore` and no raw media is committed. `data/splits/` is version-controlled: immutable split manifests (lightweight CSV, no image binaries) are tracked in Git to guarantee reproducibility and remote/Colab execution.
- [x] **Split & Leakage Invariants Formalized & Verified:** Split ratios (70/15/15, 98k/21k/21k), pre-augmentation splitting (seed 42), exact duplicate content hashing (SHA-256 cross-split disjointness), and 50/50 class balance verified.
- [x] **Preprocessing Parity Implemented:** Canonical 224×224 ImageNet normalization pipeline implemented (`ml/deepverify_ml/preprocessing/pipeline.py`) with training-only augmentations (flip $p=0.5$, rotation $\pm 10^\circ$, jitter $\pm 0.1$) and strictly deterministic validation/test/inference evaluation.
- [x] **M0 Boundary Constrained:** EfficientNet-B0 spatial baseline strictly isolated from frequency models, ensembles, video, Grad-CAM, and APIs.
- [x] **Experiment Tracking Schema Defined:** YAML config structure and metrics reporting requirements specified with initial candidate defaults for EXP-001.
- [x] **Leakage Checks Automated & Passing:** Pre-training assertions automated in test suite (`ml/tests/test_phase2_pipeline.py`) passing 18/18 tests.
- [x] **Phase 2 Implementation Scope Boundary Maintained:** Phase 2 contract approved, data pipeline implemented, and verification completed. Implementation remains strictly limited to data acquisition, lineage documentation, deterministic splitting, canonical preprocessing, validation, and tests. No model training, checkpoint creation, or EXP-001 execution has occurred; backend and frontend remain out of scope / not started.
