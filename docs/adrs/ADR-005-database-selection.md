# ADR-005: Database Selection (PostgreSQL vs. SQLite)

> **Status:** Proposed / Under Evaluation (TBD)  
> **Date:** 2026-10-05  
> **Source:** DeepVerify Development Blueprint, Architecture Audit Section 12 (Risk #4).

---

## Context

The backend requires persistence for analysis records (`analyses` table) and, in Phase 7+, per-frame video analysis results (`analysis_frames` table).

The project is governed by a strict zero-cost (₹0) infrastructure deployment constraint. The Development Blueprint permits SQLite for the initial MVP and PostgreSQL for scalable production deployments.

A premature selection between PostgreSQL and SQLite presents trade-offs:
- Free-tier managed PostgreSQL services often enforce connection limits, idle shutdowns, or storage ceilings.
- File-based SQLite eliminates external service dependencies and network latency, but presents concurrency bottlenecks and requires persistent disk volumes that are not available on all zero-cost ephemeral cloud platforms.

## Decision (TBD — Unresolved)

Database selection is intentionally left **UNRESOLVED (TBD)** for Phase 1. 

A final decision between SQLite and PostgreSQL will be made prior to persistence implementation (Phase 8), evaluated against:

1. **Zero-cost deployment feasibility:** Availability and reliability of free hosting tiers (e.g., Render free PostgreSQL, Supabase, or persistent SQLite disks on Fly.io/Railway).
2. **Concurrency requirements:** Expected simultaneous analysis requests and write transaction locking behavior.
3. **Persistence requirements:** Durability guarantees across backend container restarts or cold starts.
4. **Video/frame-result storage needs:** Storage capacity and query latency when storing dozens of per-frame records per video analysis.
5. **Deployment constraints:** Ephemeral filesystem characteristics of the chosen hosting environment (TBD-008).

Both **SQLite** and **PostgreSQL** remain active candidate technologies. The SQLAlchemy data-access layer must remain database-agnostic through abstract models and standard connection URLs (`DATABASE_URL`).

## Consequences

### Positive
- Prevents premature commitment to a database technology before hosting platform selection (TBD-008).
- Allows rapid MVP local testing using SQLite without requiring a local PostgreSQL instance.
- Protects the zero-cost deployment constraint by deferring selection until hosting tier limits are measured.

### Negative / Trade-offs
- SQLAlchemy schemas and queries must be written to avoid engine-specific dialect locks (e.g., avoiding PostgreSQL-only JSONB functions or SQLite-incompatible constraints until finalized).
