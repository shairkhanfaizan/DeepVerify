import os

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1480 1140" width="100%" height="100%" style="background:#070d1e; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <defs>
    <!-- Gradients -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070d1e"/>
      <stop offset="50%" stop-color="#0a142c"/>
      <stop offset="100%" stop-color="#070d1e"/>
    </linearGradient>

    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00C2FF"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>

    <linearGradient id="boxBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f2347"/>
      <stop offset="100%" stop-color="#091730"/>
    </linearGradient>

    <linearGradient id="boxCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0e2a40"/>
      <stop offset="100%" stop-color="#081b2b"/>
    </linearGradient>

    <linearGradient id="boxPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1f1847"/>
      <stop offset="100%" stop-color="#120e2e"/>
    </linearGradient>

    <linearGradient id="boxGreen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d2e26"/>
      <stop offset="100%" stop-color="#071c17"/>
    </linearGradient>

    <linearGradient id="boxAmber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2d2210"/>
      <stop offset="100%" stop-color="#1c1407"/>
    </linearGradient>

    <!-- Filters -->
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.5"/>
    </filter>

    <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Arrow Markers -->
    <marker id="arrowCyan" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
      <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#00C2FF" />
    </marker>
    <marker id="arrowBlue" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
      <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#38bdf8" />
    </marker>
    <marker id="arrowPurple" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
      <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#818cf8" />
    </marker>
    <marker id="arrowGreen" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
      <path d="M 0 0 L 9 4.5 L 0 9 z" fill="#34d399" />
    </marker>
  </defs>

  <!-- Background Base -->
  <rect width="1480" height="1140" fill="url(#bgGrad)" />

  <!-- Grid Overlay Pattern -->
  <g opacity="0.04" stroke="#ffffff" stroke-width="1">
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" />
    </pattern>
    <rect width="1480" height="1140" fill="url(#grid)" />
  </g>

  <!-- Title Header Block -->
  <g transform="translate(60, 40)">
    <text x="0" y="24" font-size="28" font-weight="800" fill="url(#headerGrad)" letter-spacing="0.5">DeepVerify · Production System Architecture</text>
    <text x="0" y="48" font-size="13.5" font-weight="400" fill="#94a3b8">End-to-End Concrete Architecture: Client Workstation → FastAPI Gateway → Dual-Domain ML Inference (Spatial + 2D-FFT) → Persistence</text>
  </g>

  <!-- ========================================================================= -->
  <!-- TIER 1: PRESENTATION LAYER -->
  <!-- ========================================================================= -->
  <g transform="translate(60, 110)">
    <!-- Container -->
    <rect width="1360" height="195" rx="14" fill="#0c1733" stroke="#1e3a8a" stroke-width="1.5" filter="url(#shadow)" />
    <rect x="0" y="0" width="1360" height="34" rx="14" fill="#13244d" />
    <rect x="0" y="20" width="1360" height="14" fill="#13244d" />
    
    <circle cx="22" cy="17" r="4.5" fill="#ef4444" />
    <circle cx="38" cy="17" r="4.5" fill="#f59e0b" />
    <circle cx="54" cy="17" r="4.5" fill="#10b981" />
    <text x="75" y="21" font-size="13" font-weight="700" fill="#93c5fd" letter-spacing="0.5">TIER 1: PRESENTATION LAYER (React 18 · TypeScript · Vite · Tailwind)</text>
    <text x="1230" y="21" font-size="11" font-weight="600" fill="#38bdf8">frontend/src/</text>

    <!-- Cards Inside Tier 1 -->
    <!-- Card 1: Dashboard -->
    <g transform="translate(20, 50)">
      <rect width="250" height="125" rx="8" fill="url(#boxBlue)" stroke="#1d4ed8" stroke-width="1" />
      <text x="14" y="24" font-size="13" font-weight="700" fill="#60a5fa">Dashboard.tsx</text>
      <text x="14" y="45" font-size="11" fill="#cbd5e1">• 14-Day Chronological Trend</text>
      <text x="14" y="63" font-size="11" fill="#cbd5e1">• Real vs AI Ratio Distribution</text>
      <text x="14" y="81" font-size="11" fill="#cbd5e1">• Drag-and-Drop Photo Intake</text>
      <text x="14" y="99" font-size="11" fill="#cbd5e1">• Recent Dossier Table (17 Cases)</text>
    </g>

    <!-- Card 2: Forensic Workbench -->
    <g transform="translate(290, 50)">
      <rect width="280" height="125" rx="8" fill="url(#boxBlue)" stroke="#1d4ed8" stroke-width="1" />
      <text x="14" y="24" font-size="13" font-weight="700" fill="#60a5fa">ForensicWorkbench.tsx</text>
      <text x="14" y="45" font-size="11" fill="#cbd5e1">• Split-Pane Zoomable Inspector</text>
      <text x="14" y="63" font-size="11" fill="#38bdf8">• 2D Grad-CAM Attention Heatmap</text>
      <text x="14" y="81" font-size="11" fill="#818cf8">• 3D Three.js Elevation Mesh View</text>
      <text x="14" y="99" font-size="11" fill="#34d399">• 2D-FFT Fourier Log-Magnitude Tab</text>
      <text x="14" y="115" font-size="11" fill="#f59e0b">• Grounded AI Assistant Dialog</text>
    </g>

    <!-- Card 3: Compare & Reports -->
    <g transform="translate(590, 50)">
      <rect width="240" height="125" rx="8" fill="url(#boxBlue)" stroke="#1d4ed8" stroke-width="1" />
      <text x="14" y="24" font-size="13" font-weight="700" fill="#60a5fa">Analysis & Export Pages</text>
      <text x="14" y="45" font-size="11" fill="#cbd5e1">• InvestigationComparison.tsx</text>
      <text x="14" y="63" font-size="10.5" fill="#94a3b8">  (Synchronized Dual Photo Diff)</text>
      <text x="14" y="81" font-size="11" fill="#cbd5e1">• ReportsFindings.tsx</text>
      <text x="14" y="99" font-size="10.5" fill="#94a3b8">  (Case Dossier Manager & Export)</text>
      <text x="14" y="115" font-size="11" fill="#38bdf8">• One-Click Vector PDF Export</text>
    </g>

    <!-- Card 4: Networking & State -->
    <g transform="translate(850, 50)">
      <rect width="250" height="125" rx="8" fill="url(#boxCyan)" stroke="#0284c7" stroke-width="1" />
      <text x="14" y="24" font-size="13" font-weight="700" fill="#38bdf8">Networking: services/api.ts</text>
      <text x="14" y="45" font-size="11" fill="#cbd5e1">• Dynamic Host Resolution</text>
      <text x="14" y="63" font-size="10.5" fill="#94a3b8">  (localhost:8000 ↔ Render URL)</text>
      <text x="14" y="81" font-size="11" fill="#cbd5e1">• Injects Bearer Token Header</text>
      <text x="14" y="99" font-size="11" fill="#cbd5e1">• Multi-part FormData boundary</text>
      <text x="14" y="115" font-size="11" fill="#34d399">• ApiError & Detailed HTTP Detail</text>
    </g>

    <!-- Card 5: Auth & Components -->
    <g transform="translate(1120, 50)">
      <rect width="220" height="125" rx="8" fill="url(#boxPurple)" stroke="#6366f1" stroke-width="1" />
      <text x="14" y="24" font-size="13" font-weight="700" fill="#a5b4fc">Auth & Components</text>
      <text x="14" y="45" font-size="11" fill="#cbd5e1">• AuthContext.tsx</text>
      <text x="14" y="63" font-size="10.5" fill="#94a3b8">  (Token in localStorage)</text>
      <text x="14" y="81" font-size="11" fill="#cbd5e1">• SecureImage.tsx</text>
      <text x="14" y="99" font-size="10.5" fill="#94a3b8">  (Auth blob stream cache)</text>
      <text x="14" y="115" font-size="11" fill="#cbd5e1">• ThreeDHeatmap.tsx</text>
    </g>
  </g>

  <!-- Connective Link 1 -> 2 -->
  <path d="M 740 305 L 740 340" stroke="#00C2FF" stroke-width="2.5" fill="none" marker-end="url(#arrowCyan)" />
  <rect x="620" y="312" width="240" height="20" rx="4" fill="#08142c" stroke="#00C2FF" stroke-width="1" />
  <text x="740" y="326" font-size="10.5" font-weight="600" fill="#00C2FF" text-anchor="middle">HTTPS / REST + Authorization: Bearer JWT</text>

  <!-- ========================================================================= -->
  <!-- TIER 2: API GATEWAY & SECURITY LAYER -->
  <!-- ========================================================================= -->
  <g transform="translate(60, 345)">
    <rect width="1360" height="145" rx="14" fill="#0c1733" stroke="#0284c7" stroke-width="1.5" filter="url(#shadow)" />
    <rect x="0" y="0" width="1360" height="34" rx="14" fill="#0d244a" />
    <rect x="0" y="20" width="1360" height="14" fill="#0d244a" />
    <text x="24" y="21" font-size="13" font-weight="700" fill="#38bdf8" letter-spacing="0.5">TIER 2: API GATEWAY, VALIDATION &amp; SECURITY CONTROLS (FastAPI · Uvicorn ASGI)</text>
    <text x="1230" y="21" font-size="11" font-weight="600" fill="#38bdf8">backend/app/</text>

    <!-- Sub-cards Tier 2 -->
    <!-- Card 1: Auth Endpoints -->
    <g transform="translate(20, 48)">
      <rect width="300" height="85" rx="8" fill="url(#boxPurple)" stroke="#4f46e5" stroke-width="1" />
      <text x="14" y="22" font-size="12" font-weight="700" fill="#a5b4fc">api/v2/endpoints/auth.py</text>
      <text x="14" y="42" font-size="11" fill="#cbd5e1">• POST /login (Issues JWT + Cookie)</text>
      <text x="14" y="58" font-size="11" fill="#cbd5e1">• POST /register (Bcrypt Hash)</text>
      <text x="14" y="74" font-size="11" fill="#cbd5e1">• GET /me (Validates active session)</text>
    </g>

    <!-- Card 2: Investigations Endpoints -->
    <g transform="translate(340, 48)">
      <rect width="400" height="85" rx="8" fill="url(#boxCyan)" stroke="#0284c7" stroke-width="1" />
      <text x="14" y="22" font-size="12" font-weight="700" fill="#38bdf8">api/v2/endpoints/investigations.py</text>
      <text x="14" y="42" font-size="11" fill="#cbd5e1">• POST /investigations/ (Create Case Dossier)</text>
      <text x="14" y="58" font-size="11" fill="#cbd5e1">• POST /{id}/evidence (Multipart Upload &amp; Hash)</text>
      <text x="14" y="74" font-size="11" fill="#cbd5e1">• POST /{id}/evidence/{ev_id}/analyze (Enqueue)</text>
    </g>

    <!-- Card 3: Security & Hashing -->
    <g transform="translate(760, 48)">
      <rect width="320" height="85" rx="8" fill="url(#boxGreen)" stroke="#059669" stroke-width="1" />
      <text x="14" y="22" font-size="12" font-weight="700" fill="#34d399">core/security_upload.py</text>
      <text x="14" y="40" font-size="10.5" fill="#cbd5e1">• Magic Bytes Inspection (filetype)</text>
      <text x="14" y="55" font-size="10.5" fill="#cbd5e1">• Disallow SVG scripts (Anti-XSS guard)</text>
      <text x="14" y="70" font-size="10.5" fill="#cbd5e1">• Enforce 10 MB &amp; 4096px Max Bounds</text>
      <text x="14" y="85" font-size="10.5" fill="#38bdf8">• Deterministic SHA-256 Checksum</text>
    </g>

    <!-- Card 4: Middleware & Auth Deps -->
    <g transform="translate(1100, 48)">
      <rect width="240" height="85" rx="8" fill="url(#boxBlue)" stroke="#1d4ed8" stroke-width="1" />
      <text x="14" y="22" font-size="12" font-weight="700" fill="#60a5fa">Security Middleware</text>
      <text x="14" y="42" font-size="11" fill="#cbd5e1">• CORSMiddleware (allow regex)</text>
      <text x="14" y="58" font-size="11" fill="#cbd5e1">• deps.py : get_current_user()</text>
      <text x="14" y="74" font-size="11" fill="#cbd5e1">• Role-Based Access (Examiner)</text>
    </g>
  </g>

  <!-- Connective Link 2 -> 3 -->
  <path d="M 740 490 L 740 525" stroke="#38bdf8" stroke-width="2.5" fill="none" marker-end="url(#arrowBlue)" />
  <rect x="630" y="497" width="220" height="20" rx="4" fill="#08142c" stroke="#38bdf8" stroke-width="1" />
  <text x="740" y="511" font-size="10.5" font-weight="600" fill="#38bdf8" text-anchor="middle">Enqueue Job → process_analysis_job()</text>

  <!-- ========================================================================= -->
  <!-- TIER 3: PIPELINE & INFERENCE SUBSYSTEM -->
  <!-- ========================================================================= -->
  <g transform="translate(60, 530)">
    <rect width="1360" height="315" rx="14" fill="#0c1733" stroke="#4f46e5" stroke-width="1.5" filter="url(#shadow)" />
    <rect x="0" y="0" width="1360" height="34" rx="14" fill="#1b1c54" />
    <rect x="0" y="20" width="1360" height="14" fill="#1b1c54" />
    <text x="24" y="21" font-size="13" font-weight="700" fill="#a5b4fc" letter-spacing="0.5">TIER 3: DUAL-TRACK ML INFERENCE &amp; ASYNC PIPELINE ORCHESTRATOR</text>
    <text x="1170" y="21" font-size="11" font-weight="600" fill="#a5b4fc">services/v2_pipeline.py</text>

    <!-- Orchestrator Status Controller -->
    <g transform="translate(20, 50)">
      <rect width="360" height="70" rx="8" fill="url(#boxPurple)" stroke="#6366f1" stroke-width="1" />
      <text x="14" y="22" font-size="12" font-weight="700" fill="#a5b4fc">Job Orchestrator &amp; Semaphore Lock</text>
      <text x="14" y="42" font-size="11" fill="#cbd5e1">• AnalysisJob State Machine: QUEUED → RUNNING → COMPLETED</text>
      <text x="14" y="60" font-size="11" fill="#38bdf8">• asyncio.Semaphore(1) restricts concurrent GPU/CPU memory</text>
    </g>

    <!-- Ensemble Calculator Card -->
    <g transform="translate(400, 50)">
      <rect width="530" height="70" rx="8" fill="url(#boxAmber)" stroke="#d97706" stroke-width="1" />
      <text x="14" y="22" font-size="12" font-weight="700" fill="#fcd34d">Ensemble Policy Evaluator: Policy 'ensemble-v1.0'</text>
      <text x="14" y="42" font-size="12" font-weight="600" fill="#ffffff">Score = 0.60 × Spatial_Probability + 0.40 × Frequency_Probability</text>
      <text x="14" y="60" font-size="11" fill="#cbd5e1">Threshold = 0.50 (≥ 0.50 → LIKELY_AUTHENTIC | &lt; 0.50 → LIKELY_AI_GENERATED)</text>
    </g>

    <!-- Colormap Generator Card -->
    <g transform="translate(950, 50)">
      <rect width="390" height="70" rx="8" fill="url(#boxGreen)" stroke="#059669" stroke-width="1" />
      <text x="14" y="22" font-size="12" font-weight="700" fill="#34d399">Explainability: Matplotlib Colormap Engine</text>
      <text x="14" y="42" font-size="11" fill="#cbd5e1">• Applies Matplotlib 'jet' colormap over Grad-CAM array</text>
      <text x="14" y="60" font-size="11" fill="#cbd5e1">• Exports transparent PNG overlay to Object Storage (ai_explanation)</text>
    </g>

    <!-- Sub-track A: Spatial -->
    <g transform="translate(20, 135)">
      <rect width="640" height="165" rx="10" fill="#0b1738" stroke="#0284c7" stroke-width="1.2" />
      <rect x="0" y="0" width="640" height="28" rx="10" fill="#0d2b52" />
      <rect x="0" y="16" width="640" height="12" fill="#0d2b52" />
      <text x="16" y="19" font-size="12" font-weight="700" fill="#38bdf8">TRACK A: SPATIAL DOMAIN MODEL (adapters/spatial.py · EXP-001)</text>

      <g transform="translate(16, 40)">
        <rect width="180" height="110" rx="6" fill="#081836" stroke="#1d4ed8" stroke-width="1" />
        <text x="10" y="20" font-size="11" font-weight="700" fill="#60a5fa">1. Preprocessing</text>
        <text x="10" y="40" font-size="10.5" fill="#cbd5e1">• Input: RGB Pixels</text>
        <text x="10" y="58" font-size="10.5" fill="#cbd5e1">• Resize: 224 × 224</text>
        <text x="10" y="76" font-size="10.5" fill="#cbd5e1">• ImageNet Norm:</text>
        <text x="10" y="94" font-size="10" fill="#94a3b8">  mean=[0.485,0.456...]</text>
      </g>

      <path d="M 205 95 L 225 95" stroke="#00C2FF" stroke-width="2" marker-end="url(#arrowCyan)" />

      <g transform="translate(235, 40)">
        <rect width="210" height="110" rx="6" fill="#081836" stroke="#0284c7" stroke-width="1" />
        <text x="10" y="20" font-size="11" font-weight="700" fill="#38bdf8">2. Neural Architecture</text>
        <text x="10" y="38" font-size="10.5" fill="#ffffff" font-weight="600">• EfficientNet-B0 Backbone</text>
        <text x="10" y="56" font-size="10" fill="#cbd5e1">• Pretrained: IMAGENET1K_V1</text>
        <text x="10" y="74" font-size="10" fill="#cbd5e1">• Fine-tuned on 140k dataset</text>
        <text x="10" y="92" font-size="10" fill="#cbd5e1">• Dropout: 0.20 | Classes: 2</text>
      </g>

      <path d="M 455 95 L 475 95" stroke="#00C2FF" stroke-width="2" marker-end="url(#arrowCyan)" />

      <g transform="translate(485, 40)">
        <rect width="140" height="110" rx="6" fill="#081836" stroke="#059669" stroke-width="1" />
        <text x="10" y="20" font-size="11" font-weight="700" fill="#34d399">3. Output &amp; XAI</text>
        <text x="10" y="38" font-size="10" fill="#38bdf8" font-weight="600">• Probability Real</text>
        <text x="10" y="54" font-size="9.5" fill="#94a3b8">  (SPATIAL_SIGNAL)</text>
        <text x="10" y="74" font-size="10" fill="#34d399" font-weight="600">• Grad-CAM Heatmap</text>
        <text x="10" y="90" font-size="9.5" fill="#94a3b8">  Activations at top_conv</text>
        <text x="10" y="102" font-size="9.5" fill="#94a3b8">  (Facial anomalies)</text>
      </g>
    </g>

    <!-- Sub-track B: Frequency -->
    <g transform="translate(700, 135)">
      <rect width="640" height="165" rx="10" fill="#0b1738" stroke="#4f46e5" stroke-width="1.2" />
      <rect x="0" y="0" width="640" height="28" rx="10" fill="#1b1c54" />
      <rect x="0" y="16" width="640" height="12" fill="#1b1c54" />
      <text x="16" y="19" font-size="12" font-weight="700" fill="#a5b4fc">TRACK B: FREQUENCY DOMAIN MODEL (adapters/frequency.py · EXP-002)</text>

      <g transform="translate(16, 40)">
        <rect width="180" height="110" rx="6" fill="#0f1136" stroke="#6366f1" stroke-width="1" />
        <text x="10" y="20" font-size="11" font-weight="700" fill="#a5b4fc">1. 2D Fourier Transform</text>
        <text x="10" y="40" font-size="10.5" fill="#cbd5e1">• Discrete 2D-FFT</text>
        <text x="10" y="58" font-size="10.5" fill="#cbd5e1">• Zero-centering (fftshift)</text>
        <text x="10" y="76" font-size="10.5" fill="#cbd5e1">• Log-magnitude:</text>
        <text x="10" y="94" font-size="10" fill="#818cf8">  log(1 + |F(u, v)|)</text>
      </g>

      <path d="M 205 95 L 225 95" stroke="#818cf8" stroke-width="2" marker-end="url(#arrowPurple)" />

      <g transform="translate(235, 40)">
        <rect width="210" height="110" rx="6" fill="#0f1136" stroke="#4f46e5" stroke-width="1" />
        <text x="10" y="20" font-size="11" font-weight="700" fill="#818cf8">2. Neural Architecture</text>
        <text x="10" y="38" font-size="10.5" fill="#ffffff" font-weight="600">• EfficientNet-B0 (Spectral)</text>
        <text x="10" y="56" font-size="10" fill="#cbd5e1">• Custom Spectral Head</text>
        <text x="10" y="74" font-size="10" fill="#cbd5e1">• Detects upsampling grid</text>
        <text x="10" y="92" font-size="10" fill="#cbd5e1">• GAN/Diffusion periodic traces</text>
      </g>

      <path d="M 455 95 L 475 95" stroke="#818cf8" stroke-width="2" marker-end="url(#arrowPurple)" />

      <g transform="translate(485, 40)">
        <rect width="140" height="110" rx="6" fill="#0f1136" stroke="#059669" stroke-width="1" />
        <text x="10" y="20" font-size="11" font-weight="700" fill="#34d399">3. Output &amp; Signals</text>
        <text x="10" y="38" font-size="10" fill="#818cf8" font-weight="600">• Probability Real</text>
        <text x="10" y="54" font-size="9.5" fill="#94a3b8">  (FREQUENCY_SIGNAL)</text>
        <text x="10" y="74" font-size="10" fill="#a5b4fc" font-weight="600">• Fourier Spectrogram</text>
        <text x="10" y="90" font-size="9.5" fill="#94a3b8">  Energy distribution</text>
        <text x="10" y="102" font-size="9.5" fill="#94a3b8">  in frequency space</text>
      </g>
    </g>
  </g>

  <!-- Connective Links 3 -> 4 & 5 -->
  <path d="M 400 845 L 400 885" stroke="#34d399" stroke-width="2.5" fill="none" marker-end="url(#arrowGreen)" />
  <path d="M 1080 845 L 1080 885" stroke="#38bdf8" stroke-width="2.5" fill="none" marker-end="url(#arrowBlue)" />

  <!-- ========================================================================= -->
  <!-- TIER 4: PERSISTENCE & STORAGE TIER -->
  <!-- ========================================================================= -->
  <g transform="translate(60, 890)">
    <rect width="880" height="210" rx="14" fill="#0c1733" stroke="#059669" stroke-width="1.5" filter="url(#shadow)" />
    <rect x="0" y="0" width="880" height="34" rx="14" fill="#0b2e24" />
    <rect x="0" y="20" width="880" height="14" fill="#0b2e24" />
    <text x="24" y="21" font-size="13" font-weight="700" fill="#34d399" letter-spacing="0.5">TIER 4: RELATIONAL DATABASE SCHEMA (PostgreSQL · SQLAlchemy Async Engine)</text>
    <text x="750" y="21" font-size="11" font-weight="600" fill="#34d399">backend/app/db/models.py</text>

    <!-- Schema Tables Grid -->
    <g transform="translate(20, 48)">
      <rect width="190" height="70" rx="6" fill="#081e18" stroke="#10b981" stroke-width="1" />
      <text x="10" y="18" font-size="11" font-weight="700" fill="#34d399">users</text>
      <text x="10" y="34" font-size="9.5" fill="#cbd5e1">PK id (UUID)</text>
      <text x="10" y="48" font-size="9.5" fill="#cbd5e1">email, hashed_password</text>
      <text x="10" y="62" font-size="9.5" fill="#cbd5e1">role ('investigator')</text>
    </g>

    <g transform="translate(230, 48)">
      <rect width="190" height="70" rx="6" fill="#081e18" stroke="#10b981" stroke-width="1" />
      <text x="10" y="18" font-size="11" font-weight="700" fill="#34d399">investigations (Cases)</text>
      <text x="10" y="34" font-size="9.5" fill="#cbd5e1">PK id (UUID), FK user_id</text>
      <text x="10" y="48" font-size="9.5" fill="#cbd5e1">title, notes, status ('OPEN')</text>
      <text x="10" y="62" font-size="9.5" fill="#cbd5e1">created_at, updated_at</text>
    </g>

    <g transform="translate(440, 48)">
      <rect width="200" height="70" rx="6" fill="#081e18" stroke="#10b981" stroke-width="1" />
      <text x="10" y="18" font-size="11" font-weight="700" fill="#34d399">evidence_items (Photos)</text>
      <text x="10" y="34" font-size="9.5" fill="#cbd5e1">PK id, FK investigation_id</text>
      <text x="10" y="48" font-size="9.5" fill="#cbd5e1">file_hash (SHA-256), mime_type</text>
      <text x="10" y="62" font-size="9.5" fill="#cbd5e1">storage_key, status ('COMPLETED')</text>
    </g>

    <g transform="translate(660, 48)">
      <rect width="200" height="70" rx="6" fill="#081e18" stroke="#10b981" stroke-width="1" />
      <text x="10" y="18" font-size="11" font-weight="700" fill="#34d399">analysis_results</text>
      <text x="10" y="34" font-size="9.5" fill="#cbd5e1">PK id, FK evidence_id, policy_id</text>
      <text x="10" y="48" font-size="9.5" fill="#cbd5e1">verdict, ensemble_score</text>
      <text x="10" y="62" font-size="9.5" fill="#cbd5e1">ai_explanation (Heatmap URI)</text>
    </g>

    <g transform="translate(20, 126)">
      <rect width="190" height="70" rx="6" fill="#081e18" stroke="#10b981" stroke-width="1" />
      <text x="10" y="18" font-size="11" font-weight="700" fill="#34d399">analysis_jobs</text>
      <text x="10" y="34" font-size="9.5" fill="#cbd5e1">PK id, FK evidence_id</text>
      <text x="10" y="48" font-size="9.5" fill="#cbd5e1">status ('QUEUED'/'COMPLETED')</text>
      <text x="10" y="62" font-size="9.5" fill="#cbd5e1">started_at, completed_at</text>
    </g>

    <g transform="translate(230, 126)">
      <rect width="190" height="70" rx="6" fill="#081e18" stroke="#10b981" stroke-width="1" />
      <text x="10" y="18" font-size="11" font-weight="700" fill="#34d399">evidence_signals</text>
      <text x="10" y="34" font-size="9.5" fill="#cbd5e1">PK id, FK evidence_id</text>
      <text x="10" y="48" font-size="9.5" fill="#cbd5e1">signal_type (SPATIAL/FREQ)</text>
      <text x="10" y="62" font-size="9.5" fill="#cbd5e1">value, model_id, provenance</text>
    </g>

    <g transform="translate(440, 126)">
      <rect width="200" height="70" rx="6" fill="#081e18" stroke="#10b981" stroke-width="1" />
      <text x="10" y="18" font-size="11" font-weight="700" fill="#34d399">evidence_observations</text>
      <text x="10" y="34" font-size="9.5" fill="#cbd5e1">PK id, FK evidence_id</text>
      <text x="10" y="48" font-size="9.5" fill="#cbd5e1">ORIGINAL_FILENAME, FORMAT</text>
      <text x="10" y="62" font-size="9.5" fill="#cbd5e1">DIMENSIONS ('256x256')</text>
    </g>

    <g transform="translate(660, 126)">
      <rect width="200" height="70" rx="6" fill="#081e18" stroke="#10b981" stroke-width="1" />
      <text x="10" y="18" font-size="11" font-weight="700" fill="#34d399">analysis_policies</text>
      <text x="10" y="34" font-size="9.5" fill="#cbd5e1">PK id, version ('ensemble-v1.0')</text>
      <text x="10" y="48" font-size="9.5" fill="#cbd5e1">weights: {'spatial': 0.6, 'freq': 0.4}</text>
      <text x="10" y="62" font-size="9.5" fill="#cbd5e1">decision_threshold: 0.50</text>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- TIER 5: STORAGE & SUPPORTING SERVICES -->
  <!-- ========================================================================= -->
  <g transform="translate(960, 890)">
    <rect width="460" height="210" rx="14" fill="#0c1733" stroke="#0284c7" stroke-width="1.5" filter="url(#shadow)" />
    <rect x="0" y="0" width="460" height="34" rx="14" fill="#0e2a47" />
    <rect x="0" y="20" width="460" height="14" fill="#0e2a47" />
    <text x="20" y="21" font-size="13" font-weight="700" fill="#38bdf8" letter-spacing="0.5">TIER 5: STORAGE &amp; SUPPORTING SERVICES</text>

    <!-- Storage Provider Sub-Card -->
    <g transform="translate(16, 48)">
      <rect width="428" height="70" rx="6" fill="url(#boxCyan)" stroke="#0284c7" stroke-width="1" />
      <text x="12" y="18" font-size="11" font-weight="700" fill="#38bdf8">StorageInterface (app/core/storage.py)</text>
      <text x="12" y="36" font-size="10.5" fill="#cbd5e1">• LocalStorageProvider: storage/ directory on host</text>
      <text x="12" y="52" font-size="10.5" fill="#cbd5e1">• SupabaseStorageProvider: 1 GB free persistent bucket via REST</text>
      <text x="12" y="66" font-size="10" fill="#94a3b8">• R2StorageProvider: Cloudflare S3 boto3 API | Path Traversal Protection</text>
    </g>

    <!-- External Services Sub-Card -->
    <g transform="translate(16, 126)">
      <rect width="428" height="70" rx="6" fill="url(#boxPurple)" stroke="#6366f1" stroke-width="1" />
      <text x="12" y="18" font-size="11" font-weight="700" fill="#a5b4fc">Auxiliary Microservices</text>
      <text x="12" y="36" font-size="10.5" fill="#cbd5e1">• services/assistant.py: Google Gemini 2.5 Flash Grounding</text>
      <text x="12" y="52" font-size="10" fill="#94a3b8">  (Prompt injected with real spatial/frequency scores &amp; EXIF data)</text>
      <text x="12" y="66" font-size="10.5" fill="#cbd5e1">• services/reporting.py: ReportLab Court-Admissible Vector PDF Export</text>
    </g>
  </g>

</svg>"""

with open("docs/architecture_diagram.svg", "w") as f:
    f.write(svg_content)

print("SVG generated successfully at docs/architecture_diagram.svg")
