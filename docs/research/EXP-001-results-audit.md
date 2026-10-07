# EXP-001 Results Audit

## 1. Experiment Identity
- **Experiment ID:** EXP-001-spatial-baseline
- **Run ID:** run_20261007_141902_9e04eeda
- **Model Checkpoint:** `model_best.pth`
- **Checkpoint SHA-256:** `b05a302c9283783fdc7352abe967baa4e4ab278028a2ba08cf40bd290e521d03`
- **Dataset Manifest SHA-256:** `f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466`
- **Dataset Archive SHA-256:** `ddaec55d781628e9f356543aa05c4946c3e6670b9232998b538579332ce6929f`
- **Evaluation Accuracy:** 0.998952 (99.89%)
- **Evaluation ROC-AUC:** 0.999994

## 2. Dataset and Split Verification
An programmatic audit of the frozen split manifest (`data/splits/140k-split-v1.0.csv`) and dataset pipeline yields the following verified metrics:
- **VERIFIED:** Exact test counts (21,000 samples).
- **VERIFIED:** Exact training counts (98,000 samples) and validation counts (21,000 samples).
- **VERIFIED:** Class distribution is perfectly balanced across all splits (Train: 49k/49k, Val: 10.5k/10.5k, Test: 10.5k/10.5k).
- **VERIFIED:** Evaluator uses ONLY `split="test"` via strictly enforced DataLoader parameters (`evaluate_exp001.py` L85).
- **VERIFIED:** Preprocessing correctly branches (`is_training=True` for train, `is_training=False` for test), guaranteeing no test-time augmentation (TTA).
- **VERIFIED:** Labels are deterministically mapped via a single source of truth `LABEL_MAP` (`fake: 0`, `real: 1`).

## 3. Leakage / Duplicate Audit
To investigate whether the 99.89% result is due to pipeline data leakage:
- **VERIFIED:** Zero duplicate filepaths and zero duplicate SHA-256 hashes were found in the frozen manifest. This verifies that no identical files, as represented by their recorded SHA-256 values, occur across the splits.
- **NOT VERIFIED:** Subject-level or source-level separation. The manifest does not track subject identity or generation seed. If the dataset uses random image-level splitting from the same underlying generation batches or subjects, semantic leakage is highly probable.
- **INFERENCE:** The near-perfect ROC-AUC (0.999994) raises a strong research concern that dataset-specific spatial artifacts or signatures may contribute to the result. This is an inference/hypothesis rather than a demonstrated causal explanation. Possible mechanisms, such as generator-specific or preprocessing/compression-related artifacts, require dedicated follow-up experiments.

## 4. Training and Evaluation Pipeline Audit
The evaluation pipeline is internally consistent with the frozen EXP-001 design and was verified to use the held-out test split correctly.
- **VERIFIED:** Test data is never instantiated during the `DeepVerifyTrainer` training loop.
- **VERIFIED:** Validation data is strictly isolated from test metrics.
- **VERIFIED:** Test metrics strictly consume `model_best.pth`.
- **VERIFIED:** Evaluation is strictly executed under `torch.no_grad()` (`evaluate_exp001.py` L98).
- **VERIFIED:** The model parameters are frozen (`model.eval()`).
- **VERIFIED:** The normalisation transform uses deterministic ImageNet means/stds consistently across train and evaluation.

## 5. Artifact Integrity
- **VERIFIED:** The `model_best.pth` checkpoint has been cryptographically preserved (SHA-256 matches the manifest).
- **VERIFIED:** The `config.yaml` is immutable and matches the preserved metrics.
- **VERIFIED:** The evaluation artifacts (`test_metrics.json`, `confusion_matrix.json`, `evaluation_metadata.json`) correspond flawlessly to the checkpoint hash in the metadata.

## 6. What EXP-001 Establishes
- EXP-001 establishes a functional, mathematically sound, and highly reproducible training and evaluation pipeline.
- It proves that EfficientNet-B0 can perfectly separate the specific "140k Real and Fake Faces" dataset under spatial-domain constraints.
- It establishes a concrete baseline system architecture for all future DeepVerify experiments.

## 7. What EXP-001 Does Not Establish
- **Does NOT establish general AI-image detection.**
- **Does NOT establish cross-generator generalization.** The model is untested against Stable Diffusion, Midjourney, unseen GANs, or unknown diffusion models.
- **Does NOT establish cross-dataset generalization.** The results are tightly coupled to the specific source distributions of the 140k dataset (likely FFHQ/StyleGAN).
- **Does NOT establish robustness** to real-world perturbations like severe compression, resizing, cropping, or social media laundering.

## 8. Reproducibility Assessment
- **VERIFIED:** The experiment is 100% reproducible. The random seed (42), architecture (efficientnet-b0), pretrained weights (IMAGENET1K_V1), optimizer (AdamW), learning rate (1e-4), scheduler (CosineAnnealingLR), batch size (64), augmentation configuration, and dataset snapshot hash are all immutably frozen in `EXP-001.yaml` and the Git commit history.

## 9. Risks / Open Questions
- **Dataset Artifact Bias Risk:** The extremely high accuracy is a hallmark of "Clever Hans" behavior in deepfake detection, where the model learns the dataset's specific compression or generation artifacts (e.g., upsampling checkerboard patterns) rather than intrinsic semantic manipulation.
- **Next Steps:** EXP-002 must address cross-dataset generalization or employ frequency-domain transformations to determine if the spatial baseline fails on out-of-distribution (OOD) data.

## 10. Decision
**APPROVED WITH LIMITATIONS**

The training pipeline, evaluation code, and artifact integrity were verified against the frozen EXP-001 design and available artifacts. The frozen manifest contains no duplicate filepaths or SHA-256 hashes across the splits, but subject-level and source-level separation remain NOT VERIFIED. The audit demonstrates why the high single-dataset score must be interpreted cautiously and motivates follow-up experiments for generalization and robustness. We are clear to proceed to EXP-002.
