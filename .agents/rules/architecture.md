# DeepVerify Architecture Rules

## 1. System Boundaries & Monorepo
- The project MUST be structured as a monorepo containing distinct, isolated layers: `frontend/` (Vite/React/TS), `backend/` (FastAPI), and `ml/` (PyTorch).
- Do not put all application logic in a monolithic structure; use feature-oriented organization.

## 2. Dependency Direction
- **Frontend** strictly consumes the API and owns the user experience.
- **Backend** orchestrates inference, handles media uploads, and manages secrets.
- **ML** provides the mathematical inference logic and acts as a separate package.

## 3. Training vs Inference Separation
- **Training code** MUST remain entirely separate from **inference code**.
- The production backend MUST NEVER execute training loops, gradient updates, or dataset loaders.
- Production should only execute `load_model()`, `preprocess()`, `infer()`, and `postprocess()`.

## 4. API Versioning
- All public application APIs MUST use `/api/v1/`.
- Do not build unversioned application endpoints, as the contract will inevitably evolve.
- An unversioned `/health` endpoint is permitted ONLY as an infrastructure/liveness probe when required by deployment infrastructure (e.g., container health checks, load balancers). It must never contain business logic, data models, or versioned application state.
- The API inference contract must be frozen early so frontend and backend can develop in parallel.

## 5. Incremental Development
- Development MUST follow an incremental sequence, starting with the smallest verifiable milestone.
- **Milestone 0 (M0):** Must be a raw baseline proving `model -> inference -> prediction` with one image, using no frontend, no video, and no database.

## 6. Architecture Decision Records (ADRs)
- Important technical decisions (e.g., database choices, deployment platforms, major dependencies) MUST be documented as Architecture Decision Records (ADRs) in `docs/adrs/`.

## 7. AI Agent Boundaries
- Agents must NOT execute massive, unrestricted "build the project" commands.
- Agents must request review for file deletion, system config changes, dropping databases, and large refactors.
