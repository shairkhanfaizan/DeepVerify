# DeepVerify System Architecture (V2 Production)

> **Notice**: For the full, granular specification with sequence traces and mathematical formulations, see [SYSTEM_ARCHITECTURE.md](file:///home/shairkhan-faizan/Documents/College/SEM5%20MINI%20PROJECT/DeepVerify/docs/SYSTEM_ARCHITECTURE.md).

---

## 1. Concrete System Architecture Diagram

```mermaid
flowchart TD
    subgraph TIER1 ["1. Presentation Tier (frontend/src/)"]
        P_Dash["Dashboard.tsx\n• 14-Day Timeline Line Chart\n• Real vs AI Ratio Stat Cards\n• Quick Photo Intake"]
        P_Bench["ForensicWorkbench.tsx\n• 2D & 3D WebGL Grad-CAM Heatmap\n• 2D-FFT Fourier Spectrogram\n• Grounded AI Assistant Chat"]
        P_Comp["InvestigationComparison.tsx\n• Synchronized Photo Diff"]
        P_Repo["ReportsFindings.tsx\n• Dossier Manager & PDF Downloader"]
        P_Auth["Login.tsx & AuthContext.tsx\n• Dual Auth: dv_auth_token in localStorage + Cookies"]
        API_TS["services/api.ts\n• resolveApiBase(): localhost:8000 ↔ Render URL\n• fetchApi(endpoint, options): Injects Bearer JWT"]
        SecImg["components/ui/SecureImage.tsx\n• Authenticated Blob Loader & Memory Cache"]
        ThreeD["components/ThreeDHeatmap.tsx\n• Three.js Interactive 3D Surface Elevation Mesh"]
        
        P_Dash & P_Bench & P_Comp & P_Repo & P_Auth --> API_TS
        P_Bench --> ThreeD
        P_Bench & P_Dash & P_Comp --> SecImg
    end

    subgraph TIER2 ["2. Backend API Gateway (backend/app/)"]
        FastAPI_App["main.py (FastAPI App)\n• Lifespan adapter loader & CORS"]
        R_Auth["api/v2/endpoints/auth.py\n• /login, /register, /me"]
        R_Inv["api/v2/endpoints/investigations.py\n• Cases, evidence upload, analyze, heatmap, report"]
        SecUp["core/security_upload.py\n• Magic byte MIME check, SVG disallow, max 10MB\n• SHA-256 deterministic fingerprinting"]
        Deps["api/deps.py\n• Bearer JWT session validation"]

        API_TS -->|HTTP REST + Bearer JWT| FastAPI_App
        FastAPI_App --> R_Auth & R_Inv
        R_Auth --> Deps
        R_Inv --> SecUp
    end

    subgraph TIER3 ["3. Orchestration & ML Subsystem"]
        JobRunner["services/v2_pipeline.py\n• AnalysisJob state machine: QUEUED → RUNNING → COMPLETED\n• asyncio.Semaphore(1) locks memory"]
        Ad_Spatial["adapters/spatial.py : DeepVerifySpatialAdapter\n• Config: experiments/configs/EXP-001.yaml\n• Model: EfficientNet-B0 on 224x224 RGB\n• Signal: SPATIAL_PROBABILITY_REAL\n• Explain: Grad-CAM on top_conv layer"]
        Ad_Freq["adapters/frequency.py : DeepVerifyFrequencyAdapter\n• Config: experiments/configs/EXP-002.yaml\n• Model: EfficientNet-B0 (Spectral Head)\n• Transform: 2D-FFT + fftshift + log(1 + |F(u,v)|)\n• Signal: FREQUENCY_PROBABILITY_REAL"]
        Ensemble["Ensemble Policy (ensemble-v1.0)\n• Score = 0.60 * Spatial + 0.40 * Frequency\n• Threshold = 0.50 (≥0.50 Authentic, <0.50 AI)"]
        Colormap["Colormap Renderer\n• Matplotlib 'jet' colormap applied to Grad-CAM array\n• Saves transparent PNG heatmap artifact"]

        R_Inv -->|Trigger Async Job| JobRunner
        JobRunner --> Ad_Spatial & Ad_Freq
        Ad_Spatial --> Ensemble
        Ad_Spatial --> Colormap
        Ad_Freq --> Ensemble
    end

    subgraph TIER4 ["4. Data & Persistence Tier"]
        DB[("PostgreSQL Database\n(users, investigations, evidence_items,\nanalysis_jobs, evidence_observations,\nevidence_signals, analysis_results)")]
        Storage["Object Storage (app/core/storage.py)\n• LocalStorageProvider (backend/storage/)\n• SupabaseStorageProvider (Supabase REST 1GB)\n• R2StorageProvider (Cloudflare R2 S3)"]

        SecUp -->|Save raw image by SHA-256| Storage
        Colormap -->|Save heatmap PNG| Storage
        R_Inv & JobRunner & Ensemble --> DB
    end

    subgraph TIER5 ["5. Supporting Services"]
        Gemini["services/assistant.py\n• Google Gemini 2.5 Flash grounded prompt"]
        PDFGen["services/reporting.py\n• ReportLab PDF forensic dossier generator"]

        R_Inv --> Gemini & PDFGen
    end
```

---

## 2. Key Architecture Principles Implemented in Code

1. **Dual-Domain Evaluation**:
   - Spatial evaluation evaluates pixel-space artifacts (blending lines, facial irregularities, anatomical flaws) using `EfficientNet-B0`.
   - Frequency evaluation applies **2D Fast Fourier Transform** to expose periodic noise fingerprints in the frequency spectrum left by diffusion and GAN upsamplers.
2. **Cryptographic Provenance**:
   - Every uploaded image is immediately hashed using SHA-256 (`file_hash`) during input validation. The raw file is stored using this immutable key.
3. **Decoupled Object Storage**:
   - `StorageInterface` allows zero-code switching between Local Storage, Supabase (1 GB free persistent tier), and Cloudflare R2.
4. **Dual-Mode Client Authentication**:
   - The React client supports both cross-origin `Authorization: Bearer <token>` in `localStorage` and `HttpOnly` cookie authentication.
5. **Grounded Explainability**:
   - Instead of unguided AI generation, the AI Assistant receives the deterministic image observations (dimensions, format, color mode), spatial probability, and frequency probability before responding.
