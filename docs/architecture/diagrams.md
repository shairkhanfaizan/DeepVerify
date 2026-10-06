# DeepVerify — Architecture Diagrams

> **Status:** Phase 1 — Architecture & Contracts  
> **Format:** ASCII text diagrams (renderable as mermaid in supporting environments)

---

## A. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER (Browser)                              │
│                   React / Vite / TypeScript                     │
│                                                                 │
│  [Upload Zone] [Progress States] [Verdict Card]                 │
│  [Confidence Breakdown] [Heatmap Viewer] [Frame Timeline]       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS  POST /api/v1/analyze/*
                           │        GET  /api/v1/results/{id}
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                      │
│                                                                 │
│  /api/v1/health          - readiness check                      │
│  /api/v1/analyze/image   - image submission                     │
│  /api/v1/analyze/video   - video submission                     │
│  /api/v1/results/{id}    - result polling                       │
│                                                                 │
│  Media Validation  →  UUID Assignment  →  Orchestration         │
│  Result Storage    →  Heatmap Serving  →  Error Handling        │
└──────────┬───────────────────────────────────┬──────────────────┘
           │                                   │
           │ Python function call              │ SQL
           ▼                                   ▼
┌─────────────────────────┐       ┌────────────────────────────┐
│  deepverify_ml package  │       │  Database (SQLite /        │
│                         │       │  PostgreSQL — ADR-005 TBD) │
│  preprocessing.py       │       │  analyses table            │
│  ModelInterface         │       │  analysis_frames (Phase 7) │
│  SpatialModel           │       └────────────────────────────┘
│  [FrequencyModel Ph4]   │
│  [Ensemble Ph5]         │       ┌────────────────────────────┐
│  GradCAM [Phase 3]      │       │  Hugging Face Hub          │
└──────────┬──────────────┘       │  (Preferred artifact host) │
           │                      │  deepverify-spatial-v1.0   │
           │ loads weights via    │  deepverify-frequency-v1.0 │
           └─────────────────────▶│  deepverify-ensemble-v1.0  │
                                  └────────────────────────────┘
```

---

## B. Image Inference Path

```
User uploads image
        │
        ▼
POST /api/v1/analyze/image   (multipart/form-data)
        │
        ▼
┌─── Backend: Upload Handler ────────────────────────────┐
│  1. Assign request_id (UUID)                           │
│  2. Validate MIME type                                 │
│  3. Validate magic bytes  ←── rejects spoofed files    │
│  4. Validate file size    ←── rejects bombs            │
│  5. Validate resolution   ←── decompression protection │
│  6. Write to tmp/{uuid}/original.{ext}                 │
│  Return: 202 Accepted + {request_id}                   │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌─── Backend: Inference Orchestration ───────────────────┐
│  7.  model.preprocess(image_path)  → tensor            │
│  8.  model.infer(tensor)           → PredictionResult  │
│  9.  [model.explain(tensor)        → heatmap] Phase 3  │
│  10. Write result to analyses table                    │
│  11. Save heatmap PNG to storage                       │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
GET /api/v1/results/{request_id}   ← Frontend polling
        │
        ▼
┌─── Response ─────────────────────────────────────────┐
│  {                                                   │
│    request_id, status: COMPLETED,                    │
│    verdict, confidence, model_info,                  │
│    scores: { spatial: 0.95, frequency: null },       │
│    explanation: { heatmap_url, regions: null }       │
│  }                                                   │
└──────────────────────────────────────────────────────┘
```

---

## C. Video Inference Path (Phase 7+)

```
User uploads video
        │
        ▼
POST /api/v1/analyze/video   (multipart/form-data)
        │
        ▼
┌─── Backend: Upload Handler ────────────────────────────┐
│  1. Assign request_id (UUID)                           │
│  2. Validate MIME type + magic bytes                   │
│  3. Probe via FFmpeg: duration, frame count, resolution│
│  4. Enforce: max 60s, max 300 frames, max 1080p        │
│  5. Write to tmp/{uuid}/original.{ext}                 │
│  Return: 202 Accepted + {request_id}                   │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌─── Backend: Frame Extraction (FFmpeg) ─────────────────┐
│  FFmpeg invoked with argument list (no shell interp)   │
│  Extracts N sampled frames to tmp/{uuid}/frames/       │
│  [Frame sampling strategy: TBD-009]                    │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌─── Backend: Per-Frame Inference Loop ──────────────────┐
│  For each sampled frame:                               │
│    tensor = model.preprocess(frame_path)               │
│    result = model.infer(tensor)  → PredictionResult    │
│    store: frame_index, timestamp_ms, score, verdict    │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌─── Backend: Video-Level Aggregation ───────────────────┐
│  Aggregate frame scores → video verdict                │
│  [Aggregation strategy: TBD-003 — EXP-007]            │
│  Optionally generate heatmap for highest-score frame   │
│  Write to analyses + analysis_frames tables            │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
GET /api/v1/results/{request_id}
        │
        ▼
┌─── Response ─────────────────────────────────────────┐
│  {                                                   │
│    request_id, status: COMPLETED,                    │
│    media_type: video,                                │
│    verdict, confidence,                              │
│    frames: [                                         │
│      { frame_index, timestamp_ms, score, verdict },  │
│      ...                                             │
│    ]                                                 │
│  }                                                   │
└──────────────────────────────────────────────────────┘
```

---

## D. Training Workflow (Google Colab)

```
Experiment Design
        │
        ▼
┌─── Config Definition ──────────────────────────────────┐
│  Create: experiments/configs/EXP-XXX.yaml              │
│  Define: model, dataset, split, seed, hyperparameters  │
│  Git commit the config (not weights)                   │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌─── Google Colab Execution ─────────────────────────────┐
│  ! git clone https://github.com/.../DeepVerify.git     │
│  ! pip install -e ml/                                  │
│  ! python -m deepverify_ml.training.train \            │
│      --config experiments/configs/EXP-XXX.yaml        │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌─── Training Run ───────────────────────────────────────┐
│  Dataset loaded (split by source video for FF++)       │
│  Augmentation applied AFTER split                      │
│  Training on GPU                                       │
│  Validation metrics computed on HELD-OUT val set       │
│  (never on training data — ml.md invariant)            │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌─── Checkpoint Saving ──────────────────────────────────┐
│  model.pth + config.yaml + metrics.json                │
│  Push checkpoint to Hugging Face Hub                   │
│  Record in experiments/registry.csv                   │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
┌─── Evaluation ─────────────────────────────────────────┐
│  Run on HELD-OUT test set                              │
│  Record: Accuracy, Precision, Recall, F1, ROC-AUC      │
│  Confusion matrix where applicable                    │
│  Document cross-generator and compression experiments  │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ▼
Backend loads versioned checkpoint at startup
(Training ENDS here — no backward() in production)
```

---

## E. Confidence Display Constraint (Architecture Invariant)

```
Model output:  probability tensor  [P(authentic), P(ai_generated)]
        │
        ▼
PredictionResult:  score = 0.95 (P(ai_generated))
        │
        ▼
API response:  verdict: "LIKELY_AI_GENERATED", confidence: 0.95
        │
        ▼
Frontend display:

  ✅ ALLOWED:   "Model output: 95% AI Generated, 5% Authentic"
  ✅ ALLOWED:   "Likely AI Generated (confidence: 95%)"
  ❌ FORBIDDEN: "This image is FAKE — 95% certain"
  ❌ FORBIDDEN: "Confirmed deepfake"
  ❌ FORBIDDEN: "This region was manipulated" (for Grad-CAM)
```

Source: `confidence.md` — model confidence is a statistical likelihood, not factual certainty.
