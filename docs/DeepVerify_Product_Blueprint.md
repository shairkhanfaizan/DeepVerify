# DeepVerify Product Blueprint

## Product Principles
- **Plain English by default; forensic depth on demand.**
- The dashboard is an overview, not the complete investigation history.
- Investigations is the dedicated place to find and reopen saved work.
- A persistent, collapsible left sidebar provides the main application navigation.
- A new investigation follows a deliberate sequence: upload image → choose configuration → run analysis → understand results → explore evidence → save, compare, or export.
- Multi-model selection must be real, backend-supported functionality.
- Preserve existing useful features, security boundaries, and scientific honesty.

## 1. Final Information Architecture

| Target Destination | Purpose | Route | Mapping to Current State |
| --- | --- | --- | --- |
| **Landing Page** | Marketing, product introduction. | `/` | Existing `Home.tsx`. |
| **Authentication** | User login and registration. | `/login` | Existing `Login.tsx`. |
| **Dashboard** | High-level overview, quick actions, and recent activity. | `/dashboard` | Modifies existing `Dashboard.tsx` (which is currently an exhaustive table). |
| **Investigations** | Searchable, filterable list of all saved work. | `/investigations` | **New Route.** Will inherit the table currently in `Dashboard.tsx`. |
| **Investigation Config** | Staging area to upload an image and choose analysis settings. | `/investigation/:id/configure` | **New Route.** Requires decoupling upload from analysis in backend. |
| **Investigation Results**| Primary forensic workbench and result presentation. | `/investigation/:id/evidence/:evidenceId`| Refines existing `ForensicWorkbench.tsx`. |
| **Comparison** | Cross-compare different investigation items. | `/investigation/:id/compare` | Existing `InvestigationComparison.tsx`. |
| **Reports** | Access and export generated PDFs. | `/investigation/:id/report` | Existing `ReportsFindings.tsx`. |
| **Settings** | User preferences, examiner identity, AI keys. | `/settings` | Existing `Settings.tsx`. |

*Note: The navigation structure will migrate from the current top-navbar (`Shell.tsx`) to a persistent, collapsible vertical left sidebar.*

## 2. Post-Login Dashboard

**Above the Fold:**
- **Welcome & Context:** "Welcome back, [Investigator Name]".
- **Primary Action:** A prominent "Start New Investigation" button.
- **Summary Metrics:** 
  - *Total Cases:* Based on total `Investigation` rows for `user_id`.
  - *Active Cases:* Based on `Investigation.status == 'OPEN'`.
  - *Closed Cases:* Based on `Investigation.status == 'CLOSED'`.
  *(Note: If the backend API `GET /api/v2/investigations/` does not return status breakdowns easily, the frontend will filter the list in memory for now. Any heavy aggregations will require a future `/metrics` endpoint, which is noted as a backend dependency.)*

**Below the Fold:**
- **Recent Activity Feed:** Shows the 3-5 most recently created/updated cases, displaying their status, timestamp, and a quick-resume link.
- **Empty State:** If 0 cases exist, show a truthful empty state with an inviting illustration and a clear call-to-action to upload the first image.

## 3. Investigation Lifecycle

1. **Start:** User clicks "Start New Investigation" on Dashboard. System creates an empty `Investigation` record (`POST /api/v2/investigations/`) and navigates to `/investigation/:id/configure`.
2. **Upload & Configure:** User uploads an image. System saves the image (`EvidenceItem`) with status `UPLOADED_UNANALYZED`. User views basic metadata (dimensions, format) and selects an analysis configuration (defaulting to Ensemble).
3. **Run Analysis:** User clicks "Analyze". System queues `AnalysisJob` and updates status to `RUNNING`. A loading state is shown.
4. **Understand Results:** Once completed, user is transitioned to `/investigation/:id/evidence/:evidenceId`. The page presents a cautious, plain-English finding (e.g., "Analysis indicates structural anomalies commonly associated with synthetic generation") rather than definitive conclusions ("Authentic" or "AI Generated"). This is supported by the ensemble score.
5. **Explore Evidence:** User expands technical details to view the heatmap, spatial/frequency scores, and can chat with the Gemini AI Assistant for context.
6. **Save/Export:** User can add notes, close the case, compare it with others, or download the Academic PDF Dossier.

*Recovery Behavior:* If an analysis fails, the job status becomes `FAILED`. The user is shown the error and allowed to re-run the configuration step.

## 4. Model-Selection Design

**Current State:** The backend ignores frontend selections. It exclusively runs the `ensemble-v1.0` policy (60% Spatial EfficientNet-B0, 40% Frequency 2D-FFT) configured via `.env`.

**Target Design:**
- **The Default:** "Standard Ensemble (Recommended)" - Combines Spatial and Frequency branches for the most robust result. Perfect for ordinary users.
- **Advanced Options:** Real support for isolating "Spatial Only" or "Frequency Only" if the user has forensic expertise.
- **Backend Requirements & Limitations:**
  - `ModelRegistryEntry` must be populated and utilized by `v2_pipeline.py`.
  - Currently, `_run_v2_inference` and the `ensemble_score` calculation tightly couple both Spatial and Frequency adapters. To support independent execution, `v2_pipeline.py` must be significantly refactored to selectively load and run adapters based on the chosen policy, avoiding unnecessary computation.
  - The analysis endpoint must accept a `policy_id` or `model_id`.
  - The pipeline must dynamically route to the correct adapter based on the selected configuration, tracking versions for reproducibility in the `EvidenceSignal`. The interface must only expose configurations currently supported by the backend.

## 5. Results Experience

**Hierarchy of Information:**
1. **The Finding (Top Level):** Plain-English presentation based on validated decision rules (e.g., "Analysis indicates structural anomalies"). Do not present "Authentic" or "Likely AI Generated" as definitive conclusions based on unvalidated thresholds.
2. **The Score:** The numerical ensemble score (e.g., "0.84"). Clearly state that model scores are indicative signals, not calibrated probabilities.
3. **The Evidence (Expandable):**
   - **Heatmap:** Clearly labeled as a "Model Attention Visualization" showing what the AI looked at, *not* absolute proof of manipulation.
   - **Technical Branches:** Spatial and Frequency sub-scores for forensic depth.
4. **AI Assistant:** Grounded context pane where users can ask questions about the image's specific signals.

## 6. Capability Matrix

| Feature | Status | Location / Reference |
| --- | --- | --- |
| Authentication | **Working** | `backend/app/api/v2/endpoints/auth.py`, `frontend/src/contexts/AuthContext.tsx` |
| Image Upload | **Working** | `upload_evidence` in `investigations.py` |
| Dashboard Metrics | **Missing** | `Dashboard.tsx` only renders a table currently. |
| Investigations List | **Partially Implemented**| Currently lives on `/dashboard`, needs moving to `/investigations`. |
| Decoupled Analysis | **Missing** | `upload_evidence` instantly triggers `process_analysis_job`. |
| Model Selection | **Missing** | UI is placebo. `v2_pipeline.py` hardcodes `ensemble-v1.0`. |
| AI Assistant | **Working** | `query_evidence_assistant` hits Gemini correctly. |
| Report Generation | **Working** | `export_investigation_report` generates PDFs. |
| Sidebar Navigation| **Missing** | `Shell.tsx` uses top navbar exclusively. |

## 7. Data and API Implications

**Required Changes (DO NOT IMPLEMENT YET):**
1. **API Split:** 
   - `POST /api/v2/investigations/{id}/evidence` must ONLY handle upload and return the `evidence_id`. It must NOT trigger the background task.
   - **New Endpoint:** `POST /api/v2/investigations/{id}/evidence/{evidence_id}/analyze` which accepts a JSON payload `{"policy_id": "ensemble-v1.0"}` and triggers `process_analysis_job`.
2. **Schema Update:** 
   - `EvidenceItem` needs a state indicator (e.g., `status` field: `UPLOADED`, `ANALYZING`, `COMPLETED`, `FAILED`) to manage the gap between upload and analysis.
3. **Migration Risk:** Existing frontend clients expect upload to immediately return a `job_id`. Breaking this into two steps requires a coordinated frontend/backend deployment.

## 8. Implementation Roadmap

### Milestone 1: Layout & Information Architecture
- **Scope Restriction:** Desktop-first focus. Prioritize the desktop left sidebar, dashboard layout, and investigation list. Preserve basic usability at smaller widths, but defer detailed mobile optimization.
- **Outcome:** Top navbar is replaced by a persistent collapsible left sidebar on desktop. The exhaustive case list moves to a dedicated `/investigations` route. The `/dashboard` contains summary metrics and a "Start Investigation" button.
- **Affected Files:** `Shell.tsx`, `App.tsx`, `Dashboard.tsx`, new `Investigations.tsx`.
- **Acceptance:** Navigation works on desktop. Dashboard shows metrics calculated from the real `GET /api/v2/investigations/` response. Existing workflows and deep links are preserved.
- **Safety:** Do not touch backend routes, database schemas, or visual themes. Do not introduce fake mock data. Do not alter existing authentication guards.

### Milestone 2: Decoupling Upload & Analysis
- **Outcome:** Uploading an image creates the evidence but waits for user confirmation to run analysis.
- **Affected Files:** `investigations.py` (API), `models.py` (Evidence state), `ForensicWorkbench.tsx` (or new Config route).
- **Acceptance:** User can upload an image, see it in the DB, and explicitly click a button to start the job.
- **Safety:** Ensure legacy v1 endpoints aren't broken if still used by external consumers.

### Milestone 3: Real Model Selection
- **Outcome:** User can select Ensemble, Spatial-only, or Frequency-only. Backend respects this choice.
- **Affected Files:** `v2_pipeline.py`, `investigations.py` (new analyze endpoint payload).
- **Acceptance:** Selecting Spatial-only skips the Frequency processing step and reflects correctly in the final `AnalysisResult`.
- **Safety:** Prevent PyTorch OOM by managing adapter memory carefully in `v2_pipeline.py`.

### Milestone 4: Results Polish & Plain English
- **Outcome:** The workbench UI hierarchy is updated to emphasize the plain English verdict, safely explaining heatmaps and tucking technical scores into expandable sections.
- **Affected Files:** `ForensicWorkbench.tsx`, `InvestigationResult.tsx`.
- **Acceptance:** A non-technical user can immediately read "Likely Authentic" without being overwhelmed by "Spatial EfficientNet-B0 Probability".
