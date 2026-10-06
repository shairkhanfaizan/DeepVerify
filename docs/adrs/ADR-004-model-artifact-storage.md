# ADR-004: Model Artifact Storage (Preferred: Hugging Face Hub)

> **Status:** Accepted (Current Preferred Option)  
> **Date:** 2026-10-05  
> **Source:** DeepVerify Development Blueprint, Architecture Audit Section 3 (Model Artifacts), `.agents/rules/ml.md`

---

## Context

ML model checkpoints (`.pth` files) are large binary files that cannot be stored in Git. They need to be:
- Versioned and retrievable by exact version identifier.
- Accessible from the backend at startup (to load weights).
- Accessible from Colab for continued training or evaluation.
- Publicly or semi-publicly available for project demonstration and reproducibility.
- Hosted within the ₹0 infrastructure budget.

However, making the runtime architecture irreversibly coupled to a single third-party provider prior to production deployment validation introduces vendor lock-in risk.

## Decision

**Hugging Face Hub** is adopted as the **current preferred** model-artifact storage mechanism.

This decision concerns the current preferred artifact-storage mechanism and **does not prevent a future ADR from changing or supplementing the provider** (e.g., direct cloud object storage, GitHub Releases, or container-baked assets) if deployment constraints require it.

To prevent irreversible dependency:
1. **Abstract storage boundary:** The backend model loading interface interacts solely with local filesystem paths or an abstracted artifact resolver (e.g., `resolve_model_path()`). The core inference code has no direct coupling to Hugging Face APIs.
2. **Flexible configuration:** The backend can load models directly from a pre-downloaded local checkpoint or resolve them via remote provider config:
```bash
MODEL_CHECKPOINT_PATH=/path/to/local/model.pth
# or via preferred provider:
HF_MODEL_REPO=shairkhanfaizan/deepverify-spatial-v1.0
HF_TOKEN=<secret>
```

### Artifact Repository Structure
```
model.pth          # PyTorch checkpoint (state dict)
config.yaml        # Experiment configuration used to train this checkpoint
metrics.json       # Evaluation metrics from held-out test set
README.md          # Model card: dataset, training config, evaluation, limitations, license
```

Naming convention: `deepverify-{type}-v{major}.{minor}` (e.g., `deepverify-spatial-v1.0`).

Model weights (`*.pth`, `*.pt`, `*.safetensors`) remain strictly ignored in `.gitignore` and are never committed to the Git repository.

## Consequences

### Positive
- Zero cost on Hugging Face free tier.
- Artifacts are versioned, addressable, and reproducible.
- Model cards provide a structured home for model transparency and limitation documentation.
- Decoupled interface allows swapping storage backends via configuration without modifying inference or backend code.

### Negative / Trade-offs
- Network access to Hugging Face is required during build/initial deployment if weights are not bundled locally.
- Requires securing `HF_TOKEN` in `.env` if private repositories are utilized.
