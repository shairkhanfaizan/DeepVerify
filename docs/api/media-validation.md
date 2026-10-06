# DeepVerify — Media Validation Contract

> **Status:** Defined for Phase 1+. Implementation begins Phase 8 (backend upload handler).  
> **Source:** `.agents/rules/security.md`, Architecture Audit Section 8, Blueprint Section 18–20.

> [!IMPORTANT]
> All validation described here MUST be performed **server-side** in the backend.  
> Client-side hints (file type pickers, size warnings) are UX only and do NOT replace server validation.  
> Do NOT implement this until Phase 8.

---

## 1. VALIDATION SEQUENCE

Every uploaded file must pass **all** of the following checks in order.  
Failure at any step must return the appropriate error code and immediately abort processing.

```
Upload received
    │
    ▼
1. Content-Type / MIME type check        ── server MUST NOT trust the client-supplied type
    │
    ▼
2. File extension check                  ── must match allowed list
    │
    ▼
3. Magic bytes (file signature) check    ── actual binary header, not metadata
    │
    ▼
4. File size check                       ── enforce hard size limit
    │
    ▼
5. Content-specific validation           ── images: resolution / decodability
   (media-type dependent)                ── videos: duration / frame count / resolution
    │
    ▼
6. Assign server-side UUID               ── request_id assigned AFTER validation (or at intake, used in errors)
    │
    ▼
7. Write to controlled temporary path   ── tmp/{uuid}/original.{ext}
    │
    ▼
Ready for inference pipeline
```

---

## 2. IMAGE VALIDATION REQUIREMENTS

> [!NOTE]
> Numerical thresholds below (10 MB size, 4096×4096 px) are **configurable operational/security defaults** (managed via backend configuration/environment variables). They are not immutable architectural requirements and may be tuned after performance and latency testing.

| Check | Rule | Error Code |
|---|---|---|
| Allowed MIME types | `image/jpeg`, `image/png` | `UNSUPPORTED_FORMAT` |
| Allowed extensions | `.jpg`, `.jpeg`, `.png` | `UNSUPPORTED_FORMAT` |
| Magic bytes | JPEG: `FF D8 FF` · PNG: `89 50 4E 47 0D 0A 1A 0A` | `INVALID_MAGIC_BYTES` |
| Max file size (default) | 10 MB (configurable default) | `FILE_TOO_LARGE` |
| Max resolution (default) | 4096 × 4096 pixels (configurable default decompression bomb limit) | `RESOLUTION_TOO_LARGE` |
| Decodability | Image must be fully decodable (not corrupt/truncated) | `DECOMPRESSION_FAILED` |

**Notes:**
- MIME type is checked from the request `Content-Type`, but the magic bytes check is authoritative.
- GIF, WebP, HEIC, BMP, and TIFF are not supported at this stage.

---

## 3. VIDEO VALIDATION REQUIREMENTS

> [!NOTE]
> Video limits below (100 MB, 60s, 300 frames, 1920×1080 px) are **configurable operational/security defaults**. They prevent resource exhaustion during development and may be adjusted after empirical performance testing.

| Check | Rule | Error Code |
|---|---|---|
| Allowed MIME types | `video/mp4`, `video/quicktime`, `video/x-msvideo` | `UNSUPPORTED_FORMAT` |
| Allowed extensions | `.mp4`, `.mov`, `.avi` | `UNSUPPORTED_FORMAT` |
| Magic bytes | MP4/MOV: `ftyp` at byte 4 · AVI: `RIFF` at byte 0 | `INVALID_MAGIC_BYTES` |
| Max file size (default) | 100 MB (configurable default) | `FILE_TOO_LARGE` |
| Max duration (default) | 60 seconds (configurable default) | `VIDEO_TOO_LONG` |
| Max frame count (default) | 300 frames (configurable default frame limit) | `TOO_MANY_FRAMES` |
| Max resolution (default) | 1920 × 1080 pixels (configurable default) | `RESOLUTION_TOO_LARGE` |
| Decodability | First N frames must be decodable by FFmpeg probe | `DECOMPRESSION_FAILED` |

**Notes:**
- Duration and frame count are probed using FFmpeg before processing begins.
- FFmpeg is invoked via safe argument list — no shell interpolation, no user-controlled arguments.
- Accepted video codecs (within supported containers): H.264, H.265. Others: TBD depending on FFmpeg build.

---

## 4. FILESYSTEM SAFETY RULES

Per `.agents/rules/security.md`:

1. **Client-supplied filenames are NEVER used** for filesystem paths or resource identifiers.
2. Every file is stored as `tmp/{request_id}/original.{ext}` where `{ext}` is from the server's validated MIME mapping — not the client filename.
3. Upload storage location must be **outside any executable path** (not inside `backend/app/`).
4. Temporary files must be cleaned up after processing completes (success or failure).

---

## 5. FUTURE CONSIDERATIONS (TBD)

| Topic | Status |
|---|---|
| Additional video codec support | TBD — dependent on FFmpeg build configuration |
| Maximum allowed video resolution | Set to 1920×1080 for Phase 8; may be revised |
| Antivirus scanning of uploads | Not planned at this stage |
| Content moderation for uploads | Out of scope |
