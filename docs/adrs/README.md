# Architecture Decision Records (ADRs)

This directory records all significant architectural, technological, and infrastructural decisions made during the lifecycle of DeepVerify.

## ADR Template
When proposing an architectural decision, create a new markdown file named `XXXX-short-title.md` (e.g., `0001-fastapi-backend-framework.md`) using the following format:

```markdown
# ADR-XXXX: [Title]

## Status
[Proposed | Accepted | Superseded | Deprecated]

## Context
[Describe the problem, context, and requirements motivating this decision]

## Decision
[Describe the chosen architecture, library, or pattern]

## Consequences
### Positive
* [Benefits]

### Negative / Trade-offs
* [Risks, operational overhead, or limitations]
```

## Index of ADRs

### Accepted

| ADR | Title | Phase |
|---|---|---|
| [ADR-001](ADR-001-monorepo.md) | Monorepo Architecture | Foundation |
| [ADR-002](ADR-002-training-inference-separation.md) | Training / Inference Separation | Foundation |
| [ADR-003](ADR-003-api-versioning.md) | API Versioning Strategy (`/api/v1/`) | Foundation |
| [ADR-004](ADR-004-model-artifact-storage.md) | Model Artifact Storage (Preferred: Hugging Face Hub) | Foundation |
| [ADR-006](ADR-006-v2-domain-model-postgresql.md) | V2 Domain Model & PostgreSQL Persistence | Phase 1 |
| [ADR-007](ADR-007-server-side-forensic-reporting.md) | Server-Side Forensic PDF Report Generation | Phase 14 |

### Proposed / Under Evaluation (TBD)

| ADR | Title | Decision Deadline | Candidates |
|---|---|---|---|
| [ADR-005](ADR-005-database-selection.md) | Database Selection | Phase 8 (Persistence) | PostgreSQL vs. SQLite |

### Open — TBD (Decision Required Before Corresponding Phase)

| ID | Topic | Blocking Phase |
|---|---|---|
| TBD-001 | Frequency-domain model architecture | Phase 4 |
| TBD-002 | Ensemble aggregation strategy | Phase 5 |
| TBD-003 | Video frame aggregation strategy | Phase 7 |
| TBD-004 | Grad-CAM target layer for EfficientNet-B0 | Phase 3 |
| TBD-005 | Face detection library for FF++ (MTCNN / dlib / MediaPipe) | Phase 6 |
| TBD-006 | Asynchronous task handling (FastAPI background tasks / Celery) | Phase 8 |
| TBD-007 | Heatmap / media file storage location | Phase 8 |
| TBD-008 | Backend hosting platform (Render / Railway / Fly.io) | Phase 9 |
| TBD-009 | Video frame sampling strategy | Phase 7 |
| TBD-010 | Confidence calibration methodology | Phase 8+ |
| TBD-011 | CIFAKE role in training vs. evaluation | Phase 2 |
| TBD-012 | `regions` field structure in explanation response | Phase 3 |
| TBD-013 | Database technology selection (ADR-005: SQLite vs. PostgreSQL) | Phase 8 |
