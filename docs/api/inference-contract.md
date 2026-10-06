# DeepVerify — ML Inference Contract

> **Status:** Defined for Phase 1+. Implementation begins Phase 2.  
> **Source:** Architecture Audit Section 3 (ML Layer), `.agents/rules/ml.md`, `.agents/rules/architecture.md`

> [!IMPORTANT]
> This document defines the **conceptual interface** only.  
> Do NOT implement this interface until Phase 2.

---

## 1. PURPOSE

This contract defines a stable internal interface between the backend and the ML inference engine.

The goal is:
1. The backend does not need to know the implementation details of any specific model.
2. New models (frequency, ensemble) can be added in later phases without changing backend orchestration code.
3. Preprocessing is always identical between training and production inference.

---

## 2. INFERENCE PIPELINE STAGES

Every inference invocation must pass through these stages in order:

```
INPUT (raw bytes / file path)
    │
    ▼
┌────────────────────┐
│  PREPROCESSING     │  Shared with training — single canonical implementation
│  - Decode          │  Frame extraction for video handled before this stage
│  - Resize          │
│  - Normalize       │
│  - Convert tensor  │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  MODEL INFERENCE   │  Forward pass only — no backward, no gradient tracking
│  model.forward()   │  In torch.no_grad() context
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  POSTPROCESSING    │  Sigmoid / softmax → probability [0.0, 1.0]
│  - Raw logits      │  Map to verdict label
│  - → probability   │  Apply verdict threshold (default: 0.5)
│  - → verdict       │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  STRUCTURED        │  PredictionResult (see Section 4)
│  PREDICTION        │
└────────┬───────────┘
         │
         ▼ (optional, Phase 3+)
┌────────────────────┐
│  EXPLAINABILITY    │  Grad-CAM activation map
│  - Hook on layer   │  Target layer: TBD-004
│  - Forward pass    │
│  - Compute heatmap │
│  - Overlay         │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  FINAL RESULT      │  AnalysisResult (see docs/api/result-schema.md)
└────────────────────┘
```

---

## 3. MODEL INTERFACE (Conceptual)

All production inference models MUST satisfy this interface.  
This allows the backend to treat all models identically.

```python
class ModelInterface:
    """
    Conceptual interface all DeepVerify inference models must implement.
    Do not implement until Phase 2.
    """

    def load(self, checkpoint_path: str, device: str) -> None:
        """Load model weights from checkpoint. Called once at backend startup."""
        ...

    def preprocess(self, input_path: str) -> Tensor:
        """
        Load and preprocess input into model-ready tensor.
        MUST use the same preprocessing logic as training.
        """
        ...

    def infer(self, tensor: Tensor) -> PredictionResult:
        """
        Run forward pass. No gradient tracking.
        Returns a structured PredictionResult.
        """
        ...

    def explain(self, tensor: Tensor) -> ExplanationResult | None:
        """
        Generate Grad-CAM heatmap (optional — returns None if not supported).
        Phase 3+ only.
        """
        ...
```

**Interface rules:**
- `load()` is called exactly once at backend startup.
- `preprocess()` must be functionally identical to the preprocessing in training scripts.
- `infer()` must operate inside `torch.no_grad()`.
- `explain()` is optional — returning `None` is a valid implementation for models without explainability.
- No model implementation may import backend or frontend code.

---

## 4. `PredictionResult` STRUCTURE (Conceptual)

Returned by `infer()` — internal to the ML package.  
The backend maps this to the public-facing `AnalysisResult`.

```python
@dataclass
class PredictionResult:
    model_version: str        # e.g., "spatial-v1.0"
    model_type:    str        # "spatial" | "frequency" | "ensemble"
    label:         str        # "LIKELY_AI_GENERATED" | "LIKELY_AUTHENTIC" | "INCONCLUSIVE"
    score:         float      # probability of the predicted label [0.0, 1.0]
    probabilities: dict       # {"ai_generated": float, "authentic": float}
    processing_time_ms: int   # inference time in milliseconds
```

**Field notes:**

| Field | Type | Notes |
|---|---|---|
| `model_version` | `str` | Identifies exact model artifact used |
| `model_type` | `str` | One of: `spatial`, `frequency`, `ensemble` |
| `label` | `str` | Verdict label derived from `score` and threshold |
| `score` | `float` | Probability of predicted label. Not a certainty claim. |
| `probabilities` | `dict` | Raw class probabilities (sum to 1.0) |
| `processing_time_ms` | `int` | Time taken for inference only (not including preprocessing) |

---

## 5. `ExplanationResult` STRUCTURE (Conceptual, Phase 3+)

Returned by `explain()`.

```python
@dataclass
class ExplanationResult:
    heatmap_array: ndarray    # Raw heatmap as numpy array (before saving to file)
    target_layer:  str        # Name of the layer used for Grad-CAM (documented in ADR)
```

**Important framing (per `confidence.md`):**

The heatmap shows activation regions — areas where the model's representation was strongest.  
It does NOT show which pixels were manipulated.  
The UI and API response must never claim otherwise.

---

## 6. PREPROCESSING CONTRACT

Preprocessing is the single most critical invariant in this system (per `ml.md`):

```
training preprocessing   ──┐
                            ├── MUST be identical ── same shared module
inference preprocessing  ──┘
```

**Required preprocessing steps for EfficientNet-B0 spatial model:**

| Step | Operation | Notes |
|---|---|---|
| Decode | Load image from file | RGB, reject corrupt files |
| Resize | Resize to model input size | EfficientNet-B0: 224×224 |
| Normalize | ImageNet mean/std normalization | mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225] |
| Tensor | Convert to float32 torch tensor | NCHW format |

> [!IMPORTANT]
> The exact resize strategy (center-crop vs. direct resize) and any augmentation policy  
> must be explicitly documented in the experiment config YAML for training.  
> The **same strategy without augmentation** applies to inference.  
> Any divergence is a critical bug.

---

## 7. VERSIONING

- Model versions follow: `{type}-v{major}.{minor}` (e.g., `spatial-v1.0`)
- Major version bumps when the model architecture changes.
- Minor version bumps when weights are updated with the same architecture.
- The `model_version` field in `PredictionResult` must always reflect the exact loaded checkpoint.
- The API version (`/api/v1/`) is independent of the model version.
- The result schema version (v1) is separate from both.

---

## 8. MEDIA VALIDATION CONTRACT

See `docs/api/media-validation.md`.
