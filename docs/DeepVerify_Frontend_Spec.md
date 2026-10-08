# DeepVerify: Product & Frontend Specification

## 1. Product Vision
DeepVerify is not just a research demo; it is a serious, sophisticated tool for detecting AI-generated media. We explored three primary directions:

1. **Scientific Forensic Laboratory**: Highly technical, cluttered with charts, aimed at researchers.
2. **Minimalist Research-Grade Analyzer**: Stark white, academic, functional but visually dry.
3. **Premium AI Security Platform**: Sleek, authoritative, dark-themed, and highly polished. Aimed at journalists, analysts, and security-conscious individuals.

**Recommendation: Premium AI Security Platform**
DeepVerify should feel like a state-of-the-art intelligence tool. It should evoke trust through precision, speed, and absolute clarity. The emotional response should be *awe at the technology* combined with *confidence in the result*. It should be memorable for its fluid micro-animations and crystal-clear presentation of evidence, avoiding "black box" mystery.

## 2. Information Architecture
For V1, we must ruthlessly prioritize features that prove the core technology without requiring extensive infrastructure.

- **MUST HAVE**: 
  - Landing / Analyzer Workspace (The core interaction)
  - Result View (The core output)
  - Privacy / Security Notice (Critical for trust)
  - Authentication (Sign up / Log in)
  - User Dashboard & Saved Analyses (Persistent history)
- **HIGH VALUE**: 
  - Methodology / "How it Works" (Explains Spatial vs. Frequency ensemble to build trust)
- **OPTIONAL / WOW (V1.1)**: 
  - Client-side PDF Report Export
- **FUTURE**: 
  - Video Analysis (ML is currently frozen to image-only).

## 3. User Journeys
**A. First-time Anonymous User:**
Lands on the page $\rightarrow$ Reads the 1-sentence value proposition and the "Zero Data Retention" privacy badge $\rightarrow$ Drags an image onto the glowing dropzone $\rightarrow$ Watches the processing timeline $\rightarrow$ Views the result $\rightarrow$ Uses the opacity slider to explore the Grad-CAM heatmap.

**B. User Encountering an Error:**
Uploads a `.gif` or a 50MB file $\rightarrow$ The dropzone instantly turns amber $\rightarrow$ Displays a crisp, human-readable error ("Unsupported format. Please upload a JPEG or PNG under 10MB.") $\rightarrow$ Reset button appears.

**C. Logged-in User Dashboard:**
User logs in $\rightarrow$ Lands on a personalized Dashboard $\rightarrow$ Sees aggregate stats (e.g., "15 Images Scanned, 4 Likely Fake") $\rightarrow$ Browses a grid of "Saved Analyses" with thumbnail previews $\rightarrow$ Clicks a past result to reopen the full evidence page.

**D. User Reviewing Evidence:**
Result page loads $\rightarrow$ "LIKELY AUTHENTIC" banner drops in $\rightarrow$ User looks at the 60/40 ensemble breakdown $\rightarrow$ User hovers over the image to reveal the spatial Grad-CAM heatmap using a magnifying "lens" or an opacity slider $\rightarrow$ User clicks "Save to Dashboard."

## 4. Analyzer Experience
*Concepts explored: Split-screen, minimal upload button, large drag-and-drop workspace, command-center.*

**Recommendation: Command-Center Style Interface**
The entire above-the-fold screen acts as a focused workspace. A large, dashed-border glassmorphic dropzone sits in the center. 
- **Upload Interaction**: Dragging a file over the window dims the background and highlights the dropzone with an electric blue glow.
- **Validation**: Client-side checks for >10MB or wrong extensions *before* hitting the API to save bandwidth.
- **Empty State**: Subtle abstract frequency waves animate in the background to show the platform is "alive."

## 5. Analysis / Processing Experience
We will NOT use a fake 0-100% progress bar. The API is asynchronous, returning a 202, so we will poll and display **truthful, sequential states** in a terminal-style log or a stepping timeline:
1. *Validating media integrity...*
2. *Extracting spatial features (EfficientNet-B0)...*
3. *Analyzing log-magnitude frequency spectrum...*
4. *Computing 60/40 ensemble probabilities...*
5. *Generating Grad-CAM spatial evidence...*
6. *Finalizing cryptographic result...*

**Visual Treatment**: While polling, the uploaded image sits in the center with a futuristic laser-scan line sweeping up and down, mapping directly to the technical steps lighting up in the UI.

## 6. Results Experience
The result page must balance absolute clarity with deep technical transparency.
- **Primary Focus**: The Verdict ("LIKELY AUTHENTIC" in Emerald Green, "LIKELY AI GENERATED" in Crimson Red) and the Confidence Score (e.g., 85.4%).
- **The Evidence**: An interactive image canvas. The user sees the original image. Below it, an interactive **Glassmorphic Opacity Slider** allows them to fade in the Grad-CAM heatmap over the original image.
- **Model Signals**: A side panel showing the exact math: Spatial Probability (x 0.6) + Frequency Probability (x 0.4) = Ensemble.
- **Limitations Text**: Explicitly states "Grad-CAM indicates regions of model activation, not definitive causal proof."

## 7. AI-Powered Features
*Concept: "Explain this Result" using an LLM to interpret the heatmap and probability.*
- **Verdict for V1**: **DO NOT INCLUDE**. 
- **Why**: It requires integrating OpenAI/Anthropic APIs, introduces hallucination risks where the LLM might invent reasons for the Grad-CAM activations, and expands backend scope. V1 should let the math speak for itself. 

## 8. Authentication
**Verdict for V1**: **Required/Optional Login for Advanced Features**.
Since UI and features are not frozen, V1 will include a robust authentication system (e.g., JWT-based email/password or OAuth via Google/GitHub). 
- Anonymous users can perform a limited number of ephemeral scans.
- Logged-in users unlock the **Dashboard**, allowing them to securely persist their analysis history and configure privacy settings.

## 9. History / Analysis Management
**Verdict for V1**: **Dashboard & Saved Analyses**.
Users will have a dedicated Dashboard route (`/dashboard`) containing:
- **Recent Scans Grid**: Thumbnails of uploaded images with their verdict badges (Authentic/Fake).
- **Search & Filter**: Ability to filter past analyses by date or verdict.
- **Privacy Controls**: Options to explicitly delete a saved analysis from the cloud.
*(Note: This dictates that the backend will soon need to upgrade from the current in-memory store to a persistent database like PostgreSQL to support user records and history).*

## 10. Reporting
**Verdict for V1**: **Client-side Screenshot/Export**.
Instead of storing reports on the backend and managing shareable URLs (which requires a DB), the frontend will use the browser's native print-to-PDF or `html2canvas` to snap the DOM of the Result Page and generate a beautiful, downloadable report locally.

## 11. Visual Design
- **Theme**: Deep Dark Mode. Backgrounds in `#0A0A0A` (True Black) and `#121212` (Surface).
- **Typography**: `Inter` for clean legibility, with a monospace font (`Fira Code` or `JetBrains Mono`) for model probabilities and request IDs to emphasize the technical nature.
- **Color Palette**: 
  - Primary Accent: Electric Cyan (`#00E5FF`)
  - Authentic: Emerald (`#10B981`)
  - AI Generated: Crimson (`#EF4444`)
- **Aesthetics**: Glassmorphism (translucent panels with background blur) and subtle 1px borders to separate components without heavy shadows.

## 12. "WOW" & Mind-Blowing Features
To elevate DeepVerify from a great tool to a **work of art**, we will incorporate features that make the invisible forensic data viscerally tangible to the user, without altering the frozen ML backend:

1. **3D Topographical Heatmap (WebGL)**: Instead of just a flat color overlay, we use React Three Fiber to render the Grad-CAM heatmap as a 3D displacement map. The regions identified as "AI-generated" physically bulge out of the image. The user can click and drag to rotate the image in 3D space, exploring the exact contours of the model's suspicion.
2. **Live Frequency Spectrum Visualizer**: Since our ML uses a Frequency-domain EfficientNet, the frontend will perform a real-time Fast Fourier Transform (FFT) in the browser (via Canvas API). It visually renders the 2D frequency spectrum of the image right next to the result, letting users *see* the grid-like artifact patterns that the ML model detected.
3. **Client-Side EXIF & Metadata Forensics**: The frontend instantly tears down the image file in the browser, visualizing hidden EXIF data, missing ICC profiles, or software signatures (e.g., Photoshop, Midjourney) in an interactive node-graph, adding deterministic evidence alongside the ML probabilities.
4. **Error Level Analysis (ELA) Lens**: A magnifying glass tool that the user drags over the image. Inside the glass, it runs a client-side ELA filter, revealing differences in JPEG compression rates to visually expose spliced or manipulated regions.
5. **The Interactive Opacity Slider**: A custom, buttery-smooth glassmorphic slider that overlays the ML heatmap on the original image.
6. **Cybernetic Report Generation**: When a user clicks "Export Report", instead of silently downloading a PDF, the UI transforms into a cinematic terminal. It visually "compiles" the evidence, stitching the 3D map, frequency charts, and probabilities together on-screen before handing over a heavily stylized, intelligence-grade PDF dossier.

## 13. Responsive Design
- **Desktop**: Split-screen result view. Image/Heatmap on the left (60%), Evidence/Signals panel on the right (40%).
- **Mobile**: Stacks vertically. The terminal-style log during processing condenses to a single active line. The opacity slider becomes thicker for touch targets.

## 14. Accessibility & Security UX
- **Security UX**: A prominent "Ephemeral Processing" badge. The UI explicitly tells the user: "Your image is deleted immediately after processing. We retain zero data."
- **A11y**: Full keyboard navigation for the dropzone and sliders. High-contrast text modes.

## 15. Frontend Architecture
- **Framework**: React + Vite. (Next.js is overkill since we need no SSR or API routes).
- **Styling**: Vanilla CSS Modules with custom variables for maximum control over micro-animations and exact color precision. (Tailwind is avoided per system rules unless requested).
- **State**: React Context or local component state for holding the current `request_id` and polling state.
- **API Client**: Standard `fetch` wrapped in a custom polling hook to handle the `202 Accepted` $\rightarrow$ Polling $\rightarrow$ `200 OK` lifecycle.

## 16. Frontend ↔ Backend Contract
The proposed UX utilizes the existing API for core inference:
- `POST /analyze/image` $\rightarrow$ Triggers the terminal log UI.
- `GET /results/{request_id}` $\rightarrow$ Polled every 1s to advance the UI.
- `GET /results/{request_id}/heatmap.png` $\rightarrow$ Fetched and drawn into the interactive slider overlay.

**Required Backend Expansions for UI:**
To support the Dashboard and Authentication, the backend will need new API endpoints in a future iteration (e.g., `POST /api/v1/auth`, `GET /api/v1/users/me/history`), backed by a persistent database (PostgreSQL).

## 17. V1 Scope Matrix

| Feature | Impact | Complexity | V1 | V1.1 | Future |
| :--- | :--- | :--- | :---: | :---: | :---: |
| Command-Center Dropzone | High | Low | ✅ | | |
| Truthful Terminal Polling Log | High | Med | ✅ | | |
| 3D Topographical Heatmap | High | High | ✅ | | |
| Live Frequency Visualizer | High | Med | ✅ | | |
| Client-Side EXIF Forensics | Med | Low | ✅ | | |
| Authentication System | High | High | ✅ | | |
| Dashboard & Saved Analyses | High | High | ✅ | | |
| Cybernetic PDF Export | High | Med | | ✅ | |
| Error Level Analysis (ELA) | Med | Med | | ✅ | |
| LLM Result Explanation | Low | High | | | ✅ |
| Video Analysis | High | High | | | ✅ |

## 18. Final Recommendation for Implementation
**We build the "Premium AI Security Platform" as a React (Vite) Single Page Application.**

1. **Pages**: 
   - `/` (Landing & Analyzer)
   - `/login` & `/signup` (Auth)
   - `/dashboard` (Saved Analyses & History)
   - `/result/:id` (Detailed evidence view)
2. **Visuals**: Dark mode, Inter typography, glassmorphic panels.
3. **Core Journey**: User logs in $\rightarrow$ uploads an image $\rightarrow$ watches a terminal-style log while the backend polls $\rightarrow$ sees a striking Emerald/Crimson verdict $\rightarrow$ inspects the Grad-CAM heatmap $\rightarrow$ saves it to their Dashboard for future review.
4. **Backend Alignment**: The core inference utilizes the 202 Polling architecture. The addition of Auth/History will dictate a forthcoming backend update to introduce a database layer.
