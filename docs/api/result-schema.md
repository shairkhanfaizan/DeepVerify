# DeepVerify — Analysis Result Schema (v1)

> **Status:** Canonical schema for Phase 1+  
> **Applies to:** `GET /api/v1/results/{request_id}` response body (status: COMPLETED)  
> **Source:** Blueprint Section 15, Architecture Audit Section 7.

> [!IMPORTANT]
> Fields marked **FUTURE** are defined here for schema stability but are not populated until their respective development phase.
> Do not return invented values for FUTURE fields — use `null` or omit them entirely.

---

## 1. TOP-LEVEL `AnalysisResult`

```json
{
  "request_id":        "<uuid>",
  "status":            "<AnalysisStatus>",
  "media_type":        "<MediaType>",
  "verdict":           "<Verdict | null>",
  "confidence":        "<float | null>",
  "model_info":        "<ModelInfo | null>",
  "scores":            "<ModelScores | null>",
  "explanation":       "<ExplanationResult | null>",
  "frames":            "<FrameResult[] | null>",
  "processing_meta":   "<ProcessingMeta>",
  "error":             "<ErrorDetail | null>"
}
```

---

## 2. FIELD DEFINITIONS

### `request_id`
- **Type:** `string (UUID)`  
- **Required:** ✅  
- **Nullable:** ❌  
- **Description:** Server-assigned UUID for this submission. Stable for the lifetime of the analysis record.

---

### `status`
- **Type:** `enum AnalysisStatus`  
- **Required:** ✅  
- **Nullable:** ❌  
- **Values:**

| Value | Meaning |
|---|---|
| `PROCESSING` | Submitted and queued or in-progress |
| `COMPLETED` | Analysis finished successfully |
| `FAILED` | Analysis failed; see `error` field |

---

### `media_type`
- **Type:** `enum MediaType`  
- **Required:** ✅  
- **Nullable:** ❌  
- **Values:** `image`, `video`

---

### `verdict`
- **Type:** `enum Verdict`  
- **Required:** ✅ when `status == COMPLETED`  
- **Nullable:** ✅ when `status == PROCESSING`  
- **Values:**

| Value | Meaning |
|---|---|
| `LIKELY_AUTHENTIC` | Model output suggests authentic media |
| `LIKELY_AI_GENERATED` | Model output suggests AI-generated or manipulated media |
| `INCONCLUSIVE` | Model confidence below threshold for a definitive verdict |

> [!IMPORTANT]
> Per `confidence.md`: The verdict MUST be presented as a model probability output, not a factual claim.  
> The UI must never display "This video is FAKE" without appropriate calibration and disclaimers.

---

### `confidence`
- **Type:** `float [0.0, 1.0]`  
- **Required:** ✅ when `status == COMPLETED`  
- **Nullable:** ✅ when `status == PROCESSING`  
- **Description:** Primary confidence score (model probability / output score for the predicted label).  

> [!IMPORTANT]
> This scalar represents a **model probability / output score** and **MUST NOT** be interpreted as a calibrated probability of factual truth unless formal confidence calibration (tracked under TBD-010) has actually been performed.  
> In accordance with `.agents/rules/confidence.md`, the UI must present this value as a model-generated probability score with appropriate disclaimers, never as factual certainty.

---

### `model_info`
- **Type:** `ModelInfo object`  
- **Required:** ✅ when `status == COMPLETED`  
- **Nullable:** ✅ when `status == PROCESSING`

```json
{
  "model_version": "spatial-v1.0",
  "model_type":    "spatial"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `model_version` | string | ✅ | Versioned model identifier (e.g., `spatial-v1.0`) |
| `model_type` | string | ✅ | Model type: `spatial`, `frequency`, `ensemble` |

---

### `scores`
- **Type:** `ModelScores object`  
- **Required:** ✅ when `status == COMPLETED`  
- **Nullable:** ✅ when `status == PROCESSING`  
- **Description:** Per-model raw probability scores where available.

```json
{
  "spatial":   0.95,
  "frequency": null,
  "ensemble":  null
}
```

| Field | Type | Phase | Notes |
|---|---|---|---|
| `spatial` | `float [0,1] \| null` | Phase 2+ | Score from spatial EfficientNet-B0 model |
| `frequency` | `float [0,1] \| null` | **FUTURE — Phase 4** | Score from frequency-domain model. `null` until available. |
| `ensemble` | `float [0,1] \| null` | **FUTURE — Phase 5** | Combined ensemble score. `null` until available. |

> [!NOTE]
> `scores.frequency` and `scores.ensemble` MUST be `null` until those models are built and tested.  
> Never return invented or placeholder score values.

---

### `explanation`
- **Type:** `ExplanationResult object`  
- **Required:** ❌ optional  
- **Nullable:** ✅ (null until Phase 3)  
- **Phase:** Phase 3+ (Grad-CAM)

```json
{
  "heatmap_url": "/api/v1/results/{request_id}/heatmap.png",
  "regions":     null
}
```

| Field | Type | Phase | Notes |
|---|---|---|---|
| `heatmap_url` | `string \| null` | Phase 3+ | URL of Grad-CAM overlay image |
| `regions` | `Region[] \| null` | **TBD-012** | Structure of region objects undefined. Must remain `null` until formally specified. |

> [!IMPORTANT]
> Per `confidence.md`: Grad-CAM heatmaps show where model representation activated.  
> They MUST NOT be presented as proof of which pixels were manipulated.

---

### `frames`
- **Type:** `FrameResult[] | null`  
- **Required:** ❌ optional  
- **Nullable:** ✅ (always null for image; null until Phase 7 for video)  
- **Phase:** Phase 7+ (Video)

```json
[
  {
    "frame_index":    0,
    "timestamp_ms":   0,
    "score":          0.92,
    "verdict":        "LIKELY_AI_GENERATED"
  }
]
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `frame_index` | `int` | ✅ | Zero-based frame index |
| `timestamp_ms` | `int` | ✅ | Frame timestamp in milliseconds |
| `score` | `float [0,1]` | ✅ | Per-frame spatial model score |
| `verdict` | `Verdict` | ✅ | Per-frame verdict |

---

### `processing_meta`
- **Type:** `ProcessingMeta object`  
- **Required:** ✅  
- **Nullable:** ❌

```json
{
  "processing_time_ms": 1420,
  "created_at":         "2026-10-05T18:00:00Z"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `processing_time_ms` | `int` | ✅ | Total server-side processing time in milliseconds |
| `created_at` | `string (ISO 8601 UTC)` | ✅ | Timestamp of analysis creation |

---

### `error`
- **Type:** `ErrorDetail object`  
- **Required:** ✅ when `status == FAILED`  
- **Nullable:** ✅ when `status != FAILED`

```json
{
  "code":    "PROCESSING_FAILED",
  "message": "Model inference encountered an internal error."
}
```

See `docs/api/error-model.md` for all defined error codes.

---

## 3. COMPLETE EXAMPLE — COMPLETED IMAGE RESULT (Phase 2, Spatial only)

> Note: The `"confidence": 0.95` value below illustrates an uncalibrated model probability score. It must not be interpreted as calibrated ground-truth certainty.

```json
{
  "request_id":      "550e8400-e29b-41d4-a716-446655440000",
  "status":          "COMPLETED",
  "media_type":      "image",
  "verdict":         "LIKELY_AI_GENERATED",
  "confidence":      0.95,
  "model_info": {
    "model_version": "spatial-v1.0",
    "model_type":    "spatial"
  },
  "scores": {
    "spatial":    0.95,
    "frequency":  null,
    "ensemble":   null
  },
  "explanation":     null,
  "frames":          null,
  "processing_meta": {
    "processing_time_ms": 840,
    "created_at":         "2026-10-05T18:00:00Z"
  },
  "error":           null
}
```

## 4. COMPLETE EXAMPLE — COMPLETED IMAGE RESULT (Phase 3+, With Grad-CAM)

> Note: The `"confidence": 0.95` value below illustrates an uncalibrated model probability score. It must not be interpreted as calibrated ground-truth certainty.

```json
{
  "request_id":      "550e8400-e29b-41d4-a716-446655440000",
  "status":          "COMPLETED",
  "media_type":      "image",
  "verdict":         "LIKELY_AI_GENERATED",
  "confidence":      0.95,
  "model_info": {
    "model_version": "spatial-v1.0",
    "model_type":    "spatial"
  },
  "scores": {
    "spatial":    0.95,
    "frequency":  null,
    "ensemble":   null
  },
  "explanation": {
    "heatmap_url": "/api/v1/results/550e8400-e29b-41d4-a716-446655440000/heatmap.png",
    "regions":     null
  },
  "frames":          null,
  "processing_meta": {
    "processing_time_ms": 1420,
    "created_at":         "2026-10-05T18:00:00Z"
  },
  "error":           null
}
```

## 5. COMPLETE EXAMPLE — FAILED RESULT

```json
{
  "request_id":      "550e8400-e29b-41d4-a716-446655440000",
  "status":          "FAILED",
  "media_type":      "image",
  "verdict":         null,
  "confidence":      null,
  "model_info":      null,
  "scores":          null,
  "explanation":     null,
  "frames":          null,
  "processing_meta": {
    "processing_time_ms": 120,
    "created_at":         "2026-10-05T18:00:00Z"
  },
  "error": {
    "code":    "MODEL_UNAVAILABLE",
    "message": "The inference model is not currently loaded."
  }
}
```
