import argparse
import json
import numpy as np
from pathlib import Path
from scipy.stats import pearsonr, spearmanr

def analyze_overlap(exp1_npz: Path, exp2_npz: Path, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load data
    d1 = np.load(exp1_npz)
    d2 = np.load(exp2_npz)
    
    t1, p1, prob1 = d1['targets'], d1['preds'], d1['probs']
    t2, p2, prob2 = d2['targets'], d2['preds'], d2['probs']
    
    # Verify alignment
    if len(t1) != len(t2):
        raise ValueError(f"Length mismatch: {len(t1)} vs {len(t2)}")
    if not np.array_equal(t1, t2):
        raise ValueError("Targets do not perfectly match! Sample alignment failed.")
        
    num_samples = len(t1)
    
    # Basic arrays
    c1 = (p1 == t1)
    e1 = ~c1
    c2 = (p2 == t2)
    e2 = ~c2
    
    # A. Agreement Matrix
    c1_c2 = np.sum(c1 & c2)
    c1_e2 = np.sum(c1 & e2)
    e1_c2 = np.sum(e1 & c2)
    e1_e2 = np.sum(e1 & e2)
    
    agreement_matrix = {
        "rows": ["EXP-001 Correct", "EXP-001 Wrong"],
        "cols": ["EXP-002 Correct", "EXP-002 Wrong"],
        "matrix": [
            [int(c1_c2), int(c1_e2)],
            [int(e1_c2), int(e1_e2)]
        ]
    }
    
    # B. Error Overlap
    err1_count = np.sum(e1)
    err2_count = np.sum(e2)
    both_err = np.sum(e1 & e2)
    only1_err = np.sum(e1 & c2)
    only2_err = np.sum(c1 & e2)
    union_err = err1_count + err2_count - both_err
    jaccard = both_err / union_err if union_err > 0 else 1.0
    
    # C. Class Conditional
    is_fake = (t1 == 0)
    is_real = (t1 == 1)
    
    def get_cond_stats(mask):
        return {
            "total": int(np.sum(mask)),
            "exp1_err": int(np.sum(e1 & mask)),
            "exp2_err": int(np.sum(e2 & mask)),
            "shared_err": int(np.sum(e1 & e2 & mask)),
            "exp1_only_err": int(np.sum(e1 & c2 & mask)),
            "exp2_only_err": int(np.sum(c1 & e2 & mask)),
        }
        
    cond_fake = get_cond_stats(is_fake)
    cond_real = get_cond_stats(is_real)
    
    # D. Oracle
    oracle_correct = c1 | c2
    oracle_correct_count = np.sum(oracle_correct)
    oracle_acc = oracle_correct_count / num_samples
    oracle_err_count = num_samples - oracle_correct_count
    
    # Rescues
    rescued_by_2 = int(only1_err)  # 1 is wrong, 2 is correct
    rescued_by_1 = int(only2_err)  # 2 is wrong, 1 is correct
    
    # E. Probability Correlation
    pearson_corr, p_pearson = pearsonr(prob1, prob2)
    spearman_corr, p_spearman = spearmanr(prob1, prob2)
    
    results = {
        "sample_count": int(num_samples),
        "error_overlap": {
            "exp1_errors": int(err1_count),
            "exp2_errors": int(err2_count),
            "shared_errors": int(both_err),
            "exp1_only_errors": int(only1_err),
            "exp2_only_errors": int(only2_err),
            "union_errors": int(union_err),
            "jaccard_similarity": float(jaccard)
        },
        "class_conditional": {
            "FAKE": cond_fake,
            "REAL": cond_real
        },
        "oracle": {
            "oracle_correct": int(oracle_correct_count),
            "oracle_errors": int(oracle_err_count),
            "oracle_accuracy": float(oracle_acc),
            "rescued_by_exp2": rescued_by_2,
            "rescued_by_exp1": rescued_by_1,
            "both_wrong": int(e1_e2)
        },
        "probability_correlation": {
            "pearson": float(pearson_corr),
            "spearman": float(spearman_corr)
        }
    }
    
    with open(output_dir / "error_overlap.json", "w") as f:
        json.dump(results, f, indent=4)
        
    with open(output_dir / "agreement_matrix.json", "w") as f:
        json.dump(agreement_matrix, f, indent=4)
        
    # Write Markdown Report
    report = f"""# EXP-001 vs EXP-002 Error Overlap Analysis

## Overview
- **Samples Evaluated**: {num_samples}
- **Alignment**: Perfect alignment proven by identical targets arrays.

## Oracle Analysis (Upper Bound)
- **Oracle Accuracy**: {oracle_acc:.4f} ({oracle_correct_count}/{num_samples})
- **Oracle Errors**: {oracle_err_count}
- **Rescued by EXP-002**: {rescued_by_2} (EXP-001 wrong, EXP-002 right)
- **Rescued by EXP-001**: {rescued_by_1} (EXP-002 wrong, EXP-001 right)
- **Both Wrong**: {e1_e2}

*Note: This oracle is an upper bound on ensemble performance, not a guaranteed result of averaging.*

## Error Overlap
- **EXP-001 Errors**: {err1_count}
- **EXP-002 Errors**: {err2_count}
- **Shared Errors**: {both_err}
- **Jaccard Similarity**: {jaccard:.4f}

## Probability Correlation
- **Pearson**: {pearson_corr:.4f}
- **Spearman**: {spearman_corr:.4f}
"""
    with open(output_dir / "error_overlap_report.md", "w") as f:
        f.write(report)
        
    print(f"Analysis complete. Results saved to {output_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--exp1", type=Path, required=True, help="EXP-001 sample_predictions.npz")
    parser.add_argument("--exp2", type=Path, required=True, help="EXP-002 sample_predictions.npz")
    parser.add_argument("--out", type=Path, required=True, help="Output directory")
    args = parser.parse_args()
    
    analyze_overlap(args.exp1, args.exp2, args.out)
