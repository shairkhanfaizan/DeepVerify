# DeepVerify Backend

The DeepVerify backend is a high-performance FastAPI service responsible for media upload ingestion, sanitization, pipeline orchestration, and proxying requests to the ML inference engine.

## Architectural Boundaries
* **Inference Only:** The backend **NEVER** executes model training routines, loss backpropagation, or dataset loaders.
* **Strict Validation:** Follows `.agents/rules/security.md`:
  - Uploaded files are assigned server-side UUIDs; client filenames are never used for filesystem paths.
  - Media payloads are validated by MIME type, file extension, and magic numbers before saving.
  - Video processing executables (FFmpeg) are invoked via safe argument arrays; no user input is ever passed to shell interpolation.
* **API Versioning:** All endpoints are versioned under `/api/v1/`.
