# ADR-002: Training / Inference Separation

> **Status:** Accepted  
> **Date:** 2026-10-03  
> **Source:** DeepVerify Development Blueprint, Architecture Audit Section 3 (ML Layer), `.agents/rules/architecture.md`

---

## Context

ML projects frequently accumulate training, data loading, and inference code in the same files or classes, leading to:
- Production services accidentally importing training dependencies (e.g., dataset loaders, augmentation pipelines).
- Gradient computation running in production.
- Large training dependencies being packaged in production Docker images.
- Silent preprocessing divergence between training and inference.

DeepVerify trains models in Google Colab (ephemeral GPU) and serves inference via a FastAPI backend (persistent server). These are fundamentally different execution environments with different requirements.

## Decision

Training and inference code are **physically separated** into distinct modules that cannot import each other:

| Concern | Module | Never imports |
|---|---|---|
| Training loops | `ml/deepverify_ml/training/` | backend, frontend |
| Inference interface | `ml/deepverify_ml/models/` + `ModelInterface` | training module |
| Shared preprocessing | `ml/deepverify_ml/preprocessing/` | backend, frontend |
| Evaluation metrics | `ml/deepverify_ml/evaluation/` | backend, frontend |

The production backend imports **only** the inference interface — never `training/` or `evaluation/`.

The `preprocessing/` module is shared — it is the single source of truth for all preprocessing logic used in both training and inference.

In production, the backend only calls:
```python
model.load(checkpoint_path, device)
tensor = model.preprocess(input_path)
result = model.infer(tensor)
explanation = model.explain(tensor)   # optional, Phase 3+
```

No `train()`, no `optimizer.step()`, no data loaders, no gradient tracking.

## Consequences

### Positive
- Production Docker image does not need to include training-only dependencies.
- Preprocessing divergence between training and inference is structurally prevented (same file).
- Training never accidentally runs in the production service.
- The ML package can be replaced or updated without touching backend logic.

### Negative / Trade-offs
- Maintaining a clean `ModelInterface` requires discipline — future models must conform to it.
- Shared preprocessing means a preprocessing bug affects both training and inference simultaneously (acceptable — this is preferable to silent divergence).
