# ADR-008: Ensemble Score Interpretation and UI Transformation

> **Status:** Accepted  
> **Date:** 2026-10-10  
> **Source:** Project Audit

## Context

DeepVerify utilizes a dual-branch machine learning architecture. The `ensemble-v1.0` policy employs a 60% spatial (EfficientNet-B0) and 40% frequency (2D FFT) weight distribution.
The backend pipeline produces an `ensemble_score` (a floating-point value) based on the outputs of these two branches. 

During the development of the reporting UI, a critical divergence was identified between what the ML model represents and what the UI requires:
1. **Backend Representation**: The `ensemble_score` represents an **Authenticity Score**. A value approaching `1.0` signifies high confidence that the image is REAL. A value approaching `0.0` signifies high confidence that it is AI-GENERATED.
2. **UI Requirement**: The investigator dashboard, forensics workbench, and PDF reports display an **AI Chance** or **AI Probability**. Users expect higher numbers to map directly to higher threat levels (i.e., a higher chance of AI manipulation).

Furthermore, the raw logits and subsequent `ensemble_score` output by the models are **not calibrated probabilities**. They are indicative scores useful for binary thresholding but do not represent a strict Bayesian probability of manipulation.

## Decision

1. **Backend Consistency**: The backend will continue to emit the `ensemble_score` as an *Authenticity Score*. The `decision_threshold` (e.g., `< 0.5`) will continue to yield `LIKELY_AI_GENERATED`.
2. **UI Transformation**: The frontend application (React UI and CSV exports) will dynamically invert the authenticity score into an AI Chance percentage using the exact formula:
   ```javascript
   const aiChance = Math.round((1 - ensemble_score) * 100);
   ```
3. **Missing Branch Handling**: If a branch fails to yield an output, its signal defaults gracefully, or the ensemble degrades to the remaining branch based on the policy definition.
4. **Verbal Disclaimer**: The UI and reports must not refer to these metrics as "absolute proof". The language is standardized to "AI Probability Score" or "Indicative Analysis Score", avoiding claims of strict statistical calibration.

## Consequences

### Positive
- Prevents cognitive dissonance for investigators; high numbers logically correlate with high suspicion.
- Maintains backend mathematical consistency with standard discriminator training paradigms (where Class 1 = Real, Class 0 = Fake).

### Negative / Trade-offs
- Developers must constantly remember the inversion boundary between the API contract and the React presentation layer.
- Lack of true temperature scaling or Platt scaling means the "Percentage" is mathematically naive, acting more as a confidence index than a true probability.
