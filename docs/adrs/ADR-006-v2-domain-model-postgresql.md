# ADR-006: V2 Domain Model and PostgreSQL Persistence

> **Status:** Accepted  
> **Date:** 2026-10-09  
> **Source:** V2 Architecture Freeze

## Context

DeepVerify V1 used a stateless, in-memory `dict` to store analysis results and temporary local files for Grad-CAM heatmaps. This satisfied the MVP requirements of a simple "Analyzer".
For V2 ("The Platform"), we require persistent investigations, historical reproducibility, and strict separation between observations and model signals. We also require a relational model to link Users to Investigations, Investigations to Evidence, and Evidence to specific ML outcomes.

## Decision

We will adopt **PostgreSQL** as the primary relational database for V2, managed via **SQLAlchemy** (ORM) and **Alembic** (migrations).

The core domain model will introduce the concept of an `Investigation` as the top-level entity, shifting away from single-image processing. 

Crucially, the domain model enforces the **Evidence/Conclusion Separation Principle**:
- `EvidenceObservation`: Deterministic facts extracted from the file (e.g., EXIF data).
- `EvidenceSignal`: Probabilistic outputs derived from ML models.

Both entities will explicitly record their `provenance` to guarantee forensic accountability.

## Consequences

### Positive
- Strict foreign key constraints guarantee data integrity.
- Historical reproducibility is guaranteed by associating `AnalysisResults` with explicitly versioned `AnalysisPolicy` and `ModelRegistryEntry` records.
- Solves the previous MVP limitation regarding user accounts and persistent history.

### Negative / Trade-offs
- Introduces operational overhead (PostgreSQL must be managed/hosted).
- We must implement a separate Storage Abstraction (ADR-007) for binary data (images, heatmaps) to prevent database bloat, as PostgreSQL will only store metadata and references.
