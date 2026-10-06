# DeepVerify — Architecture Audit Report

> **Status:** AUDIT ONLY — No implementation has begun. Awaiting approval.  
> **Based on:** `docs/DeepVerify_Development_Blueprint.docx` (56 sections)  
> **Date:** 2026-10-03

---

## 1. PROJECT UNDERSTANDING

DeepVerify is a 5th-semester university project built to research and demonstrate AI-generated and manipulated media detection. It is not intended to be a universal deepfake detector. The system analyzes images (and eventually video) to produce a verdict on whether the media is likely authentic or AI-generated/manipulated, and it backs that verdict with **visual explainability evidence** (Grad-CAM heatmaps).

The project is framed as **academic but production-engineered** — meaning it follows real software engineering discipline (monorepo, CI/CD, contract-first API, experiment tracking) while being honest about its research limitations (generalization, compression, dataset scope). The blueprint explicitly rejects the "prototype notebook" approach and demands that training, inference, and product code remain clearly separated.

The system is meant to produce not just a demo, but a **defensible research story**: documented experiments, recorded metrics, stated limitations, and reproducible results that can be explained in a university viva.

---

## 2. SYSTEM PURPOSE

### What the system DOES:
- Accepts image (and later video) uploads
- Analyzes them using an EfficientNet-B0 spatial model
- Optionally runs a frequency-domain (FFT/DCT) classifier
- Combines both via ensemble voting/weighting
- Generates Grad-CAM heatmaps showing which image regions activated the model
- For video: samples frames, analyzes each, aggregates frame scores into a video-level verdict
- For facial manipulation (FF++): crops faces, applies manipulation-specific processing
- Returns a structured JSON result with: verdict, per-model confidence scores, heatmap URL, request ID, processing time
- Stores results in a database (analyses table)
- Serves results via a FastAPI REST API consumed by a React frontend

### What the system EXPLICITLY DOES NOT claim to do:
- Does **not** detect every type of AI-generated image or deepfake
- Does **not** claim results are factually certain (confidence ≠ truth)
- Does **not** generalize beyond evaluated datasets (140k Real/Fake, CIFAKE, FF++)
- Does **not** handle compression robustness as a solved problem — it is an **experiment**
- Does **not** claim cross-generator generalization beyond what experiments demonstrate
- Does **not** run training in production (training is strictly an experiment process)

---

## 3. CORE ARCHITECTURE

### Frontend
- **Technology:** React (TypeScript), feature-oriented folder structure
- **Responsibilities:** Upload UI, analysis progress display (8 distinct UX states), verdict card, confidence breakdown, Grad-CAM heatmap viewer (Original | Heatmap | Overlay), frame probability timeline for video, model info display
- **Key principle:** Frontend never contains ML inference logic. Only knows `NEXT_PUBLIC_API_URL`; never holds secrets.
- **Key components:** `UploadDropzone`, `AnalysisProgress`, `VerdictCard`, `ConfidenceBreakdown`, `HeatmapViewer`, `FrameTimeline`, `ModelInfo`, `ErrorState`
- **UX states:** `IDLE → UPLOADING → VALIDATING → PROCESSING → ANALYZING → GENERATING_EXPLANATION → COMPLETED → FAILED`

### Backend
- **Technology:** FastAPI (Python), async, Pydantic validation
- **Responsibilities:** Upload handling and validation, orchestration of ML inference, result storage, Grad-CAM serving, API versioning (`/api/v1/`), logging, structured error responses
- **Key principle:** Backend owns secrets and orchestration. Production backend never executes `train.py`.
- **Database (MVP):** `analyses` table (id, request_id, media_type, model_version, verdict, confidence, processing_time, created_at); later `analysis_frames` table for video
- **Containerized** via Docker for deployment

### ML Layer
- **Technology:** PyTorch, EfficientNet-B0 (via `timm`), OpenCV, FFmpeg
- **Training environment:** Google Colab (GPU) — clones repo, installs package, runs scripts
- **Development environment:** Antigravity IDE
- **Key principle:** Training (`ml/training/`) and inference (`ml/inference/`) are in completely separate modules. Production only does `load_model()` + `model.predict()`.
- **Preprocessing:** Shared `preprocessing.py` used by both training and inference — never duplicated

### Data Layer
- **Datasets:** 140k Real/Fake, CIFAKE, FaceForensics++ (FF++)
- **Structure:** `data/raw/` → `data/interim/` → `data/processed/` — all ignored by Git
- **Git contains only:** `datasets/README.md` with download instructions, checksums, license terms, split instructions
- **Raw data is never overwritten, never committed to Git**

### Explainability
- **Technology:** Grad-CAM
- **Output:** Heatmap image (URL returned in API response)
- **Framing:** Evidence of where model representation was activated, NOT proof that a region "caused" fakeness
- **UI display:** Three-panel view — Original | Heatmap | Overlay

### Video Processing
- **Approach:** Frame sampling (not every frame by default)
- **Data leakage rule:** Frames from the same source video must stay in the same train/val/test split
- **Aggregation:** Experimentally compared — mean, median, top-k mean (not hardcoded)
- **Output:** `frame_probability[]` array, rendered as probability timeline in UI
- **Format support:** Videos processed via FFmpeg; validated for size, duration, frame count, resolution

### Persistence
- **MVP:** SQLite or similar lightweight DB — `analyses` table
- **Later:** `analysis_frames` table for per-frame video results
- **Result IDs:** UUID-based `request_id` for polling via `GET /api/v1/results/{request_id}`
- **Model artifacts:** Stored on Hugging Face (NOT in Git)

### Deployment
- **Constraint:** ₹0 budget — free infrastructure tier
- **Frontend:** Vercel (static hosting)
- **Backend:** Free-tier cloud host (e.g., Render, Railway, or similar)
- **Model artifacts:** Hugging Face Hub
- **Containerization:** Docker (`backend/Dockerfile`)
- **Goal:** Reliability during demo + simple deployment, NOT millions-of-users scale
- **HTTPS required**

---

## 4. ML PIPELINE

The intended ML pipeline in strict build-order:

```
1. Dataset preparation
   → 140k Real/Fake images → split by image (no video leakage concern here)
   → CIFAKE → similar split
   → FF++ → split by SOURCE VIDEO (not by frame)

2. EfficientNet-B0 spatial model
   → pretrained weights (ImageNet)
   → fine-tuned on 140k Real/Fake
   → evaluated: Accuracy, Precision, Recall, F1, ROC-AUC
   → checkpoint saved with config + metrics

3. Grad-CAM explainability
   → applied to spatial model
   → heatmap generation and overlay

4. Frequency-domain model
   → FFT/DCT feature extraction
   → classifier (architecture TBD — see ambiguities)
   → evaluated independently

5. Ensemble
   → combine spatial + frequency scores
   → aggregation strategy is an EXPERIMENT (mean, weighted, learned)
   → evaluated vs. individual models

6. FF++ / facial manipulation processing
   → frame extraction from FF++ videos
   → face detection and cropping
   → fine-tuning / evaluation for facial manipulation detection
   → evaluated separately from general AI-generated image detection

7. Video inference
   → frame sampling from input video
   → per-frame prediction using spatial (and optionally ensemble) model
   → frame-level scores → video-level aggregation (experiment: mean/median/top-k)
   → video-level verdict

8. Final model export
   → versioned checkpoint (spatial-v1.0, frequency-v1.0, ensemble-v1.0)
   → stored to Hugging Face
   → model card with dataset, config, metrics, limitations
```

---

## 5. DEVELOPMENT PHASES

Exactly as prescribed by the blueprint (Section 48 + Section 56):

| Phase | Name | Key Deliverables |
|---|---|---|
| **Phase 1** | Foundation | Monorepo skeleton, `.agents/rules`, CI, Docker, API contract (frozen), frontend/backend skeletons |
| **Phase 2** | Spatial Baseline | 140k dataset pipeline, EfficientNet-B0 fine-tuning, evaluation metrics, checkpoint |
| **Phase 3** | Explainability | Grad-CAM heatmap generation, overlay, integrated into inference |
| **Phase 4** | Frequency Model | FFT/DCT feature extraction, classifier training, independent evaluation |
| **Phase 5** | Ensemble | Ensemble strategy as experiment, comparison vs. individual models |
| **Phase 6** | FF++ | Frame extraction, face detection/cropping, manipulation-specific training/evaluation |
| **Phase 7** | Video | Frame sampling pipeline, per-frame inference, aggregation experiments |
| **Phase 8** | Product | FastAPI endpoints wired to ML, React UI fully connected, upload → result flow |
| **Phase 9** | Deployment | Docker, Vercel frontend, free backend host, Hugging Face model storage, HTTPS |
| **Phase 10** | Hardening | Full test suite, security audit, error handling, logging, performance, documentation, demo hardening |

**Immediate execution order (Section 56):**
```
01  Create GitHub repo
02  Create monorepo skeleton
03  Create .agents/rules
04  Put project specification in docs/
05  Have Antigravity architect the repo
06  Freeze API contract
07  Build ML dataset pipeline
08  Run ONE baseline training experiment
09  Save first checkpoint + metrics
10  Build standalone inference
11  Add Grad-CAM
12  Build frequency model
13  Ensemble
14  FF++ processing
15  Video inference
16  FastAPI
17  React
18  Integration
19  Testing/security
20  Deploy
21  Demo hardening
22  Documentation/report
```

---

## 6. REPOSITORY STRUCTURE

Monorepo layout as specified:

```
deepverify/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CHANGELOG.md
├── .gitignore
├── .env.example
├── Makefile
├── docker-compose.yml
│
├── docs/
│   ├── architecture/
│   │   ├── system.md
│   │   ├── ml-pipeline.md
│   │   ├── inference.md
│   │   └── deployment.md
│   ├── api/
│   │   └── openapi.yaml
│   ├── decisions/
│   │   ├── ADR-001-monorepo.md
│   │   ├── ADR-002-model-versioning.md
│   │   ├── ADR-003-inference-hosting.md
│   │   └── ...
│   └── research/
│       ├── datasets.md
│       ├── experiments.md
│       └── limitations.md
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── features/
│       │   ├── upload/
│       │   ├── analysis/
│       │   └── history/
│       ├── api/
│       ├── hooks/
│       ├── types/
│       ├── utils/
│       └── App.tsx
│
├── backend/
│   └── app/
│       ├── main.py
│       ├── api/
│       │   └── routes/
│       │       ├── health.py
│       │       ├── analysis.py
│       │       └── results.py
│       ├── core/
│       │   ├── config.py
│       │   ├── logging.py
│       │   └── security.py
│       ├── schemas/
│       │   ├── analysis.py
│       │   └── results.py
│       └── services/
│           ├── analysis_service.py
│           ├── video_service.py
│           └── storage_service.py
│
├── ml/
│   ├── configs/
│   │   ├── spatial_baseline.yaml
│   │   ├── spatial_v1.yaml
│   │   └── ensemble_v1.yaml
│   ├── src/
│   │   └── deepverify_ml/
│   │       ├── data/
│   │       ├── models/
│   │       ├── training/
│   │       ├── evaluation/
│   │       ├── inference/
│   │       ├── explainability/
│   │       └── utils/
│   ├── scripts/
│   │   ├── prepare_dataset.py
│   │   ├── train_spatial.py
│   │   ├── train_frequency.py
│   │   ├── evaluate.py
│   │   └── export_model.py
│   ├── notebooks/
│   │   ├── 01_dataset_exploration.ipynb
│   │   ├── 02_baseline.ipynb
│   │   └── 03_error_analysis.ipynb
│   └── artifacts/
│       └── .gitkeep
│
├── datasets/
│   └── README.md
│
├── experiments/
│   ├── README.md
│   └── registry.csv
│
├── .agents/
│   ├── rules/
│   │   ├── architecture.md
│   │   ├── python.md
│   │   ├── frontend.md
│   │   ├── ml.md
│   │   ├── testing.md
│   │   └── security.md
│   └── skills/
│       ├── train-model/
│       ├── evaluate-model/
│       ├── backend-feature/
│       └── release/
│
└── .github/
    └── workflows/
        ├── backend-ci.yml
        ├── frontend-ci.yml
        └── ml-validation.yml
```

---

## 7. API CONTRACT

### Frozen inference result schema (Section 15):

```json
{
  "request_id": "uuid",
  "media_type": "image",
  "model_version": "spatial-v1.0",
  "verdict": "LIKELY_AI_GENERATED",
  "confidence": 0.94,
  "scores": {
    "spatial": 0.95,
    "frequency": 0.91,
    "ensemble": 0.94
  },
  "explanation": {
    "heatmap_url": "...",
    "regions": []
  },
  "processing_time_ms": 1420
}
```

### API endpoints (Section 16):

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Root health check |
| `GET` | `/api/v1/health` | Versioned health check |
| `POST` | `/api/v1/analyze/image` | Submit image for analysis |
| `POST` | `/api/v1/analyze/video` | Submit video for analysis |
| `GET` | `/api/v1/results/{request_id}` | Poll for result |
| `GET` | `/api/v1/models` | List available model versions (later) |

### API versioning: All endpoints under `/api/v1/` from day one.

### Error response schema (Section 38):

```json
{
  "error": {
    "code": "UNSUPPORTED_MEDIA_TYPE",
    "message": "The uploaded file format is not supported.",
    "request_id": "abc123"
  }
}
```

**Defined error codes:** `INVALID_FILE`, `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `VIDEO_TOO_LONG`, `FACE_NOT_DETECTED`, `PROCESSING_FAILED`, `MODEL_UNAVAILABLE`, `INTERNAL_ERROR`

---

## 8. SECURITY REQUIREMENTS

From `.agents/rules/security.md` and Section 18–20:

1. **Never commit secrets** — `.env` in `.gitignore`, only `.env.example` committed
2. **Never hardcode API keys** anywhere
3. **Never expose model storage credentials to frontend** — frontend only knows `NEXT_PUBLIC_API_URL`
4. **Backend owns all secrets** — HuggingFace token, DB password, backend secret, storage credentials
5. **Upload validation is mandatory:**
   - MIME type check
   - File extension check
   - Actual file signature (magic bytes) check
   - File size limit (starting value: images 10 MB, videos 100 MB)
   - Video duration limit (starting value: 60 sec)
   - Frame count limit (starting value: 300 frames)
   - Resolution check
   - Decompression bomb protection
6. **Never trust uploaded filenames** — sanitize all user-controlled paths
7. **Store uploads outside executable paths**
8. **Request Review mode** for: `rm`, `sudo`, `pip`, `npm install`, `git`, `docker`, database migrations, deployment, environment changes

### Logging security:
- Never log: passwords, tokens, private credentials
- Be careful logging uploaded media (privacy concern)
- Log per-inference: `request_id`, `timestamp`, `model_version`, `media_type`, `processing_time`, `status`, `error_code`

---

## 9. ML/RESEARCH REQUIREMENTS

### Datasets
| Dataset | Purpose | Notes |
|---|---|---|
| 140k Real/Fake | Primary spatial model training | General AI-generated image detection |
| CIFAKE | Additional training/evaluation | Cross-dataset generalization experiment |
| FaceForensics++ (FF++) | Facial manipulation detection | Requires access request; retain license/terms |

### Data Leakage Prevention (CRITICAL)
- For video datasets: **split by source video**, never by individual frame
- Dataset splitting must happen **before augmentation**
- Training data must never contaminate validation or test sets
- Never evaluate on training data

### Experiment Tracking
Every experiment must record:
- Experiment ID (e.g., `EXP-001`)
- Git commit hash
- Dataset name + version
- Random seed
- Python version, PyTorch version, CUDA version
- Model name + pretrained state
- All hyperparameters (from config YAML — never hardcoded)
- Validation metrics (Accuracy, Precision, Recall, F1, ROC-AUC)
- Checkpoint path

### Reproducibility
- All hyperparameters in YAML config files (`ml/configs/`)
- Configs passed as `--config` argument to training scripts
- Results stored in `experiments/registry.csv`
- Every model checkpoint includes: `model.pth` + `config.yaml` + `metrics.json` + `README.md`

### Evaluation Metrics
- Accuracy, Precision, Recall, F1, ROC-AUC (at minimum)
- **Must not be invented** — must be computed from held-out test sets
- Confidence display in UI must reflect model output, not claim factual certainty

### Planned Experiments
| ID | Experiment |
|---|---|
| EXP-001 | Baseline EfficientNet-B0 on 140k |
| EXP-002 | EfficientNet fine-tuning variations |
| EXP-003 | Frequency (FFT/DCT) model |
| EXP-004 | Ensemble (spatial + frequency) |
| EXP-005 | Compression robustness |
| EXP-006 | Cross-generator generalization |
| EXP-007 | Video aggregation strategy comparison (mean/median/top-k) |

### Generalization and Compression Experiments
- Cross-generator generalization: trained on one generator, tested on another
- Compression experiments: evaluate under JPEG/video compression artifacts
- Results must document where the model fails, not just where it succeeds

### Model Comparison Requirements
- Spatial model alone vs. frequency model alone vs. ensemble
- Different aggregation strategies for video
- All comparisons must be ablation studies with controlled conditions

---

## 10. TESTING REQUIREMENTS

### Testing Pyramid (Section 28):

**Unit tests:**
```
test_face_crop()
test_fft_features()
test_video_sampling()
test_prediction_schema()
test_confidence_mapping()
```

**Integration tests:**
```
upload image → API → model → result
```

**End-to-end tests:**
- Full application flow from upload to rendered verdict

**ML-specific tests (run in CI on every push):**
```
model loads correctly
input shape is correct
output range is [0, 1]
checkpoint is compatible with current code
preprocessing is identical between training and inference
```

### Critical ML Testing Rule (Section 29):
Preprocessing used during training and inference must use the **same shared implementation** (`ml/src/.../preprocessing.py`). Any divergence is a bug.

### CI/CD Test Suite (Section 34):

| Layer | Tools |
|---|---|
| Frontend | ESLint, TypeScript, Vitest, Build |
| Backend | Ruff, Pytest, MyPy (optional) |
| ML | Import tests, shape tests, preprocessing tests, model-load test |

> **Training is never run in CI.** Only lightweight ML validation tests run on push.

### Definition of Done (Section 53):

**For every feature:**
- [ ] Code implemented
- [ ] Tests written and passing
- [ ] Error handling implemented
- [ ] Logging added where appropriate
- [ ] Security considered
- [ ] Documentation updated
- [ ] API contract updated if needed
- [ ] No secrets committed
- [ ] Lint/type checks passing
- [ ] Git diff reviewed
- [ ] Agent explains what changed

**For every ML experiment:**
- [ ] Dataset documented
- [ ] Split validated (no leakage)
- [ ] Experiment ID created
- [ ] Seed recorded
- [ ] Config saved
- [ ] Metrics recorded
- [ ] Checkpoint saved
- [ ] Evaluation completed
- [ ] Error analysis performed
- [ ] Limitations documented

---

## 11. DEPLOYMENT REQUIREMENTS

- **Constraint:** ₹0 budget — free-tier infrastructure
- **Frontend:** Vercel static hosting
- **Backend:** Dockerized FastAPI — free-tier cloud host (Render/Railway/similar)
- **Model artifacts:** Hugging Face Hub (separate from Git repo)
- **Database:** Managed or SQLite (within free tier constraints)
- **HTTPS required** for all public endpoints
- **Model storage:** Structured as `deepverify-spatial-v1`, `deepverify-frequency-v1` etc. on HuggingFace
- **Model card on HuggingFace must include:** dataset used, training config, evaluation results, limitations, license/usage info
- **Docker image contents:** Python + FastAPI + PyTorch + OpenCV + FFmpeg + DeepVerify inference package
- **Goal:** Reliable during demo, not production-scale

### CI/CD pipeline (Section 34):
- GitHub Actions runs tests on every push
- Frontend: lint + type-check + Vitest + build
- Backend: Ruff + Pytest
- ML: lightweight validation only
- **Full model training never runs in CI**

---

## 12. RISKS AND AMBIGUITIES

The following items need clarification before implementation begins:

### 🔴 High Priority (blockers)

1. **Frequency-domain model architecture is unspecified.**  
   The blueprint mentions "FFT/DCT features + classifier" but does not specify whether this is a simple MLP, a CNN on spectrograms, or something else. Needs a decision before Phase 4.

2. **Ensemble strategy is undefined.**  
   The blueprint says to treat aggregation as an experiment (mean, weighted, learned), but the initial architecture/API contract needs a fallback for when only the spatial model is available. Does the API return `scores.frequency` and `scores.ensemble` as null when those models aren't available yet?

3. **FF++ access and license must be verified.**  
   FaceForensics++ requires a formal access request to the authors. This needs to happen early since it gates Phase 6. The blueprint mentions retaining "terms and access information" but doesn't confirm access has been granted.

4. **Database technology not specified.**  
   The blueprint mentions a `analyses` table but does not name the database (SQLite for MVP? PostgreSQL?). This affects deployment architecture and ORM choice.

5. **Backend hosting platform not finalized.**  
   "Free-tier cloud host" is mentioned but not named. Render, Railway, Fly.io, and Hugging Face Spaces all have different constraints for PyTorch/GPU inference. This needs a concrete choice since GPU inference on free tier may not be viable.

### 🟡 Medium Priority (design decisions needed)

6. **Grad-CAM target layer is unspecified.**  
   EfficientNet-B0 has multiple candidate layers for Grad-CAM. The specific layer needs to be selected and documented as an ADR.

7. **Face detection library not specified.**  
   For FF++ processing, which face detector is used? MTCNN? dlib? MediaPipe? Each has different accuracy/speed tradeoffs and licensing.

8. **Asynchronous handling not fully designed.**  
   The blueprint mentions "asynchronous handling" as part of the backend layer but does not specify whether this means Celery, FastAPI background tasks, or something else. For video, inference could take 10–60 seconds — the queue/polling architecture needs a decision.

9. **Video frame sampling rate not specified.**  
   "Sample frames" is proposed but the sampling strategy (every N seconds, every N frames, uniform, keyframe-based) is not defined. This affects both inference speed and accuracy.

10. **CIFAKE role not fully described.**  
    CIFAKE is listed as a dataset but its role in the ML pipeline is ambiguous. Is it used for training alongside 140k Real/Fake, for evaluation only, or for cross-dataset generalization experiments exclusively?

11. **Frontend framework version not specified.**  
    React is specified but not whether this is a Next.js app, a Vite/CRA app, or standalone React. This affects routing, SSR, and deployment on Vercel.

12. **`regions` field in explanation schema is empty.**  
    The inference contract has `"regions": []` in the explanation but no specification for what region objects look like. Is this for bounding boxes over suspicious areas? Needs definition.

### 🟢 Low Priority (can be decided during implementation)

13. **Augmentation strategy for training not specified.**  
    The blueprint says "augmentation happens after splitting" but doesn't specify what augmentations are used.

14. **Calibration of confidence scores is mentioned but not detailed.**  
    Section 24 warns against claiming certainty without calibration — but calibration methodology (Platt scaling, temperature scaling) is not specified.

15. **Video output formats and codecs are not specified.**  
    What video formats (MP4, AVI, MOV) are accepted? What codecs?

---

## 13. REQUIREMENTS THAT SHOULD BECOME PROJECT RULES

The following should be encoded in `.agents/rules/` as persistent invariants:

### `architecture.md`
```
- DeepVerify is a monorepo.
- Frontend must never contain ML inference logic.
- Backend owns orchestration and all secrets.
- ML package owns model implementation.
- Training code must never be imported into production inference.
- No circular dependencies between frontend/backend/ml.
- API contracts must be versioned (/api/v1/).
- Do not change architecture without documenting an ADR.
- Every layer must have a working checkpoint before the next is built.
```

### `ml.md`
```
- All experiments must have a configuration YAML file.
- Never hardcode hyperparameters.
- Always record random seeds.
- Always save validation metrics with checkpoints.
- Never evaluate on training data.
- Dataset splitting must happen before augmentation.
- Video frames from the same source video must never cross train/test boundaries.
- Model checkpoints must include model version and configuration.
- Never claim generalization beyond evaluated datasets.
- Preprocessing must be shared between training and inference — never duplicated.
- Training is an experiment, not CI. Never train the full model on every push.
```

### `security.md`
```
- Never commit secrets.
- Never hardcode API keys.
- Never expose model storage credentials to frontend.
- Validate uploaded file type (MIME + extension + magic bytes).
- Validate file size, duration, frame count, resolution.
- Never trust uploaded filenames.
- Store uploads outside executable paths.
- Sanitize all user-controlled paths.
- All new endpoints must be reviewed for authentication/authorization needs.
```

### `testing.md`
```
- Every feature requires tests before it is considered done.
- ML-specific CI tests: model loads, input shape correct, output range [0,1], preprocessing identical.
- Integration tests must cover the upload → inference → result path.
- Preprocessing divergence between training and inference is a critical bug.
- Never invent evaluation metrics — all metrics must come from held-out test sets.
```

### `confidence.md`
```
- Confidence scores reflect model output probability, not factual certainty.
- The UI must never display "FAKE — 99.8% CERTAIN."
- Grad-CAM heatmaps are evidence of model activation, not causal proof.
- All displayed results must include a disclaimer about model limitations.
- Generalization claims must be bounded by the datasets actually evaluated.
```

---

## 14. REQUIREMENTS THAT SHOULD BECOME AGENT SKILLS

The following procedures are complex, repeatable, and benefit from being codified as skills under `.agents/skills/`:

| Skill Name | Description |
|---|---|
| `train-model` | Procedure for configuring, launching, tracking, and saving a training experiment. Covers YAML config setup, seed recording, Colab execution, checkpoint saving, metrics recording, and experiment registry update. |
| `evaluate-model` | Procedure for running evaluation on held-out test sets, recording all metrics, generating error analysis, and documenting limitations. |
| `implement-api-endpoint` | Procedure for adding a new FastAPI endpoint — including schema definition, route creation, service wiring, error handling, logging, and test writing. |
| `run-tests` | Procedure for running the full test suite (unit, integration, ML validation) and interpreting/reporting results. |
| `release` | Procedure for creating a versioned model release — export checkpoint, write model card, push to HuggingFace, tag Git commit, update experiment registry. |
| `add-gradcam` | Procedure for adding Grad-CAM explainability to a new model — select target layer, implement hook, validate heatmap output, integrate into inference pipeline. |
| `dataset-setup` | Procedure for downloading, verifying (checksum), splitting, and documenting a new dataset. Enforces no-raw-data-in-git and split-before-augmentation rules. |

---

## 15. FIRST IMPLEMENTATION MILESTONE

Based strictly on the blueprint (Phase 1 + M0 baseline):

### Milestone 0 — Repository Foundation + Architecture

**Precondition:** This audit is approved.

**What gets built:**
1. GitHub repository created (`deepverify`)
2. Monorepo directory skeleton created (all folders from Section 2, `.gitkeep` files where needed)
3. `.agents/rules/` populated with all 5 rule files (`architecture.md`, `ml.md`, `security.md`, `testing.md`, `confidence.md`)
4. `.env.example` created with documented variables
5. `.gitignore` created (covers `.env`, `*.pth`, `*.pt`, `*.onnx`, `data/`, `artifacts/`)
6. `docs/architecture/system.md` created (system overview)
7. `docs/api/openapi.yaml` created — **frozen inference contract from Section 15**
8. `ADR-001-monorepo.md` created
9. `ADR-002-model-versioning.md` created
10. `ADR-003-inference-hosting.md` created (with pending platform decision noted)
11. `datasets/README.md` created (download instructions template for all 3 datasets)
12. `experiments/registry.csv` created (column headers only)
13. Backend skeleton: `backend/app/main.py`, `backend/app/api/routes/health.py`, `backend/requirements.txt`
14. ML package skeleton: `ml/src/deepverify_ml/__init__.py`, empty submodules, `ml/requirements.txt`
15. `Makefile` with basic commands (`make install`, `make test`, `make lint`)
16. GitHub Actions CI files (stub, run on push to any branch)

**What does NOT get built in Milestone 0:**
- No ML model training
- No React UI
- No database schema
- No upload handling
- No Grad-CAM
- No Docker production image (stub Dockerfile only)

**Success criteria for Milestone 0:**
- `GET /health` returns `{"status": "ok"}`
- All rule files exist and are loaded by Antigravity
- The frozen API schema is committed to `docs/api/openapi.yaml`
- All ADRs are committed
- CI pipeline runs (even if stub tests pass trivially)
- README explains the project at a high level

**Then (Milestone 1 — Spatial Baseline):**
- Dataset pipeline for 140k Real/Fake
- EfficientNet-B0 fine-tuning (on Colab)
- First checkpoint saved with config + metrics
- Standalone Python inference script (no API yet)
- `EXP-001` recorded in registry
- Proves: `model → inference → prediction` on a single image

---

> **STOP — Awaiting approval before any implementation.**
>
> The above is a complete architecture audit. Nothing has been installed, created, or modified in the project workspace. The only output of this task is this document.
>
> **Open decisions requiring your input before Phase 1 begins:**
> 1. Confirm or revise the proposed database technology (SQLite vs PostgreSQL for MVP)
> 2. Confirm or choose the backend hosting platform
> 3. Confirm the Frontend framework (plain React/Vite vs Next.js)
> 4. Confirm FF++ access has been requested or will be (it blocks Phase 6)
> 5. Any corrections or additions to this understanding
