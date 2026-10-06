# DeepVerify — Error Model

> **Status:** Defined for Phase 1+  
> **Applies to:** All API error responses  
> **Source:** Architecture Audit Section 7, `.agents/rules/security.md`

---

## 1. ERROR RESPONSE STRUCTURE

Every error response uses this envelope:

```json
{
  "error": {
    "code":       "<ErrorCode>",
    "message":    "<Human-readable description>",
    "request_id": "<UUID | null>"
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `code` | `string` | Machine-readable stable code. See Section 2. |
| `message` | `string` | Human-readable description. Safe to display to end users. Must not leak stack traces, file paths, or internal state. |
| `request_id` | `string (UUID) \| null` | Present when a `request_id` was assigned before the error occurred. |

---

## 2. ERROR CODE CATALOG

### 2.1 Input / Media Validation Errors (4xx)

These errors indicate the client submitted an invalid or unsupported request.  
The client is responsible for correction.

| Code | HTTP Status | Description |
|---|---|---|
| `INVALID_FILE` | 400 | File is missing, empty, or structurally malformed (cannot be parsed as any recognized format). |
| `INVALID_MAGIC_BYTES` | 400 | File extension or MIME type does not match actual file signature (magic bytes). Likely spoofed or corrupted file. |
| `UNSUPPORTED_FORMAT` | 415 | File format is not supported (e.g., GIF, BMP, HEIC for images; MKV for video). |
| `FILE_TOO_LARGE` | 413 | File size exceeds configured maximum. |
| `VIDEO_TOO_LONG` | 422 | Video duration exceeds maximum allowed duration. |
| `TOO_MANY_FRAMES` | 422 | Video contains more frames than the configured frame limit. |
| `RESOLUTION_TOO_LARGE` | 422 | Image or video resolution exceeds maximum allowed dimensions (decompression bomb protection). |
| `DECOMPRESSION_FAILED` | 422 | File cannot be decoded/decompressed (corrupt content). |
| `FACE_NOT_DETECTED` | 422 | *(Phase 6+ — FF++ facial analysis mode only)* No face could be detected in the submitted media. |

### 2.2 Inference / Processing Errors (5xx)

These errors indicate a server-side failure unrelated to the client's input.

| Code | HTTP Status | Description |
|---|---|---|
| `PROCESSING_FAILED` | 500 | Inference pipeline encountered an unexpected error. |
| `MODEL_UNAVAILABLE` | 503 | The ML model is not loaded or is not currently available. |
| `FRAME_EXTRACTION_FAILED` | 500 | FFmpeg frame extraction from video failed. |
| `EXPLANATION_FAILED` | 500 | Grad-CAM heatmap generation failed (non-blocking — analysis result may still be returned without heatmap). |
| `INTERNAL_ERROR` | 500 | Unclassified internal server error. |

### 2.3 Routing / Resource Errors (4xx)

| Code | HTTP Status | Description |
|---|---|---|
| `NOT_FOUND` | 404 | No analysis record found for the given `request_id`. |
| `METHOD_NOT_ALLOWED` | 405 | HTTP method not supported for this endpoint. |

---

## 3. LOGGING CONTRACT

Per `.agents/rules/security.md`:

The following are logged server-side for every inference event:

```
request_id | timestamp | model_version | media_type | processing_time_ms | status | error_code
```

The following are **NEVER logged:**
- Raw file binary payloads.
- Personally Identifiable Information (PII).
- Passwords, tokens, or credentials.
- Internal stack traces in API responses (stack traces go to server-side logging only).

---

## 4. DESIGN RULES

1. Error codes are **stable** — once defined, a code must not change its meaning.
2. New error codes may be added in future phases without a version bump.
3. `message` fields are safe for end-user display and must never contain internal paths, stack traces, or credential fragments.
4. Error codes are uppercase, underscore-separated constants (e.g., `FILE_TOO_LARGE`).
