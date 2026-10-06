# Contributing to DeepVerify

Thank you for contributing to DeepVerify. To maintain the integrity, reproducibility, and production quality of this project, all contributors (human and AI agents) must follow these guidelines.

---

## 1. Project Invariants

Before writing or modifying any code, read the binding project rules in `.agents/rules/`:
* **Architecture:** Respect layer boundaries (`frontend/`, `backend/`, `ml/`). Never import ML training code into backend inference services.
* **ML Reproducibility:** All experiments must be configuration-driven (`experiments/configs/*.yaml`). Train/val/test splits must be partitioned by source video, never by individual frames.
* **Security:** Treat all uploaded media as untrusted. Never interpolate user input into shell commands or filesystem paths.
* **Testing:** All features must include tests (unit, integration, or ML inference checks). Evidence of passing tests must precede completion claims.
* **Responsible AI:** Confidence scores represent statistical likelihoods, not absolute certainty. Grad-CAM visualizes activations, not causal ground truth.

---

## 2. Prohibited Artifacts

The following items MUST NEVER be committed to Git:
* **Secrets:** API keys, database passwords, `.env` files.
* **Media & Datasets:** Raw video files, image batches, dataset archives (`.zip`, `.tar`, `.mp4`).
* **Model Checkpoints:** Model weight binaries (`.pt`, `.pth`, `.bin`, `.onnx`, `.safetensors`).
* **Agent Tooling:** External agent skills located in `.agents/skills/`.

---

## 3. Workflow & Architecture Decision Records (ADRs)

1. **Incremental Steps:** Implement changes in small, verifiable increments.
2. **Architecture Decisions:** When proposing a significant change to dependencies, infrastructure, API contracts, or database schemas, write an Architecture Decision Record (ADR) in `docs/adrs/` following the established format.
3. **Verification Before Completion:** Run test suites and linters locally before submitting changes.
