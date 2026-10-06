# DeepVerify Frontend

The DeepVerify frontend is a modern React web application built with Vite and TypeScript.

## Responsibilities & Boundaries
* **Pure API Consumer:** Communicates solely with the backend via versioned endpoints (`/api/v1/`).
* **Zero Secrets:** Contains NO private API keys, database credentials, or model weights.
* **Explainability UX:** Renders media upload interfaces, per-frame confidence charts, video timeline scrubbing, and Grad-CAM interpretability overlays.
* **Responsible Communication:** Follows `.agents/rules/confidence.md` — never makes absolute binary claims of "real/fake" without statistical calibration and appropriate disclaimers.
