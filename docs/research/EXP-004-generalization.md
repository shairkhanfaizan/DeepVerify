# EXP-004 — Generalization and Out-of-Distribution Evaluation

## 1. Research Question
Does the DeepVerify spatial-frequency ensemble (EXP-003) trained exclusively on the 140k Real and Fake Faces v1.0 benchmark retain meaningful discriminative performance when evaluated on an independently sourced synthetic-image distribution?

## 2. Hypothesis
**H1**: The detector trained on the 140k Real and Fake Faces distribution will retain meaningful discriminative performance on an independently sourced synthetic-image distribution, indicating that the spatial and frequency features learned generalize beyond a single generator's artifacts.

**H0**: Performance will substantially degrade toward chance-level discrimination, indicating that the learned features are highly overfitted to the specific generator/dataset artifacts of the 140k benchmark.

## 3. Dataset Independence
To rigorously evaluate out-of-distribution (OOD) generalization, the external dataset must remain strictly isolated from the development pipeline. The external dataset **must not** be used to:
- Train or fine-tune models.
- Select or tune ensemble weights (e.g., the 60/40 split from EXP-003 must remain locked).
- Select classification thresholds (must remain fixed at 0.5 for P(REAL)).
- Tune image preprocessing pipelines.

## 4. Dataset-Readiness Checklist (CIFAKE Audit Results)
The CIFAKE dataset was audited as a candidate for EXP-004. The following properties were verified via authoritative public documentation (Bird et al., 2024, IEEE Access):

- [x] **Exact dataset identity/version**: CIFAKE: Real and AI-Generated Synthetic Images.
- [x] **Class definitions**: REAL (Authentic) vs FAKE (AI-Generated).
- [x] **Real/Fake generation method**: Stable Diffusion v1.4 (Fake) vs original photographs (Real).
- [x] **Image count**: 120,000 images total.
- [x] **REAL image count**: 60,000 images.
- [x] **FAKE image count**: 60,000 images.
- [x] **Image format**: JPG/PNG.
- [x] **Image resolution**: 32x32 pixels.
- [x] **Provenance/source**: Kaggle, based on the CIFAR-10 dataset.
- [x] **Train/test structure**: 100,000 Train / 20,000 Test.
- [x] **Overlap risk with the 140k dataset**: Zero overlap. CIFAR-10 contains objects and animals (airplanes, cats, dogs, etc.) and contains NO human faces.
- [x] **Whether preprocessing is required**: Images are 32x32 and would require aggressive upsampling to 224x224.
- [x] **Licensing/usage considerations**: MIT License.
- [x] **Local availability**: Not currently downloaded.

### Domain Shift Analysis against EXP-001/002/003
- **Semantic/Content Shift**: Massive. Our models were trained exclusively on human faces. CIFAKE contains vehicles and animals.
- **Image Resolution Shift**: Extreme. 32x32 upsampled to 224x224 introduces substantial interpolation differences.
- **Generator Shift**: Stable Diffusion v1.4 vs 140k's generators (likely GANs).
- **Frequency Characteristics**: The frequency-domain model (EXP-002) would evaluate heavily altered DCT spectra caused by upsampling 32x32 images, rendering frequency generalization difficult to interpret.

### Recommendation
**CIFAKE is NOT suitable as the primary generalization benchmark.** 
It acts as a difficult-to-interpret cross-domain stress test because semantic/content shift and generator shift are confounded. Evaluating a face-detector on 32x32 pictures of dogs and trucks will yield scientifically ambiguous results regarding the model's actual ability to generalize to new face generators. 

**An additional face-focused external dataset is required before EXP-004 can proceed.** A formal dataset selection study has been conducted to identify a suitable replacement (see `docs/research/EXP-004-dataset-selection.md`).

## 5. Next Actions
- **Halt CIFAKE acquisition.**
- **Identify and audit a high-resolution, face-focused external dataset** (e.g., ArtiFact's Face/Diffusion subset) that isolates generator shift without introducing massive semantic and resolution shifts. (See `EXP-004-dataset-selection.md` for the chosen primary candidate).

*(The rest of the evaluation protocol is suspended until a suitable dataset is identified).*
