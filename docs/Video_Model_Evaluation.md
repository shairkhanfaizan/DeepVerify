# Milestone 6: Pretrained Video Model Evaluation

## 1. Executive Summary
This document evaluates the feasibility of adopting an existing pretrained model from Hugging Face for DeepVerify's planned expansion into video forensics. 

Based on an inspection of the current repository constraints and three candidate models, **we recommend proceeding with a phased integration of `Vansh180/VideoMae-ffc23-deepfake-detector` for temporal analysis, supplemented by `KoreaPeter/ms-eff-gcvit-deepfake-b0-ff-plus-plus` for high-accuracy spatial frame analysis.** However, due to critical limitations regarding non-facial synthetic generation (e.g., OpenAI Sora, Runway), DeepVerify must retain its existing image analysis pipelines and cannot rely exclusively on these models for general generative video detection.

## 2. Current Repository Context
Before evaluating the models, the following DeepVerify backend constraints were verified:
- **Ingestion (Upload):** `validate_and_hash_image` explicitly rejects MP4/WebM. Video upload support must be built from scratch.
- **Inference Pipeline:** `v2_pipeline.py` currently accepts a single image buffer. It does not possess video decoding, keyframe extraction (e.g., FFmpeg/`decord`), or face-tracking capabilities.
- **Data Contracts:** The database schema (`EvidenceSignal`, `AnalysisResult`) supports single-value outcomes. To support video, the schema or reporting logic must adapt to handle per-frame timelines or aggregated video-level scores.
- **Reporting:** Reports rely on static heatmaps and single-score findings. Scientific honesty rules dictate that uncalibrated model outputs cannot be presented as absolute probabilities.

## 3. Candidate Model Evaluation

### Candidate 1: `Vansh180/VideoMae-ffc23-deepfake-detector`
- **Detection Target:** Facial deepfakes and temporal manipulation.
- **Input Mechanism:** Requires manual frame extraction (e.g., sampling 16 frames uniformly using `decord`), which are then passed to a `VideoMAEImageProcessor`.
- **Training & Metrics:** Fine-tuned on FaceForensics++ (C23 compression). Reports 88.0% Accuracy and 0.836 AUC. 
- **Limitations:** Explicitly notes degradation on heavily compressed social media videos and unseen manipulation methods. 
- **License:** MIT (Commercially safe).
- **Feasibility:** High. It provides true spatiotemporal analysis (evaluating motion across time) rather than just averaging static frame scores.

### Candidate 2: `KoreaPeter/ms-eff-gcvit-deepfake-b0-ff-plus-plus`
- **Detection Target:** Facial deepfakes (Spatial / Local & Global artifacts).
- **Input Mechanism:** Evaluates at the *frame level*. The pipeline samples $N$ frames and runs YOLO face detection before classifying.
- **Training & Metrics:** Trained on FaceForensics++. Reports an exceptionally high 98.08% Accuracy in-domain, but generalization drops significantly on Celeb-DF-v2 (72.5%) and KoDF (75.4%).
- **Limitations:** It is fundamentally a spatial model applied to video frames, not a temporal model. It requires a face to be present (YOLO dependency).
- **License:** MIT (Commercially safe).
- **Feasibility:** High, but better utilized as an upgrade to our existing static spatial branch rather than a dedicated temporal video model. 

### Candidate 3: `shylhy/videomae-large-finetuned-deepfake-subset`
- **Detection Target:** Facial deepfakes (Deepfake Detection Challenge subset).
- **Input Mechanism:** VideoMAE architecture (requires frame extraction).
- **Training & Metrics:** Lacks published evaluation metrics (only reports training loss). Model card is incomplete ("More information needed").
- **License:** `cc-by-nc-4.0` (Non-Commercial).
- **Feasibility:** **Rejected**. The non-commercial license violates our ability to integrate this into an enterprise-ready or broadly deployable product, and the lack of metrics makes it unreliable.

## 4. Key Finding: Facial Forgery vs. Fully Synthetic Scenes
A critical limitation identified across *all* evaluated candidates is their strict adherence to **facial manipulation datasets** (FaceForensics++, DFC). 
- These models detect face swaps, lip-sync manipulation, and facial reenactment.
- **They are not trained to detect fully AI-generated scenes** (e.g., Sora generating a landscape or animals, Runway Gen-2 generating synthetic motion).
- If a user uploads a Sora-generated video of a city street, models dependent on face-cropping (like Candidate 2) will fail entirely, and models trained solely on facial artifacts (Candidate 1) will produce unpredictable, uncalibrated confidence scores.

## 5. Evaluation Strategy & Metrics
Before full integration, we must perform a controlled, isolated evaluation script (not modifying production code) to validate cross-dataset generalization.

**Evaluation Dataset Requirements:**
1. **In-Domain:** FaceForensics++ samples.
2. **Out-of-Domain (Faces):** Celeb-DF-v2 or WildDeepfake.
3. **Out-of-Domain (Scene/Generative):** A curated set of OpenAI Sora, Runway Gen-2, and Luma Dream Machine samples containing no humans.

**Metrics:**
- **AUROC (Area Under the Receiver Operating Characteristic Curve):** Primary metric for separability.
- **EER (Equal Error Rate):** To determine practical threshold calibration.
- **Latency / VRAM:** Measure FFmpeg extraction time + PyTorch inference time on a T4/L4 GPU.

## 6. Architecture & Integration Recommendations
We recommend **reusing pretrained models** (Candidate 1 for temporal, Candidate 2 for spatial frames) rather than training from scratch, but with strict boundary constraints.

### Proposed Integration (If Approved)
1. **Preserve Existing Image Pipeline:** Do not overwrite `v2_pipeline.py`. The existing image models must remain available, especially the 2D-FFT frequency model, which is highly capable of detecting non-facial generative grid artifacts that video models will miss.
2. **Video Ingest Worker:** Update `security_upload.py` to allow MP4/WebM. Create a new Celery/async task specifically for video that extracts frames using FFmpeg/`decord`.
3. **Parallel Scoring:** The video is passed to the temporal model (VideoMAE) for motion anomalies, and keyframes are passed to the spatial/frequency models.
4. **No Automated Averaging:** Do not blindly average a facial deepfake model score with a spatial scene model score. The UI must present them as independent branches (e.g., "Temporal Face Forgery Score" vs. "Static Generative Artifact Score").

## 7. Smoke Test Results (Engineering Sanity Check)
A standalone evaluation script (`scripts/evaluate_video_models.py`) was executed to perform a technical sanity check on `Vansh180/VideoMae-ffc23-deepfake-detector`. 

Because no genuine video samples existed in the repository, the script tested the pipeline mechanics using 10 auto-generated synthetic `.mp4` files (5 solid-color clips, 5 random-noise clips).

**Verified Engineering Results (CPU Inference):**
- **Model Loading Time:** 21.70s (including initial ~345MB weight download from Hugging Face).
- **Frame Extraction:** 0.030s average per video (extracting 16 frames uniformly). `decord` successfully processed videos without requiring system-level FFmpeg installation.
- **Inference Latency:** 2.780s average per 2-second video clip on CPU.
- **Peak Memory:** 936.76 MB required during the forward pass.

**Invalid / Non-Representative Outcomes:**
- The model returned a deterministic prediction of "Real" (approx ~52-53% confidence) for all synthetic clips, yielding a meaningless 50% accuracy on this dummy set.
- **Untested:** True detection accuracy, AUC, and calibration on actual human deepfakes remain entirely untested. The current results cannot be used to justify the model's detection performance.

## 8. Environment Changes & Sandbox Bypass
To run the smoke test in DeepVerify's network-isolated environment, a temporary sandbox bypass was explicitly authorized. The following artifacts were created and remain in the workspace:
1. **Virtual Environment:** `test_venv/` was created. Packages `torch`, `transformers`, `decord`, and `imageio[ffmpeg]` were installed directly from PyPI.
2. **Model Cache:** The Hugging Face `safetensors` checkpoints and configs for the model were downloaded into the local Hugging Face cache (typically `~/.cache/huggingface/hub/`).
3. **Dummy Data:** 10 synthetic `.mp4` files were generated inside `test_videos/`.
*Note: No production dependencies, API routes, or image pipelines were modified.*

## 9. FaceForensics++ Dataset Access & Pilot Preparation (Gate 2)
An official download script for FaceForensics++ has been identified (`faceforensics_download_v4.py`). Before proceeding, the following constraints and procedures have been verified:

### A. Dataset Terms & Usage Restrictions
- **Licensing Distinction:** While the code repository is MIT-licensed, the dataset itself is governed by strict Terms of Use (ToS).
- **Access Restrictions:** Receiving the download script link does not bypass the ToS. Academic or non-profit usage does not automatically remove the liability and restrictions. The download script prompts the user to explicitly accept these terms before initiating the download. 
- **Constraint Checklist:** I have *not* accepted these terms on behalf of the user, nor have I executed the download script.

### B. Download Script Mechanics & Sample Selection
- **Supported Datasets:** Includes `original`, `Deepfakes`, `Face2Face`, `FaceSwap`, `NeuralTextures`, `FaceShifter`, and `DeepFakeDetection`.
- **Compression Options:** `raw` (lossless), `c23` (used by VideoMAE), and `c40`.
- **Sample Selection (The `-n` flag):** The script does not natively support downloading specific dataset splits (e.g., train/val/test). It supports capping the download count via the `-n` (num_videos) argument, which simply pulls the first `N` items from the master list chronologically. 
- **Pairing Warning:** Using `-n 10` for both `original` and `Deepfakes` does *not* guarantee perfectly paired videos (i.e., we cannot assume manipulated video `000_001.mp4` directly corresponds to the first original video `000.mp4`). However, for a binary real/fake classification smoke-test, perfect pairwise alignment is not required, provided the ground-truth labels are sound.

### C. Preprocessing & Label Mapping Verification
The `scripts/evaluate_video_models.py` implementation has been reviewed to ensure mechanical correctness:
- **Preprocessing:** The script correctly uses `decord` to uniformly extract exactly 16 frames from the video container, matching the `VideoMAEImageProcessor` expectations defined in the model card.
- **Label Mapping:** The model card explicitly documents index 0 as `real` (authentic) and index 1 as `fake` (manipulated). The evaluation script correctly maps `outputs.logits[0]` to `real` and `outputs.logits[1]` to `fake`.

### D. Scope: Within-Dataset Smoke Test Only
The `Vansh180/VideoMae-ffc23-deepfake-detector` model card states it was evaluated on a "held-out validation split." However, the exact indices of this split are not published.
**Crucial Limitation:** Because we do not know which FaceForensics++ videos the author used for training versus testing, we cannot establish whether our evaluation split is truly independent. The checkpoint's exact training indices are unknown.
**Therefore, the proposed pilot is strictly classified as an exploratory, within-dataset smoke test.** Any results obtained must *not* be described as independent validation or evidence of real-world generalization.

### E. Proposed Clean Directory Structure
The dataset files, metadata, and evaluation outputs will be stored securely and excluded from public Git commits (verified in `.gitignore`):
```text
DeepVerify/data/samples/video/
├── original/c23/videos/ (10 .mp4 files)
├── Deepfakes/c23/videos/ (10 .mp4 files)
├── evaluation_outputs/
└── pilot_labels.json
```
*(The existing production image pipelines remain untouched.)*

## 10. Next Action (Requires Approval)
**Status: BLOCKED (Server Outage)**
On October 10, 2026, an attempt to download the official `faceforensics_download_v4.py` script failed due to `Connection refused` (port 443) on `kaldir.vc.in.tum.de`. The Technical University of Munich (TUM) servers hosting FaceForensics++ appear to be offline or misconfigured, preventing access to the download script and datasets.

**Action Required:**
We must either:
1. **Wait** for the TUM servers to come back online, then retry the download commands below.
2. **Pivot** to an alternative dataset (such as the Deepfake Detection Challenge (DFDC) preview dataset or Celeb-DF-v2) that has active hosting, which will require a new data acquisition plan and approval.

*(If the servers are restored, the authorized human should execute the following exact commands):*
```bash
wget http://kaldir.vc.in.tum.de/faceforensics_download_v4.py # Note: Fall back to http if https fails
mkdir -p data/samples/video
python faceforensics_download_v4.py data/samples/video/ -d original -c c23 -t videos -n 10 --server EU2
python faceforensics_download_v4.py data/samples/video/ -d Deepfakes -c c23 -t videos -n 10 --server EU2
```
