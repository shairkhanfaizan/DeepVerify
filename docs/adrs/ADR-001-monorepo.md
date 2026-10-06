# ADR-001: Monorepo Architecture

> **Status:** Accepted  
> **Date:** 2026-10-03  
> **Source:** DeepVerify Development Blueprint (primary), Architecture Audit Section 6.

---

## Context

DeepVerify has three distinct technical concerns that must be developed, versioned, and deployed independently:

1. A React frontend (TypeScript, Vite) — deployed as static assets.
2. A FastAPI backend (Python) — deployed as a containerized service.
3. A PyTorch ML package (Python) — trained in Google Colab, loaded at inference time.

These concerns share:
- A frozen API contract (schema).
- A common preprocessing pipeline (training and inference must use the same code).
- Project-level governance rules (`.agents/rules/`).

## Decision

DeepVerify is structured as a **monorepo** with isolated layer directories:

```
DeepVerify/
├── frontend/     # React/Vite/TypeScript
├── backend/      # FastAPI Python service
├── ml/           # deepverify_ml Python package
├── experiments/  # YAML experiment configs + registry
├── docs/         # Architecture, ADRs, contracts, research
└── tests/        # Cross-layer and layer-specific tests
```

Each layer has its own dependency files (`package.json`, `requirements.txt`) and is independently deployable. No layer imports code from another layer's internal modules — they communicate only via defined contracts (API or Python interface).

## Consequences

### Positive
- Shared preprocessing code is physically in one place — training and inference cannot silently diverge.
- The frozen API contract lives next to both consumer (frontend) and producer (backend).
- Governance rules, ADRs, and documentation are co-located with the code they govern.
- CI can validate each layer independently on every push.

### Negative / Trade-offs
- Developers need to be disciplined about layer boundaries — a monorepo does not technically prevent cross-layer imports.
- Git history is shared across all concerns (acceptable at this project scale).
