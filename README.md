# DeepVerify

**DeepVerify** is a production-engineered deepfake and media manipulation detection platform designed to provide transparent, interpretable, and reproducible media integrity analysis.

---

## 1. What DeepVerify Is (and Is Not)

### What DeepVerify Is
* An end-to-end media verification system combining a PyTorch computer vision inference engine, a FastAPI backend orchestrator, and a modern React frontend dashboard.
* A research-grounded platform focused on rigorous experiment tracking, data leakage prevention (video-level splitting), and standardized evaluation metrics (Accuracy, Precision, Recall, F1, ROC-AUC).
* An explainable system providing visual interpretability via Grad-CAM activation heatmaps and per-frame confidence breakdowns.

### What DeepVerify Does NOT Claim
* **Confidence ≠ Absolute Truth:** Model confidence scores reflect internal statistical probabilities, not infallible ground-truth facts.
* **Grad-CAM Is Not Causal Proof:** Activation heatmaps highlight regions that contributed most strongly to the model's feature representation; they do not serve as forensic proof of localized pixel tampering.
* **No Universal Detection Guarantee:** DeepVerify does not claim to detect all generative techniques or future unseen manipulation architectures. Cross-generator generalization and compression resilience are treated as experimental boundaries, not marketing guarantees.

---

## 2. Architecture & Separation of Concerns

DeepVerify enforces a strict architectural boundary between **Training** and **Production Inference**:

```
                       ┌────────────────────────┐
                       │     React Frontend     │
                       │ (Dashboard & Heatmaps) │
                       └───────────┬────────────┘
                                   │ HTTP / JSON
                                   ▼
                       ┌────────────────────────┐
                       │    FastAPI Backend     │
                       │ (Validation & Pipeline)│
                       └───────────┬────────────┘
                                   │ In-memory / Tensors
                                   ▼
                       ┌────────────────────────┐
                       │   ML Inference Engine  │
                       │ (load_model / infer)   │
                       └────────────────────────┘
```

* **Backend Is Purely Inference:** The production API backend **NEVER** runs training loops, backpropagation, gradient updates, or dataset loaders. It only executes `load_model()`, `preprocess()`, `infer()`, and `postprocess()`.
* **Zero Secret Leakage:** The frontend has no direct database or model storage credentials; it only communicates with versioned endpoints (`/api/v1/`).
* **Strict Media Sanitization:** Uploaded files are treated as untrusted byte streams. Filesystem paths use server-side UUIDs, file contents are validated via magic numbers, and external tools (FFmpeg) are invoked using parameterized argument lists without shell interpolation.

---

## 3. How Google Colab Fits into the Workflow

Google Colab serves as an **ephemeral GPU compute runner**, **NOT** the repository source of truth:

1. **Configuration-Driven:** Experiments are defined via YAML files committed to the repository (e.g., `experiments/configs/exp001.yaml`).
2. **Standardized CLI:** Training is triggered via CLI scripts (`python -m ml.training.train --config ...`).
3. **Colab Execution:** A lightweight Colab notebook simply clones the repository, installs the ML package dependencies, and invokes the CLI command.
4. **Artifact Tracking:** Checkpoints and evaluation metrics are pushed to external registries (e.g., Hugging Face Hub, MLflow) and logged in `experiments/registry.csv`. Model weights are never committed directly to Git.

---

## 4. Repository Structure

```text
DeepVerify/
├── .agents/                 # AI Agent governance & tooling
│   ├── rules/               # Tracked engineering rules (Architecture, ML, Security, etc.)
│   └── skills/              # Local-only agent development skills (Git-ignored)
├── docs/                    # Architecture blueprints, ADRs, research notes
│   ├── architecture/        # Architecture diagrams, system audit, design specs
│   ├── adrs/                # Architecture Decision Records
│   └── research/            # Research logs, dataset lineage, and benchmarks
├── frontend/                # React / Vite / TypeScript user dashboard
├── backend/                 # FastAPI application and media processing pipeline
│   └── app/                 # Routers, schemas, security validation, services
├── ml/                      # DeepVerify ML package
│   ├── models/              # Neural network architectures
│   ├── preprocessing/       # Video & image frame extraction & normalization
│   ├── evaluation/          # Evaluation metrics calculation
│   └── training/            # Experiment CLI training pipelines
├── experiments/             # Experiment configs (YAML) and run registry (CSV)
│   └── configs/             # Parameterized experiment definitions
├── tests/                   # Test suite (Unit, Integration, E2E, ML Inference)
├── scripts/                 # Utility automation & validation scripts
├── notebooks/               # Colab wrapper notebooks
├── .env.example             # Template environment configuration
├── .gitignore               # Strict exclusion rules (weights, data, secrets)
├── CONTRIBUTING.md          # Contribution and coding standards
├── CHANGELOG.md             # Version history
└── LICENSE                  # MIT License
```

---

## 5. Development Phases

Development progresses in strict, testable increments:

* **Phase 1: Foundation (Current)** — Establish repository governance, persistent rules, boundaries, and project skeleton.
* **Phase 2: Milestone 0 (M0 Raw Baseline)** — Verify end-to-end `image -> model -> inference -> prediction` in isolation with no frontend or video pipeline.
* **Phase 3: Core ML & Evaluation Pipeline** — Frame extraction, dataset loaders, FaceForensics++ integration, training via Colab, and metric evaluation.
* **Phase 4: Backend API & Video Pipeline** — FastAPI service, media validation, FFmpeg frame extraction, and async inference orchestrator.
* **Phase 5: Frontend UX & Explainability Dashboard** — React upload flow, frame-by-frame scrubbing, confidence gauges, and Grad-CAM overlays.
* **Phase 6: Hardening, Benchmarking & Deployment** — Security audit, rate limiting, Dockerization, and cloud deployment.

---

## 6. Project Invariants & Guidelines

All development must adhere strictly to the rules codified in [`.agents/rules/`](.agents/rules/):
* [`architecture.md`](.agents/rules/architecture.md) — System boundaries, monorepo layers, and API versioning.
* [`ml.md`](.agents/rules/ml.md) — Leakage prevention, experiment tracking, held-out evaluation, and preprocessing consistency.
* [`security.md`](.agents/rules/security.md) — Untrusted media validation, safe command execution, and secret management.
* [`testing.md`](.agents/rules/testing.md) — Testing pyramid, ML production inference tests, and verification before completion.
* [`confidence.md`](.agents/rules/confidence.md) — Responsible framing of confidence scores and explainability limits.
