# ADR-003: API Versioning Strategy

> **Status:** Accepted  
> **Date:** 2026-10-03  
> **Source:** DeepVerify Development Blueprint Section 16, Architecture Audit Section 7, `.agents/rules/architecture.md`

---

## Context

DeepVerify's backend serves a React frontend that will be independently deployed. Once the frontend is in production, API breaking changes cannot be made without coordinating a simultaneous frontend deployment.

Additionally, as new ML models (frequency, ensemble) are added in later phases, the inference result schema will gain new optional fields. Versioning ensures the frontend can handle these additions gracefully.

## Decision

**All public API endpoints are prefixed with `/api/v1/` from day one.**

Rules:
- Endpoints are never built without a version prefix, with one strict exception: an unversioned `/health` endpoint is permitted ONLY as an infrastructure/liveness probe when required by deployment infrastructure (container health checks, load balancers), containing no business logic or application state.
- Breaking changes to the API contract require introducing `/api/v2/` — not modifying `/api/v1/`.
- Adding optional fields to response schemas is non-breaking (backward-compatible) and does not require a version bump.

The current frozen contract is defined in `docs/api/contract.md`.

## Consequences

### Positive
- Frontend and backend can be deployed at different times without breaking compatibility.
- The ML team can add new optional model score fields (frequency, ensemble) to responses without a version bump.
- The contract document is frozen — implementers have a stable target.

### Negative / Trade-offs
- All endpoint URLs are slightly longer (`/api/v1/` prefix).
- Frontend must always use the versioned path — no shortcut to root endpoints.
