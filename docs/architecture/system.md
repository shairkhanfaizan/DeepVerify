# DeepVerify — System Architecture Specification

> **Status:** APPROVED — Phase 1, Architecture & Contracts  
> **Source of truth:** `docs/DeepVerify_Development_Blueprint.docx`, `docs/architecture/DeepVerify_Architecture_Audit.md`, `.agents/rules/`  
> **Scope:** Logical boundaries, responsibilities, and data paths. Does not define implementation code.

---

## 1. LOGICAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                   REACT FRONTEND (Vite/TS)              │
│  Upload UI · Progress States · Verdict Card             │
│  Confidence Display · Heatmap Viewer · Frame Timeline   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / JSON  (/api/v1/)
                         ▼
┌─────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (Python, async)            │
│  Media Validation · UUID Assignment · Orchestration     │
│  Result Storage · Grad-CAM Serving · Structured Errors  │
└──────────┬───────────────────────────┬──────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────┐   ┌───────────────────────────┐
│  INFERENCE ENGINE    │   │  PERSISTENCE LAYER        │
│  (deepverify_ml      │   │  SQLite / PostgreSQL      │
│   Python package)    │   │  (TBD — ADR-005)          │
│  load_model()        │   │  analyses table           │
│  preprocess()        │   │  analysis_frames table    │
│  infer()             │   │  (future — Phase 7)       │
│  postprocess()       │   └───────────────────────────┘
│  explain()           │   ┌───────────────────────────┐
└──────────┬───────────┘   │  EXTERNAL STORAGE         │
           │               │  Hugging Face Hub         │
           ▼               │  (Preferred option)       │
┌──────────────────────┐   │  Abstract model loader    │
│  MODEL ARTIFACTS     │   └───────────────────────────┘
│  .pth checkpoints    │
│  (loaded at startup) │
└──────────────────────┘
```

---

## 2. LAYER RESPONSIBILITIES

### 2.1 Frontend (`frontend/`)

**Responsibilities:**
- Provide file upload interface (images and videos).
- Display 8 UX states: `IDLE → UPLOADING → VALIDATING → PROCESSING → ANALYZING → GENERATING_EXPLANATION → COMPLETED → FAILED`.
- Render verdict card with calibrated language (per `confidence.md` — never "FAKE — CERTAIN").
- Render confidence breakdown (per-model scores if available).
- Render Grad-CAM heatmap viewer: Original | Heatmap | Overlay.
- Render per-frame probability timeline (video, Phase 7+).
- Poll for results via `GET /api/v1/results/{request_id}`.
- Display structured error states.

**Hard Boundaries — Frontend MUST NOT:**
- Contain any ML inference logic.
- Know any secrets, database credentials, or model storage tokens.
- Communicate with model storage (Hugging Face) directly.
- Perform upload validation beyond UX-level hints (real validation is backend-only).
- Claim results as factual certainty (must follow confidence calibration rules).

**Known configuration:**
- Knows only `VITE_API_BASE_URL` — the public backend API base URL.

---

### 2.2 Backend (`backend/`)

**Responsibilities:**
- Receive media uploads over HTTP.
- Assign a server-side UUID (`request_id`) to each submission before touching the filesystem.
- Validate all uploads strictly before processing (see Section 5 — Media Validation Contract).
- Store uploads in a server-controlled temporary path (never trusting client-supplied filenames).
- Orchestrate the inference pipeline by calling the `deepverify_ml` inference package.
- Invoke FFmpeg via safe argument lists (no shell interpolation) for video frame extraction.
- Store analysis results in the database.
- Serve Grad-CAM heatmap images.
- Return structured JSON responses (success and error).
- Own and manage all secrets (database credentials, HF token, etc.).
- Log inference events safely (never log PII, binary payloads, or credentials).

**Hard Boundaries — Backend MUST NOT:**
- Execute training loops, gradient updates, or dataset loaders.
- Import `ml/training/` or any training module.
- Trust client-supplied filenames for filesystem paths.
- Expose database credentials or model storage tokens in API responses.
- Interpolate user-controlled values into shell commands or subprocesses.

**Production backend execution model:**
```
load_model() → preprocess() → infer() → postprocess() → [explain()] → result
```

---

### 2.3 ML Inference Layer (`ml/deepverify_ml/`)

**Responsibilities:**
- Expose a stable `ModelInterface` that all production inference models implement.
- Provide shared `preprocess()` logic used by both training and inference (single canonical implementation).
- Provide `infer()` — takes preprocessed tensor, returns structured `PredictionResult`.
- Provide `explain()` — generates Grad-CAM heatmap for a given input (optional, Phase 3+).
- Load model weights from a file path provided by the backend at startup.

**Hard Boundaries — ML package MUST NOT:**
- Import FastAPI, SQLAlchemy, React, or any backend/frontend concern.
- Contain training loops in the inference modules.
- Differ in preprocessing logic between training and inference.
- Make HTTP calls or access the database.

**Training separation:**
- `ml/deepverify_ml/training/` — training scripts, invoked only via CLI in Colab. Never imported by backend.
- `ml/deepverify_ml/evaluation/` — evaluation metrics, run on held-out test sets only. Never run in production.
- `ml/deepverify_ml/preprocessing/` — shared preprocessing. Imported by both training and inference.
- `ml/deepverify_ml/models/` — model architecture definitions and `ModelInterface`.

---

### 2.4 Model Artifacts

- **Preferred storage:** **Hugging Face Hub** (see ADR-004).
- The storage interface is kept abstract: backend model loader loads from a local filesystem path or configurable resolver (`resolve_model_path()`), preventing irreversible vendor lock-in.
- Naming convention: `deepverify-spatial-v1.0`, `deepverify-frequency-v1.0`, `deepverify-ensemble-v1.0`.
- Each artifact bundle contains: `model.pth` + `config.yaml` + `metrics.json` + `README.md` (model card).
- Backend loads artifacts at startup via path configured in `.env`.
- Model weights are ignored by Git and never committed.

---

### 2.5 Persistence Layer

- **Technology:** **TBD — Unresolved** (PostgreSQL vs. SQLite — see ADR-005).
- Finalized prior to persistence implementation (Phase 8) based on:
  - Zero-cost deployment feasibility
  - Concurrency requirements
  - Persistence requirements across container lifecycles
  - Video and frame-level result storage volume
  - Hosting platform filesystem constraints
- **MVP Tables:**
  - `analyses` — `id`, `request_id` (UUID), `media_type`, `model_version`, `verdict`, `confidence`, `processing_time_ms`, `status`, `error_code`, `created_at`
- **Phase 7+ Tables:**
  - `analysis_frames` — `id`, `analysis_id` (FK), `frame_index`, `timestamp_ms`, `score`, `verdict`
- **Heatmap storage:** TBD — decision required before implementation (TBD-007).

---

### 2.6 External Storage

- **Model artifacts:** Hugging Face Hub (current preferred option; abstract loader boundary ensures alternative storage providers can be adopted via future ADR if required).
- **Heatmap/media file storage:** TBD — decision required before implementation (TBD-007).

---

## 3. DATA PATHS

### 3.1 Image Analysis Path

```
User → Upload image → Frontend
→ POST /api/v1/analyze/image
→ Backend: assign UUID, validate (MIME/magic bytes/size/resolution)
→ Save to tmp/{uuid}/original.{ext}
→ Invoke deepverify_ml.preprocess(image_path)
→ Invoke deepverify_ml.infer(tensor) → PredictionResult
→ Invoke deepverify_ml.explain(tensor, model) → heatmap image
→ Store heatmap to storage/{uuid}/heatmap.png
→ Write result to analyses table
→ Return 202 Accepted + {request_id}
→ Frontend polls GET /api/v1/results/{request_id}
→ Backend returns AnalysisResult JSON
→ Frontend renders VerdictCard + HeatmapViewer
```

### 3.2 Video Analysis Path

```
User → Upload video → Frontend
→ POST /api/v1/analyze/video
→ Backend: assign UUID, validate (MIME/magic bytes/size/duration/frames)
→ Save to tmp/{uuid}/original.{ext}
→ FFmpeg (arg list, no shell) → extract N frames to tmp/{uuid}/frames/
→ For each sampled frame:
    → deepverify_ml.preprocess(frame)
    → deepverify_ml.infer(tensor) → per-frame PredictionResult
→ Aggregate frame scores → video-level verdict
   [aggregation strategy: TBD — EXP-007]
→ Optionally generate heatmap for highest-confidence frame
→ Write result + per-frame scores to analyses + analysis_frames tables
→ Return 202 Accepted + {request_id}
→ Frontend polls GET /api/v1/results/{request_id}
→ Frontend renders VerdictCard + FrameTimeline
```

### 3.3 Explainability Path

```
Spatial model inference (image or video frame)
→ deepverify_ml.explain(tensor, model, target_layer)
→ Grad-CAM hook registers on target_layer [layer: TBD — Phase 3 decision]
→ Forward pass → extract gradients and activations
→ Compute heatmap → overlay on original image
→ Save heatmap PNG to storage
→ Return heatmap_url in AnalysisResult.explanation
→ Frontend renders three-panel viewer: Original | Heatmap | Overlay

IMPORTANT: Grad-CAM shows where model representation activated.
It does NOT prove which pixels were manipulated (per confidence.md).
```

### 3.4 Training Workflow

```
Experiment design → YAML config (experiments/configs/EXP-XXX.yaml)
→ Git commit config (not weights)
→ Colab: git clone DeepVerify repo
→ Colab: pip install -e ml/
→ Colab: python -m deepverify_ml.training.train --config experiments/configs/EXP-XXX.yaml
→ Training runs on Colab GPU
→ Validation metrics computed on held-out val set (never training set)
→ Checkpoint saved: model.pth + config.yaml + metrics.json
→ Checkpoint pushed to Hugging Face Hub
→ experiments/registry.csv updated with EXP-XXX entry
→ Training ENDS — no backward() in production backend
```

---

## 4. TRAINING / INFERENCE SEPARATION

This is a hard architectural invariant (see `architecture.md`):

| Concern | Training | Inference |
|---|---|---|
| Module location | `ml/deepverify_ml/training/` | `ml/deepverify_ml/models/` (via `ModelInterface`) |
| Execution environment | Google Colab (GPU) | Backend server (CPU/GPU) |
| Imports in backend | ❌ NEVER | ✅ Only inference interface |
| Data loaders | ✅ Used in training | ❌ Never in production |
| `backward()` / optimizer | ✅ Used in training | ❌ Never in production |
| Preprocessing | Shared `preprocessing.py` | Same shared `preprocessing.py` |
| Runs in CI | ❌ Never (too slow) | ✅ Shape/load tests only |

---

## 5. OPEN DECISIONS (TBD)

The following architecture decisions are **intentionally unresolved** at this stage. They must not be implemented until each is formally decided and an ADR is written.

| # | Topic | Blocking Phase |
|---|---|---|
| TBD-001 | Frequency-domain model architecture (MLP / CNN-spectrogram / other) | Phase 4 |
| TBD-002 | Ensemble strategy (mean / weighted / learned) | Phase 5 |
| TBD-003 | Video frame aggregation strategy (mean / median / top-k) | Phase 7 |
| TBD-004 | Grad-CAM target layer selection for EfficientNet-B0 | Phase 3 |
| TBD-005 | Face detection library for FF++ processing (MTCNN / dlib / MediaPipe) | Phase 6 |
| TBD-006 | Asynchronous task handling (FastAPI background tasks / Celery / other) | Phase 8 |
| TBD-007 | Heatmap / media file storage (local filesystem / object storage) | Phase 8 |
| TBD-008 | Backend hosting platform (Render / Railway / Fly.io) | Phase 9 |
| TBD-009 | Video frame sampling strategy (every N sec / uniform / keyframe) | Phase 7 |
| TBD-010 | Confidence calibration methodology (Platt scaling / temperature scaling) | Phase 8+ |
| TBD-011 | CIFAKE role (training co-data / cross-dataset evaluation only) | Phase 2 |
| TBD-012 | `regions` field structure in explanation response (Phase 3+) | Phase 3 |
| TBD-013 | Database technology selection (ADR-005: SQLite vs. PostgreSQL) | Phase 8 |
