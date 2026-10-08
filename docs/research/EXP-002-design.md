# EXP-002 Frequency-Domain Baseline

## 1. Experiment Identity
- **Experiment ID:** EXP-002-frequency-baseline

## 2. Research Question
**Primary Question:**
"Can a frequency-domain representation of the same frozen 140k Real and Fake Faces benchmark provide a measurable real-vs-AI classification signal independent of the EXP-001 spatial representation?"

**H1:** The log-magnitude FFT representation contains discriminative information for the real-vs-AI classification task.

A strong EXP-002 score alone would not demonstrate that the model learned generator-independent frequency characteristics. The model could still exploit dataset-specific spectral signatures.

**Dataset-Artifact Question:**
"Does the frequency-domain model provide useful discriminative information beyond dataset-specific spectral artifacts?"
(Note: EXP-002 cannot fully answer this question alone; cross-dataset/OOD experiments remain necessary.)

**Secondary Questions:**
1. Which frequency representation should be used to best expose synthetic generation artifacts?
2. Does the frequency representation retain enough information for reliable classification on its own?
3. Does the frequency model make different errors from the spatial model (EXP-001)?
4. Could the frequency model therefore provide complementary information for a future ensemble system?

## 3. Motivation
EXP-001 demonstrated that a spatial-domain model (EfficientNet-B0) can perfectly separate the 140k test split. However, AI-image generation methods (e.g., GAN upsampling, diffusion artifacts) often leave distinct high-frequency signatures or anomalous spectral distributions. By explicitly stripping spatial structures and forcing the model to learn in the frequency domain, we aim to evaluate whether frequency representations offer a robust, complementary signal that might generalize differently or highlight distinct artifacts.

## 4. Candidate Frequency Representations
We evaluated several candidates to represent images in the frequency domain:

**A. 2D FFT Magnitude Spectrum:**
- *Information retained:* Global frequency distribution, periodic artifacts.
- *Information discarded:* Phase (spatial location/structure).
- *Pros:* Direct measurement of frequency content.
- *Cons:* Extremely high dynamic range; low frequencies dominate the signal, making high-frequency artifacts numerically insignificant to a neural network.

**B. Log-magnitude FFT Spectrum:**
- *Information retained:* Logarithmically scaled global frequency distribution.
- *Information discarded:* Phase.
- *Pros:* Compresses dynamic range; exposes high-frequency checkerboard artifacts clearly; easily normalized into a [0, 1] pseudo-image.
- *Cons:* Destroys spatial correlation.

**C. DCT (Discrete Cosine Transform) Representation:**
- *Information retained:* Frequency coefficients representing spatial variation at different scales; depending on implementation, DCT can be applied globally or in blocks.
- *Information discarded:* Continuous global frequency structure.
- *Pros:* Strongly aligns with JPEG compression signatures.
- *Cons:* DCT remains a viable alternative, including global 2D DCT, but is not selected for EXP-002 because the log-magnitude FFT provides a more direct and interpretable full-spectrum representation for this baseline.

**D. High-frequency Filtered Representation:**
- *Information retained:* Spatial edges and high-frequency noise.
- *Information discarded:* Low-frequency structural content.
- *Pros:* Keeps phase/spatial layout; works easily with CNNs.
- *Cons:* High-frequency filtering is deferred because it introduces an additional frequency-selection hyperparameter and tests a narrower hypothesis than the full-spectrum log-magnitude FFT baseline.

**E. Frequency statistics/features followed by a classical classifier:**
- *Information retained:* Aggregated 1D power spectrum (Azimuthal average).
- *Information discarded:* Directional frequency artifacts.
- *Pros:* Extremely lightweight, fast.
- *Cons:* Loses 2D structural frequency correlations; limited capacity compared to CNNs.

## 5. Candidate Model Architectures

**1. CNN operating directly on a frequency image/representation:**
A custom CNN built to consume 2D FFT outputs.

**2. EfficientNet-B0 adapted to a frequency representation:**
Reusing the exact architecture from EXP-001 (EfficientNet-B0), but feeding it 3-channel pseudo-images created from the frequency transform.

**3. Small dedicated CNN frequency classifier:**
A shallow 3-to-4 layer CNN, acknowledging that frequency pseudo-images lack hierarchical spatial textures that require deep networks.

**4. Classical ML classifier over engineered frequency statistics:**
An SVM or Random Forest acting on 1D power spectra.

## 6. Recommended Representation
**Proposed Representation:** Log-magnitude FFT Spectrum (Shifted).
*Rationale:* By computing the 2D FFT per RGB channel, shifting the zero-frequency (DC) component to the center (`fftshift`), and applying a log transform, we compress the dynamic range. This creates a 3-channel pseudo-image of shape `[3, 224, 224]` (assuming 224x224 spatial input). This format perfectly bridges the gap between raw frequency data and standard vision architectures, ensuring compatibility with the existing pipeline while explicitly forcing the model to learn spectral features rather than spatial features.

## 7. Recommended Model Architecture
**Proposed Architecture:** EfficientNet-B0 (initialized with ImageNet weights, fully fine-tuned).
*Rationale:* To ensure a scientifically fair comparison with EXP-001, we must control for model capacity. Using the same EfficientNet-B0 architecture and initialization strategy controls model architecture and nominal initialization, allowing the primary experimental difference to be the input representation. However, transfer from ImageNet pretraining to the frequency representation remains an experimentally relevant factor.

## 8. Preprocessing Pipeline
The exact proposed representation explicitly processes RGB channels independently and phase is discarded. It relocates the zero-frequency/DC component to the center of the spectrum, producing a consistent and interpretable frequency-image layout.

**Validation/Test Pipeline (Deterministic):**
1. Original RGB image
2. → resize to 224×224
3. → per-channel FFT
4. → magnitude
5. → log(1 + magnitude)
6. → fftshift
7. → normalization
8. → 3 × 224 × 224 frequency tensor
9. → model

## 9. Augmentation Strategy
**Training Pipeline:**
1. Original RGB image
2. → resize to 224×224
3. → spatial augmentation
4. → per-channel FFT
5. → magnitude
6. → log(1 + magnitude)
7. → fftshift
8. → normalization
9. → model

Frequency-space augmentation is NOT used in EXP-002 unless explicitly justified by a later experiment. Spatial augmentation is applied before the frequency transform so that EXP-002 receives transformed examples generated from the same image-domain augmentation policy as EXP-001. The resulting frequency representation therefore reflects the effect of those perturbations rather than introducing a separate frequency-space augmentation policy.

## 10. Dataset and Split Strategy
- **Same frozen dataset:** 140k Real and Fake Faces.
- **Same split manifest:** `data/splits/140k-split-v1.0.csv`.
- **Same boundaries:** Train, validation, and test splits remain identical.
- **Same labels:** Fake (0) / Real (1).

## 11. Leakage and Bias Risks
- **Resizing Artifacts:** Bilinear/Bicubic resizing inherently alters the high-frequency spectrum. Since we resize before FFT, the model might learn resizing artifacts rather than generation artifacts.
- **JPEG Compression:** Frequency models are highly sensitive to DCT quantization matrices. If real images and fake images have different JPEG compression histories, the FFT will trivially separate them based on compression rather than semantic authenticity.
- **Normalization Leakage:** Min-max scaling of the FFT magnitude per-image could inadvertently leak absolute energy levels. Global normalization constants must be computed solely on the training set or fixed arbitrarily.

## 12. Training Configuration
The proposed `experiments/configs/EXP-002.yaml` will structurally mirror EXP-001:
- `experiment.id`: "EXP-002-frequency-baseline"
- `dataset`: Identical manifest and SHA-256 constraints.
- `preprocessing`: Includes the explicit routing flag `domain: frequency`.
- `model.architecture`: "efficientnet-b0"
- `training`: Same optimizer (AdamW), LR (1e-4), Scheduler (CosineAnnealingLR), Batch Size (64), Epochs (10).

## 13. Evaluation Protocol
**Mandatory Outputs:**
- Accuracy
- Precision
- Recall
- F1
- ROC-AUC
- Confusion Matrix

**Optional/Recommended Additional Outputs:**
- Frequency Visualization (saving a few samples of the log-magnitude FFT pseudo-images to verify the transform pipeline).

## 14. Comparison Against EXP-001
Once evaluated, EXP-002 will be compared against EXP-001 using:
- **Identical test split** ensuring a 1:1 sample pairing.
- **Complementary-Error Analysis:** We will compute a sample-wise intersection of predictions to identify:
  - EXP-001 correct / EXP-002 wrong
  - EXP-001 wrong / EXP-002 correct
  - Both correct / Both wrong
This analysis is the critical prerequisite for justifying a future multi-modal ensemble.

## 15. Expected Artifacts
Local artifacts will be written to `experiments/runs/EXP-002/<run_id>/`:
- `model_best.pth`, `model_final.pth`
- `config.yaml` snapshot
- `metrics.json` (training history)
- `run_metadata.json`
- `training.log`

## 16. Success Criteria

- The frequency preprocessing pipeline produces deterministic, valid `[3, 224, 224]` tensors.
- The model trains stably without numerical failure.
- Held-out test metrics are successfully produced using the frozen EXP-002 protocol.
- Accuracy, Precision, Recall, F1, ROC-AUC, and Confusion Matrix are reported.
- Performance is interpreted relative to the EXP-001 spatial baseline rather than against an arbitrary standalone threshold.
- Sample-level predictions are retained so complementary-error analysis with EXP-001 can be performed.

A strong test score will be treated as evidence of discriminative signal on this benchmark, not as evidence of general frequency-domain AI-image detection.

## 17. Failure Criteria
- The model fails to converge, or test ROC-AUC remains near 0.50, indicating the log-magnitude FFT representation destroys necessary discriminative features for this specific model capacity.

## 18. Open Questions
- Will ImageNet pretraining help or hurt? ImageNet weights are optimized for spatial textures, not symmetrical frequency magnitude pseudo-images. We hypothesize it may require a longer warmup or fail to transfer effectively compared to spatial inputs, but this remains experimentally unknown.
- Do phase components (which we discard) contain necessary artifact localization data?

## 19. Implementation Plan
1. Implement `deepverify_ml.preprocessing.frequency` to compute the deterministic FFT pseudo-images.
2. Write tests ensuring the transform is stable and outputs correct tensor shapes.
3. Create `experiments/configs/EXP-002.yaml` defining the `preprocessing.domain: frequency`.
4. Train the model using the dedicated runner script via:
   `python ml/scripts/run_exp002_training.py --config experiments/configs/EXP-002.yaml`
5. Evaluate using the standard evaluator.

## 20. Final Recommendation
- **Selected Frequency Representation:** Log-magnitude FFT Spectrum (Shifted). Selected because it compresses dynamic range and outputs a 3-channel pseudo-image compatible with CNNs, explicitly discarding spatial phase.
- **Selected Model Architecture:** EfficientNet-B0. Using the same EfficientNet-B0 architecture and initialization strategy controls model architecture and nominal initialization, allowing the primary experimental difference to be the input representation. However, transfer from ImageNet pretraining to the frequency representation remains an experimentally relevant factor.
- **Rejected Alternatives:** 1D power spectra were rejected due to severe information loss. Custom shallow CNNs were rejected because they confound model capacity with input representation. DCT remains a viable alternative, including global 2D DCT, but is not selected for EXP-002 because the log-magnitude FFT provides a more direct and interpretable full-spectrum representation for this baseline. High-frequency filtering is deferred because it introduces an additional frequency-selection hyperparameter and tests a narrower hypothesis than the full-spectrum log-magnitude FFT baseline.
- **Experimental Status:** Whether this pipeline will successfully learn to classify the 140k dataset remains entirely experimentally unknown and is the target of the upcoming EXP-002 execution.
