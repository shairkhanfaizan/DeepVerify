# EXP-003 — Validation-Selected Spatial/Frequency Ensemble

## 1. Research Question
Can combining the existing EXP-001 spatial predictions with EXP-002 frequency predictions improve upon the EXP-001 spatial baseline on the exact frozen 21,000-image test set?

## 2. Motivation from EXP-001 and EXP-002
EXP-001 produced a highly accurate spatial baseline (99.895% test accuracy) with only 22 errors. EXP-002 evaluated an identical architecture on DCT-based frequency features and, while achieving lower global performance (81.729% test accuracy), demonstrated complementary prediction errors—rescuing a large proportion of EXP-001's failures. This motivated aggregating the two sets of probabilities to see if the complementary signal could be realized practically.

## 3. Input Models
- **EXP-001 (Spatial Baseline)**
  - Run ID: `run_20261007_141902_9e04eeda`
  - Checkpoint SHA-256: `b05a302c9283783fdc7352abe967baa4e4ab278028a2ba08cf40bd290e521d03`
- **EXP-002 (Frequency Baseline)**
  - Run ID: `run_20261008_080128_559d2631`
  - Checkpoint SHA-256: `507f9d6cf9aadc633d336f236df140555f4847fdc29697a8fc576a3fe3aa4c52`

## 4. Prediction Compatibility
Both models generate identical logits shapes mapping class 0 to FAKE and class 1 to REAL. Probabilities represent `P(REAL)`. Output dimensions on both the validation and test sets precisely match 21,000 samples aligned with `140k-split-v1.0.csv`.

## 5. Ensemble Formulation
The ensemble was formulated as a simple fixed-weight linear combination of probabilities:
`Ensemble P(REAL) = w * EXP-001 P(REAL) + (1-w) * EXP-002 P(REAL)`

## 6. Validation-based Weight Selection
To avoid test-set overfitting, prediction artifacts for the validation split were generated independently on the CPU. A sweep across weights `w ∈ [0.0, 1.0]` was performed using the 21,000 validation images.
- **Validation-selected weight**: `w = 0.60` (60% EXP-001 + 40% EXP-002)
- **Validation Selection Metric**: F1 Score (0.9990004)

## 7. Locked Test Evaluation
The ensemble weight of 0.60 was subsequently rigidly locked and evaluated exactly once on the frozen 21,000-image test set. No further optimization was performed.

## 8. Results

| Metric | EXP-001 | EXP-002 | EXP-003 (Locked) |
|---|---|---|---|
| Accuracy | 99.8952% | 81.7286% | 99.9286% |
| F1 Score | 99.8952% | 82.1709% | 99.9286% |
| ROC-AUC | 99.9995% | 90.1424% | 99.9872% |
| Errors | 22 | 3837 | 15 |

## 9. Paired Error Analysis
The locked ensemble correctly predicted 8 of the 22 samples that EXP-001 misclassified, while introducing only 1 new error, leading to a net improvement of 7 errors.
- **EXP-001 Correct, EXP-003 Wrong (New errors)**: 1
- **EXP-001 Wrong, EXP-003 Correct (Rescued errors)**: 8
- **Both Wrong**: Both current models misclassified these 5 samples under the evaluated architectures, preprocessing, and decision rule.

## 10. McNemar Test
- **Exact two-sided p-value**: 0.039062
The exact Binomial test was used given the low number of discordant pairs (9 total). The paired McNemar test provides evidence of a difference in paired classification outcomes on this benchmark at alpha=0.05.

## 11. ROC-AUC Behavior
The ensemble improved hard classification metrics (Accuracy and F1 at decision threshold 0.5) by successfully rescuing threshold-straddling errors. However, ROC-AUC decreased slightly relative to EXP-001 (0.999995 vs 0.999872), indicating that simple linear aggregation suboptimally scales overall confidence boundaries and ranking.

## 12. Limitations
Because the spatial baseline is incredibly strong, a net correction of 7 errors represents a very small absolute percentage point improvement (+0.033%). Generalization beyond the evaluated dataset remains unestablished.

## 13. Scientific Conclusion
The frequency-based classifier exhibits complementary prediction errors under the evaluated setup. The validation-selected ensemble improved classification accuracy on the frozen benchmark, providing evidence that complementary frequency-domain information exists.

## 14. Decision / Next Research Direction
While simple probability aggregation successfully corrects errors, its negative impact on ROC-AUC suggests that a rigid linear average is suboptimal. A learned non-linear ensemble (e.g., neural feature concatenation or stacking) is highly justified as the next research milestone to fully harness spatial and frequency complementarity.
