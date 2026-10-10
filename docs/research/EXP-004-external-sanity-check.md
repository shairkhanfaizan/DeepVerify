# EXP-004 — External Sanity Check (FaceForensics++)

## 1. Objective
Perform a **minimal external sanity check** to determine whether the already-trained DeepVerify spatial-frequency ensemble (EXP-003) behaves reasonably on a small, independently sourced human-face manipulation dataset outside the 140k training benchmark.

**Crucial Framing**: This sanity check evaluates *manipulation robustness* (detecting face swaps and manipulations on real videos), not clean unseen-generator generalization (which was the goal of evaluating datasets like ArtiFact). The purpose is strictly to prevent research scope creep by providing one practical external datapoint before freezing ML experimentation for V1.

## 2. Dataset & Scope
**Dataset**: FaceForensics++ (FF++)
**Condition**: The user has received the FF++ download script via email. However, the repository currently *lacks* the download script, configuration files, and credentials required for immediate programmatic execution.

### Minimal Subset Strategy
To avoid excessive storage costs and complex infrastructure requirements, we will **not** download or process the entire FF++ corpus. 
- **Subset Size**: Extract a very small subset (e.g., 50 pristine videos, 50 DeepFake videos, 50 FaceSwap videos).
- **Correlation Control**: Extract exactly **1 frame per video** (e.g., the center frame where a face is successfully detected). This avoids treating thousands of correlated frames from the same source as independent samples.
- **Manipulation Categories Evaluated**: 
  - Pristine (Original videos - REAL)
  - DeepFakes (FAKE)
  - FaceSwap (FAKE)
- **Quality/Compression**: Use the 'c23' (light compression) or 'raw' videos to ensure high-frequency artifacts are intact.

## 3. Evaluation Protocol
This is a strict **zero-training** evaluation.
1. Use the already frozen EXP-001 (Spatial), EXP-002 (Frequency), and EXP-003 (Ensemble, w=0.60) configurations and checkpoints.
2. Do not train, fine-tune, or retune ensemble weights and classification thresholds. Threshold remains exactly 0.5.
3. Preprocessing must match the 140k benchmark: isolate the face crop and resize to `224x224`.

## 4. Recorded Artifacts & Metrics
The following must be recorded in the resulting JSON artifact:
- **Dataset / Version**: FaceForensics++ (Subset)
- **Manipulation Category**: Pristine vs DeepFakes/FaceSwap
- **Number of Source Videos**: (e.g., 150)
- **Number of Evaluated Frames**: (e.g., 150 independent frames)
- **Preprocessing Used**: Face detection + center crop + resize (224x224)
- **Model Checkpoint Hashes**: EXP-001 and EXP-002
- **Ensemble Weight**: 0.60
- **Threshold**: 0.5
- **Git Commit SHA**: Target evaluator version

### Metrics
- Accuracy
- Precision
- Recall
- F1 Score
- ROC-AUC
- Confusion Matrix

## 5. Stop Condition (Gate)
**If constructing this statistically reasonable FF++ evaluation subset becomes complicated, expensive, requires excessive storage, or demands significant new infrastructure (e.g., writing robust new facial extraction pipelines just to evaluate 150 frames), we will STOP.** 

In the event of triggering this Stop Condition, the recommendation is to abandon the external sanity check and immediately move directly to Grad-CAM explainability and V1 productization (backend/frontend). 

The entire purpose of this step is to prevent research scope creep; investing heavy engineering cycles to evaluate a small out-of-domain subset violates the V1 constraints.
