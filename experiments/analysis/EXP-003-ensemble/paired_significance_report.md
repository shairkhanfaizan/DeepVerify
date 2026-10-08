# EXP-003 vs EXP-001 Paired Statistical Analysis

**Methodology**: Statistical comparison using paired predictions from the same test samples on the frozen benchmark. Weight selected on validation (w=0.6) and strictly locked.

## 1. Paired Contingency Table
| | EXP-003 Correct | EXP-003 Wrong |
|---|---|---|
| **EXP-001 Correct** | 20977 | 1 |
| **EXP-001 Wrong** | 8 | 14 |

- **b (EXP-001 Correct, EXP-003 Wrong)**: 1 (New errors introduced)
- **c (EXP-001 Wrong, EXP-003 Correct)**: 8 (Errors rescued)

## 2. McNemar's Test
- **Exact two-sided p-value**: 0.039062
- *(Supplementary) Asymptotic Chi2 with continuity correction*: 4.0000

*The exact Binomial test is the primary result because the total number of discordant pairs (b+c = 9) is very small.*

## 3. Practical Impact (Effect Size)
- **EXP-001 Errors**: 22
- **EXP-003 Errors**: 15
- **Net Error Reduction**: 7
- **Absolute Accuracy Improvement**: +0.0003333 percentage points

## 4. Class-Conditional Transition Analysis
**For TRUE FAKE:**
- EXP-001 mistakes rescued by ensemble: 5
- EXP-001 correct broken by ensemble: 1

**For TRUE REAL:**
- EXP-001 mistakes rescued by ensemble: 3
- EXP-001 correct broken by ensemble: 0

## 5. ROC-AUC Interpretation
- **EXP-001 ROC-AUC**: 0.9999947
- **EXP-003 ROC-AUC**: 0.9998717

*Accuracy at threshold 0.5 improved by reducing net errors, while global ranking quality measured by ROC-AUC decreased slightly.*

## 6. Scientific Interpretation
The locked ensemble improved accuracy by 7 net errors on the frozen test set. The exact McNemar p-value is 0.039062.

The locked ensemble produced a statistically significant paired improvement over EXP-001 on the frozen benchmark at alpha=0.05. However, the absolute gain is small and generalization beyond this dataset remains unestablished.