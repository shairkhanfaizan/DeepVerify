# ADR-007: Server-Side Forensic PDF Report Generation

## Status
Accepted

## Context
In DeepVerify V1 (client-side prototype), reporting was proposed as client-side DOM snapshots (`window.print()` or `html2canvas`). While sufficient for quick browser previews, client-side captures are fundamentally unsuitable for forensic and courtroom evidentiary workflows:
1. **Evidentiary Integrity**: Client-side DOM captures cannot verify that the presented numbers reflect the authoritative ledger rather than modified frontend DOM state.
2. **Reproducibility & Auditability**: A forensic document must be deterministically reproducible from immutable server-side records (cryptographic input hashes, model versions, policy thresholds, and verified signals).
3. **Rendering Consistency**: Browser print rendering varies across engines (Blink, Gecko, WebKit), operating systems, and viewport dimensions, leading to inconsistent pagination, truncated tables, and omitted high-resolution visual heatmaps.
4. **Separation of Concerns**: Per Section G of the DeepVerify V2 Architecture, deterministic observations (dimensions, format, provenance) must be cleanly segregated from probabilistic signals (model likelihoods) and human investigator notes.

## Decision
We implement server-side PDF report generation using `reportlab`:
1. **Source of Truth**: The report is generated directly by the backend from persisted PostgreSQL entities (`Investigation`, `EvidenceItem`, `EvidenceSignal`, `EvidenceObservation`, `AnalysisResult`, `AnalysisPolicy`).
2. **Format & Library**: `reportlab` is chosen because it produces compact, fast, standalone vector PDF documents with precise typography, custom page headers/footers, dynamic pagination ("Page X of Y"), and clean visual tables without requiring heavy headless browser runtimes (e.g., Chromium or WeasyPrint system dependencies).
3. **Evidence Artifact Rendering**: The report engine retrieves stored evidence files and Grad-CAM activation heatmaps via `StorageInterface` and embeds them directly with preserved aspect ratios.
4. **Evidentiary Structure**:
   - **Header & Chain of Custody**: Case ID, timestamp (UTC), assigned investigator, document classification.
   - **Cryptographic Evidence Verification**: SHA-256 digest pinned to the evidence file, MIME type, upload metadata.
   - **Deterministic Observations**: Empirical file properties with provenance tags.
   - **Probabilistic Model Signals & Policy Classification**: Verdict, ensemble score, model IDs/versions, score semantics, and ensemble weights.
   - **Visual Explanations**: Grad-CAM topographical activation maps accompanied by strict scientific bounding disclaimers.
   - **Investigator Qualitative Context**: Investigator case notes recorded separately from model inferences.
   - **Scientific Grounding & Legal Disclaimer**: Non-negotiable statements affirming that model probabilities represent likelihoods rather than proof of manipulation.
   - **Cryptographic Audit Seal**: Checksum of structured evidence records confirming database fidelity.
5. **Endpoint Contract**: Exposed at `GET /api/v2/investigations/{id}/report?evidence_id={optional}` under standard JWT/cookie session authentication with strict ownership validation (`user_id == current_user.id`).

## Consequences

### Positive
- Authoritative, tamper-evident documents generated directly from PostgreSQL.
- Fast, deterministic PDF generation without headless browser dependencies.
- Full architectural adherence to DeepVerify V2 Grounding and Provenance rules.
- Downloadable in one click from both the Case Ledger view and the Forensic Workbench.

### Negative / Trade-offs
- Adding `reportlab` (pure Python / wheel dependency) to backend dependencies.
- Large embedded images require in-memory scaling before placement on PDF canvas.
