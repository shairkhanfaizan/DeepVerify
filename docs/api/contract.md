# DeepVerify — API Contract v1

> **Status:** FROZEN for Phase 1 — Foundation and Contract  
> **Base path:** `/api/v1/`  
> **Format:** JSON (application/json)  
> **Auth:** None at Phase 1 (public API). Authentication requirements: TBD — Phase 8+.  
> **Source:** `docs/DeepVerify_Development_Blueprint.docx` Section 16, Architecture Audit Section 7.

> [!IMPORTANT]
> This document defines the conceptual API contract. Endpoints are NOT implemented yet.  
> Do NOT implement these endpoints until Phase 8. Do NOT modify this contract without updating this document.

---

## 1. VERSIONING

All public application APIs MUST use the `/api/v1/` prefix. The version is immutable for a given major version.  
Per project architecture rules, an unversioned root `/health` endpoint is permitted ONLY as an infrastructure-level liveness probe when required by deployment infrastructure (container health checks, load balancers), and contains no application business logic or state.

When the contract must evolve in a breaking way, a new version `/api/v2/` is introduced.  
The old version is maintained for a deprecation window.

---

## 2. REQUEST ID BEHAVIOR

- Every submission (`POST /api/v1/analyze/*`) generates a server-side UUID `request_id`.
- The `request_id` is returned in the immediate `202 Accepted` response.
- The `request_id` is used to poll for results via `GET /api/v1/results/{request_id}`.
- The `request_id` is included in every error response for traceability.
- The `request_id` is logged server-side at intake.
- Client-supplied identifiers are never trusted as `request_id`.

---

## 3. ENDPOINTS

---

### 3.1 Root Health Check

```
GET /health
```

**Purpose:** Infrastructure-level liveness probe (load balancer, container orchestration).

**Response — 200 OK:**
```json
{
  "status": "ok"
}
```

**Notes:** This endpoint has no API versioning prefix. It does not check model availability — it only verifies the server process is running.

---

### 3.2 Versioned Health / Readiness Check

```
GET /api/v1/health
```

**Purpose:** Application-level readiness check. Verifies the API is operational and — where applicable — that the model is loaded.

**Response — 200 OK (fully ready):**
```json
{
  "status": "ok",
  "api_version": "v1",
  "model_loaded": true,
  "model_version": "spatial-v1.0"
}
```

**Response — 503 Service Unavailable (model not loaded):**
```json
{
  "status": "degraded",
  "api_version": "v1",
  "model_loaded": false,
  "model_version": null,
  "detail": "Model is not available."
}
```

---

### 3.3 Submit Image for Analysis

```
POST /api/v1/analyze/image
Content-Type: multipart/form-data
```

**Purpose:** Accept an image file, validate it, assign a `request_id`, queue analysis.

**Request body (multipart/form-data):**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | binary | ✅ | Image file (JPEG or PNG only) |

**Successful Response — 202 Accepted:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PROCESSING",
  "media_type": "image",
  "message": "Analysis queued. Poll /api/v1/results/{request_id} for result."
}
```

**HTTP Status Codes:**

| Code | Meaning |
|---|---|
| `202 Accepted` | File accepted and analysis queued |
| `400 Bad Request` | Invalid or malformed file/request |
| `413 Content Too Large` | File exceeds size limit |
| `415 Unsupported Media Type` | File format not supported |
| `422 Unprocessable Entity` | File passes format checks but fails content validation (e.g., decompression bomb) |
| `503 Service Unavailable` | Model not loaded |

**Validation Error Response — 400/413/415/422:**
```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "Uploaded file exceeds the maximum allowed size.",
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### 3.4 Submit Video for Analysis

```
POST /api/v1/analyze/video
Content-Type: multipart/form-data
```

**Purpose:** Accept a video file, validate it, assign a `request_id`, queue frame extraction and analysis.

**Request body (multipart/form-data):**

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | binary | ✅ | Video file (MP4, QuickTime, AVI) |

**Successful Response — 202 Accepted:**
```json
{
  "request_id": "661f9511-f30c-52e5-b827-557766551111",
  "status": "PROCESSING",
  "media_type": "video",
  "message": "Analysis queued. Poll /api/v1/results/{request_id} for result."
}
```

**HTTP Status Codes:**

| Code | Meaning |
|---|---|
| `202 Accepted` | File accepted and analysis queued |
| `400 Bad Request` | Invalid or malformed file/request |
| `413 Content Too Large` | File exceeds size limit |
| `415 Unsupported Media Type` | Format not supported |
| `422 Unprocessable Entity` | Video passes format checks but fails content validation (duration, frames, resolution) |
| `503 Service Unavailable` | Model not loaded |

**Validation Error Response — 422:**
```json
{
  "error": {
    "code": "VIDEO_TOO_LONG",
    "message": "Video duration exceeds the maximum allowed length.",
    "request_id": "661f9511-f30c-52e5-b827-557766551111"
  }
}
```

---

### 3.5 Retrieve Analysis Result

```
GET /api/v1/results/{request_id}
```

**Purpose:** Poll for the result of a previously submitted analysis.

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `request_id` | UUID string | ✅ | The UUID returned by `POST /api/v1/analyze/*` |

**Response — 200 OK (completed):**

See Section 5 — Final Result Schema for the full `AnalysisResult` structure.

**Response — 200 OK (still processing):**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PROCESSING",
  "media_type": "image"
}
```

**Response — 404 Not Found:**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "No analysis found for the given request_id.",
    "request_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**HTTP Status Codes:**

| Code | Meaning |
|---|---|
| `200 OK` | Result found (may be PROCESSING or COMPLETED or FAILED) |
| `404 Not Found` | No record exists for this `request_id` |

---

### 3.6 List Available Models *(Phase 8+, optional)*

```
GET /api/v1/models
```

**Purpose:** Return a list of currently loaded model versions.

**Response — 200 OK:**
```json
{
  "models": [
    {
      "name": "spatial-v1.0",
      "type": "spatial",
      "loaded": true
    }
  ]
}
```

**Notes:** This endpoint is deferred to Phase 8. The exact schema may evolve.

---

## 4. COMMON RESPONSE HEADERS

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Request-ID` | Echo of `request_id` where applicable |

---

## 5. FINAL RESULT SCHEMA

See `docs/api/result-schema.md` for the canonical `AnalysisResult` structure.

---

## 6. ERROR MODEL

See `docs/api/error-model.md` for all error codes and categories.
