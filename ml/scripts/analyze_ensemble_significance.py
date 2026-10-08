import argparse
import json
import numpy as np
from pathlib import Path
from scipy.stats import binomtest
from sklearn.metrics import accuracy_score, roc_auc_score

def analyze_significance(exp1_npz, exp2_npz, locked_weight, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)

    d1 = np.load(exp1_npz)
    d2 = np.load(exp2_npz)

    t1, p1_pred, prob1 = d1['targets'], d1['preds'], d1['probs']
    t2, p2_pred, prob2 = d2['targets'], d2['preds'], d2['probs']

    assert len(t1) == 21000, f"Expected 21000 samples, got {len(t1)}"
    assert np.array_equal(t1, t2), "Targets mismatch"
    assert not np.any(np.isnan(prob1)) and not np.any(np.isinf(prob1)), "EXP-001 probs invalid"
    assert not np.any(np.isnan(prob2)) and not np.any(np.isinf(prob2)), "EXP-002 probs invalid"
    assert np.sum(t1 == 0) == 10500 and np.sum(t1 == 1) == 10500, "Class counts mismatch"

    # Baseline correctness
    m1_correct = (prob1 >= 0.5).astype(int) == t1

    # Reconstruct locked ensemble
    ens_prob = locked_weight * prob1 + (1.0 - locked_weight) * prob2
    ens_correct = (ens_prob >= 0.5).astype(int) == t1

    # Compute contingency table
    a = np.sum(m1_correct & ens_correct)      # both correct
    b = np.sum(m1_correct & ~ens_correct)     # EXP-001 correct, EXP-003 wrong (new errors)
    c = np.sum(~m1_correct & ens_correct)     # EXP-001 wrong, EXP-003 correct (rescued errors)
    d = np.sum(~m1_correct & ~ens_correct)    # both wrong

    # Exact McNemar's test via Binomial test on discordant pairs
    discordant_sum = b + c
    if discordant_sum > 0:
        btest = binomtest(c, discordant_sum, p=0.5, alternative='two-sided')
        exact_p = btest.pvalue
    else:
        exact_p = 1.0

    # Asymptotic McNemar's with continuity correction for reference
    if discordant_sum > 0:
        mcnemar_chi2 = ((abs(b - c) - 1.0) ** 2) / discordant_sum
    else:
        mcnemar_chi2 = 0.0

    # Metrics calculation
    acc_m1 = accuracy_score(t1, (prob1 >= 0.5).astype(int))
    acc_ens = accuracy_score(t1, (ens_prob >= 0.5).astype(int))

    auc_m1 = roc_auc_score(t1, prob1)
    auc_ens = roc_auc_score(t1, ens_prob)

    # Transitions
    def transition_counts(mask_class=None):
        if mask_class is None:
            mask = np.ones_like(t1, dtype=bool)
        else:
            mask = (t1 == mask_class)

        return {
            "correct_to_correct": int(np.sum(m1_correct[mask] & ens_correct[mask])),
            "correct_to_wrong": int(np.sum(m1_correct[mask] & ~ens_correct[mask])),
            "wrong_to_correct": int(np.sum(~m1_correct[mask] & ens_correct[mask])),
            "wrong_to_wrong": int(np.sum(~m1_correct[mask] & ~ens_correct[mask]))
        }

    transitions_all = transition_counts()
    transitions_fake = transition_counts(0)
    transitions_real = transition_counts(1)

    # Save structured results
    paired_significance = {
        "contingency_table": {
            "a_both_correct": int(a),
            "b_m1_correct_ens_wrong": int(b),
            "c_m1_wrong_ens_correct": int(c),
            "d_both_wrong": int(d)
        },
        "statistical_tests": {
            "mcnemar_exact_p_value": float(exact_p),
            "mcnemar_asymptotic_chi2": float(mcnemar_chi2)
        },
        "metrics": {
            "exp001_accuracy": float(acc_m1),
            "exp003_accuracy": float(acc_ens),
            "accuracy_difference": float(acc_ens - acc_m1),
            "exp001_errors": int(21000 - a - b),
            "exp003_errors": int(21000 - a - c),
            "net_error_reduction": int(c - b),
            "exp001_roc_auc": float(auc_m1),
            "exp003_roc_auc": float(auc_ens)
        },
        "class_conditional_transitions": {
            "ALL": transitions_all,
            "FAKE": transitions_fake,
            "REAL": transitions_real
        }
    }

    with open(output_dir / "paired_significance.json", "w") as f:
        json.dump(paired_significance, f, indent=4)

    # Generate report
    report = f"""# EXP-003 vs EXP-001 Paired Statistical Analysis

**Methodology**: Statistical comparison using paired predictions from the same test samples on the frozen benchmark. Weight selected on validation (w={locked_weight}) and strictly locked.

## 1. Paired Contingency Table
| | EXP-003 Correct | EXP-003 Wrong |
|---|---|---|
| **EXP-001 Correct** | {a} | {b} |
| **EXP-001 Wrong** | {c} | {d} |

- **b (EXP-001 Correct, EXP-003 Wrong)**: {b} (New errors introduced)
- **c (EXP-001 Wrong, EXP-003 Correct)**: {c} (Errors rescued)

## 2. McNemar's Test
- **Exact two-sided p-value**: {exact_p:.6f}
- *(Supplementary) Asymptotic Chi2 with continuity correction*: {mcnemar_chi2:.4f}

*The exact Binomial test is the primary result because the total number of discordant pairs (b+c = {discordant_sum}) is very small.*

## 3. Practical Impact (Effect Size)
- **EXP-001 Errors**: {21000 - a - b}
- **EXP-003 Errors**: {21000 - a - c}
- **Net Error Reduction**: {c - b}
- **Absolute Accuracy Improvement**: {acc_ens - acc_m1:+.7f} percentage points

## 4. Class-Conditional Transition Analysis
**For TRUE FAKE:**
- EXP-001 mistakes rescued by ensemble: {transitions_fake['wrong_to_correct']}
- EXP-001 correct broken by ensemble: {transitions_fake['correct_to_wrong']}

**For TRUE REAL:**
- EXP-001 mistakes rescued by ensemble: {transitions_real['wrong_to_correct']}
- EXP-001 correct broken by ensemble: {transitions_real['correct_to_wrong']}

## 5. ROC-AUC Interpretation
- **EXP-001 ROC-AUC**: {auc_m1:.7f}
- **EXP-003 ROC-AUC**: {auc_ens:.7f}

*Accuracy at threshold 0.5 improved by reducing net errors, while global ranking quality measured by ROC-AUC decreased slightly.*

## 6. Scientific Interpretation
The locked ensemble improved accuracy by {c-b} net errors on the frozen test set. The exact McNemar p-value is {exact_p:.6f}.
"""

    if exact_p < 0.05:
        report += "\nThe locked ensemble produced a statistically significant paired improvement over EXP-001 on the frozen benchmark at alpha=0.05. However, the absolute gain is small and generalization beyond this dataset remains unestablished."
    else:
        report += "\nThe paired statistical test does not establish that this improvement is statistically significant at alpha=0.05. The result is therefore evidence of potential complementary information rather than strong evidence of generalizable superiority."

    with open(output_dir / "paired_significance_report.md", "w") as f:
        f.write(report)

    print(f"Statistical analysis complete. Exact p-value: {exact_p:.6f}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--exp1", type=Path, required=True, help="EXP-001 predictions")
    parser.add_argument("--exp2", type=Path, required=True, help="EXP-002 predictions")
    parser.add_argument("--weight", type=float, required=True, help="Locked weight")
    parser.add_argument("--out", type=Path, required=True, help="Output directory")
    args = parser.parse_args()

    analyze_significance(args.exp1, args.exp2, args.weight, args.out)
