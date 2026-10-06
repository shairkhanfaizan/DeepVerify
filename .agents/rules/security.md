# DeepVerify Security Rules

## 1. Untrusted Media Uploads
- The backend MUST NEVER trust frontend input.
- All uploaded media MUST undergo strict server-side resource-boundary validation before processing.
- Validation checks MUST enforce:
  - MIME type verification
  - Extension matching
  - Actual file signature (magic bytes) validation
  - File size limits
  - Video constraints (duration, frame count)
  - Resolution bounds and decompression / resource usage limits
- Numerical validation thresholds are configurable operational/security defaults rather than immutable architectural requirements.
- The canonical numerical thresholds are defined in `docs/api/media-validation.md`.
- Security enforcement MUST remain strictly consistent with that canonical contract.
- Malformed, oversized, or spoofed inputs must be rejected safely before reaching the inference pipeline.

## 2. Path Traversal & Command Safety
- Ensure robust protection against path traversal attacks during file upload and extraction.
- Uploaded filenames MUST NOT be trusted for filesystem paths or resource identifiers. Use generated server-side identifiers such as UUIDs.
- Never construct shell commands by interpolating user-controlled input.
- FFmpeg and other executables MUST be invoked using controlled executable paths and safely constructed argument lists.
- User-controlled values MUST NOT determine arbitrary executable commands or arguments.

## 3. Secret Management
- **Frontend** MUST NOT contain or expose any private keys, model storage credentials, or database passwords.
- The frontend only knows the public API endpoints.
- **Backend** owns all secrets.
- Secrets MUST be stored in `.env` files and NEVER committed to Git. A `.env.example` should be maintained.

## 4. Safe Logging
- Every inference should be logged for observability, but with strict safety limits.
- **NEVER LOG:**
  - Personally Identifiable Information (PII)
  - Raw passwords or authentication tokens
  - Full binary payloads of uploaded media

## 5. Destructive Commands
- Automated agents MUST NOT execute destructive commands autonomously.
- Explicit human review is required before deleting files, dropping databases, or making significant system-level changes.
