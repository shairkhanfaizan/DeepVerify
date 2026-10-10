# EXP-004 — Generalization Dataset Selection Study

## Objective
To identify the optimal primary external dataset for DeepVerify EXP-004. The dataset must cleanly test whether a model trained on the `140k Real and Fake Faces v1.0` benchmark (which uses StyleGAN for fakes and FFHQ for reals) can detect unseen AI-generated human faces (cross-generator generalization).

## Experiment Types in Face Forensics
Understanding the exact nature of the training distribution is critical for a valid generalization test:
- **TYPE A**: Unseen AI-generated human faces (Synthetic from scratch; e.g., StyleGAN, Stable Diffusion).
- **TYPE B**: Manipulated/deepfake human faces (Face swaps, expression reenactment; e.g., DeepFakes, Face2Face).
- **TYPE C**: Cross-generator synthetic faces (Training on StyleGAN, testing on Diffusion).
- **TYPE D**: Cross-domain synthetic images (Training on faces, testing on objects/animals).

*Our 140k training distribution is TYPE A. Therefore, our primary EXP-004 objective is a TYPE A/C evaluation. TYPE D (like CIFAKE) is invalid. TYPE B (like FaceForensics++) introduces manipulation artifacts distinct from synthesis artifacts.*

---

## Candidate 1: ArtiFact (Face Subset / Stable Diffusion)
- **Paper/Source**: Rahman et al., "ArtiFact: A Large-Scale Dataset for Generalizable Synthetic Image Detection" (2023)
- **Real-image source**: CelebA-HQ, FFHQ
- **Fake-image source**: Stable Diffusion, Latent Diffusion, DDPM (plus various GANs)
- **Generation/manipulation method**: Pure Synthesis (TYPE A)
- **Resolution**: Typically 256x256 or 512x512 (ideal for our 224x224 pipeline)
- **Image/video nature**: Independent images
- **Number of usable images**: Hundreds of thousands (Face class subset)
- **Official split**: Provided in the repository metadata
- **Subject/source identity separation**: Yes, purely synthetic vs real datasets.
- **Overlap with 140k**: If the FFHQ subset is used, there is overlap in the REAL class. Using CelebA-HQ isolates this.
- **Licensing**: Open / MIT / CC
- **Download/access mechanism**: Direct download (Kaggle/HuggingFace)
- **Expected preprocessing**: Center crop / Resize to 224x224
- **Primary research value**: Explicitly designed for cross-generator testing (TYPE C).
- **Major limitations**: Huge total download size (2.5M images); requires downloading metadata and filtering specifically for the 'face' class and 'Stable Diffusion' generator.

### Scoring (ArtiFact - Face/Diffusion Subset)
1. Domain match: 5/5 (Faces)
2. Generator/source independence: 5/5 (Stable Diffusion vs StyleGAN)
3. Resolution suitability: 5/5 (256x256+)
4. Label quality: 5/5 (Cryptographically known sources)
5. Provenance/reproducibility: 5/5 (Published benchmark)
6. Dataset size: 5/5 (Massive)
7. Evaluation cleanliness: 4/5 (Requires subset filtering)
8. Licensing/accessibility: 5/5 (Open)
**Total: 39/40**

---

## Candidate 2: Celeb-DF (v2)
- **Paper/Source**: Li et al., CVPR 2020
- **Real-image source**: YouTube celebrity interviews
- **Fake-image source**: Target videos manipulated with high-quality face-swapping
- **Generation/manipulation method**: Manipulation (TYPE B)
- **Resolution**: High resolution video (≥720p)
- **Image/video nature**: Video (highly correlated frames)
- **Number of usable images**: 590 Real videos, 5639 Fake videos
- **Official split**: Yes
- **Overlap with 140k**: None
- **Licensing**: Research only, requires forms
- **Download/access mechanism**: Google Form request approval
- **Expected preprocessing**: Face detection, extraction, alignment, and resizing
- **Primary research value**: Extremely high-quality face-swaps.
- **Major limitations**: 
  1. Tests manipulation (TYPE B) rather than synthesis (TYPE A). 
  2. Evaluating frames independently is statistically invalid due to massive temporal correlation.
  3. Preprocessing (face extraction) introduces spatial/frequency artifacts that confound the evaluation.

### Scoring (Celeb-DF)
1. Domain match: 3/5 (Faces, but TYPE B instead of TYPE A)
2. Generator/source independence: 5/5
3. Resolution suitability: 4/5
4. Label quality: 5/5
5. Provenance/reproducibility: 4/5
6. Dataset size: 2/5 (Frame correlation invalidates large image counts; effectively only ~6000 independent samples)
7. Evaluation cleanliness: 1/5 (Requires complex face extraction preprocessing)
8. Licensing/accessibility: 2/5 (Requires approval, slow access)
**Total: 26/40**

---

## Candidate 3: FaceForensics++ (FF++)
- **Paper/Source**: Rössler et al., ICCV 2019
- **Real-image source**: YouTube videos
- **Fake-image source**: DeepFakes, Face2Face, FaceSwap, NeuralTextures
- **Generation/manipulation method**: Manipulation (TYPE B)
- **Resolution**: 480p, 720p, 1080p
- **Image/video nature**: Video
- **Number of usable images**: 1,000 Real videos, 4,000 Fake videos
- **Official split**: Yes
- **Overlap with 140k**: None
- **Licensing**: Research only, requires forms
- **Download/access mechanism**: Google Form request approval + python script
- **Expected preprocessing**: Face detection/extraction
- **Primary research value**: The industry standard for DeepFake (manipulation) detection.
- **Major limitations**: Same as Celeb-DF. It tests manipulation, frames are correlated, and it requires active face extraction.

### Scoring (FaceForensics++)
1. Domain match: 3/5
2. Generator/source independence: 5/5
3. Resolution suitability: 4/5
4. Label quality: 5/5
5. Provenance/reproducibility: 4/5
6. Dataset size: 2/5
7. Evaluation cleanliness: 1/5
8. Licensing/accessibility: 2/5
**Total: 26/40**

---

## Final Recommendations

### Primary Recommendation: ArtiFact (Stable Diffusion Face Subset + CelebA-HQ)
**Why it is scientifically appropriate:** 
ArtiFact provides the cleanest possible TYPE C (cross-generator) evaluation. By selecting a subset of pure synthetic faces generated by Stable Diffusion and pairing them with CelebA-HQ real faces, we perfectly isolate generator shift (GAN vs Diffusion). It requires no complex face-extraction pipelines that would contaminate the frequency domain (critical for evaluating EXP-002 and EXP-003). It avoids the statistical invalidity of correlated video frames.

### Secondary Recommendation: Celeb-DF (Postponed to V2)
**Why it is justified as secondary:**
While Celeb-DF is the gold standard for TYPE B (manipulation) evaluation, it requires an entirely new preprocessing pipeline (MTCNN/RetinaFace extraction) which alters frequency distributions. It should be reserved for a future milestone (V2) specifically investigating whether synthesis-detectors can transfer to manipulation-detection.

### What must be verified before acquisition:
1. Whether the ArtiFact dataset allows downloading specific class metadata (or specific partitions) without downloading the entire 2.5 million image corpus (which is unfeasible on a ₹0 constraint).
2. If full download is required, we must identify a pre-curated, lightweight Kaggle mirror or a HuggingFace subset script that selectively streams the target images.

### Usability under ₹0/no-paid-GPU constraint:
Yes, provided we can utilize HuggingFace's `datasets` library to selectively stream/download only the ~20,000 images required for a frozen test manifest, bypassing the need for massive local storage or paid cloud buckets.
