# EXP-003 Final Ensemble Evaluation

**Methodology**: Ensemble weight selected on the validation split and evaluated once on the held-out test split.

## Validation Selection
- **Selected Weight**: 0.60
- **Selection Metric**: F1
- **Validation Score**: 0.9990004

## Final Test Evaluation (Locked)
**EXP-001 Spatial Baseline:**
- Accuracy: 0.9989524
- F1: 0.9989529
- ROC-AUC: 0.9999947
- Errors: 22

**EXP-002 Frequency Baseline:**
- Accuracy: 0.8172857
- Errors: 3837

**Locked Ensemble (w=0.60):**
- Accuracy: 0.9992857
- F1: 0.9992860
- ROC-AUC: 0.9998717
- Errors: 15

## Comparison against EXP-001
- **Accuracy Delta**: +0.0003333
- **EXP-001 Errors Rescued**: 8
- **New Errors Introduced**: 1

## Error Rescue Analysis
- **EXP-002 Errors Rescued**: 3831
- **Both-Wrong Samples Rescued**: 0 (out of 5 both-wrong cases)
