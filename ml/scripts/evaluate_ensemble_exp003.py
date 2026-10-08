import argparse
import json
import numpy as np
from pathlib import Path
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

def evaluate_metrics(targets, probs, threshold=0.5):
    preds = (probs >= threshold).astype(int)
    acc = accuracy_score(targets, preds)
    prec = precision_score(targets, preds, zero_division=0)
    rec = recall_score(targets, preds, zero_division=0)
    f1 = f1_score(targets, preds, zero_division=0)
    try:
        auc = roc_auc_score(targets, probs)
    except ValueError:
        auc = 0.0
    cm = confusion_matrix(targets, preds, labels=[0, 1]).tolist()
    return {
        "Accuracy": float(acc),
        "Precision": float(prec),
        "Recall": float(rec),
        "F1": float(f1),
        "ROC-AUC": float(auc),
        "CM": cm
    }

def load_and_audit(exp1_npz, exp2_npz, expected_count=None):
    d1 = np.load(exp1_npz)
    d2 = np.load(exp2_npz)

    t1, p1, prob1 = d1['targets'], d1['preds'], d1['probs']
    t2, p2, prob2 = d2['targets'], d2['preds'], d2['probs']

    if expected_count is not None:
        assert len(t1) == expected_count, f"Expected {expected_count} samples, got {len(t1)}"
    assert np.array_equal(t1, t2), "Targets arrays do not match between EXP-001 and EXP-002"
    assert not np.any(np.isnan(prob1)) and not np.any(np.isinf(prob1)), "EXP-001 probs have NaN/Inf"
    assert not np.any(np.isnan(prob2)) and not np.any(np.isinf(prob2)), "EXP-002 probs have NaN/Inf"

    return t1, prob1, prob2, p1, p2

def run_validation_sweep(exp1_npz, exp2_npz, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    t1, prob1, prob2, _, _ = load_and_audit(exp1_npz, exp2_npz)

    weights = [0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.95, 1.00]
    sweep_results = []

    best_acc = {"val": -1, "w": None, "metrics": None}
    best_f1 = {"val": -1, "w": None, "metrics": None}
    best_auc = {"val": -1, "w": None, "metrics": None}

    for w in weights:
        ens_prob = w * prob1 + (1.0 - w) * prob2
        m = evaluate_metrics(t1, ens_prob)
        sweep_results.append({"weight_exp1": w, "metrics": m})

        if m["Accuracy"] > best_acc["val"]:
            best_acc = {"val": m["Accuracy"], "w": w, "metrics": m}
        # Explicit > for deterministic tie-breaking (first best wins, but we could use >= if we prefer latter)
        # Using > implies we favor smaller w if tie (since weights is sorted asc)
        if m["F1"] > best_f1["val"]:
            best_f1 = {"val": m["F1"], "w": w, "metrics": m}
        if m["ROC-AUC"] > best_auc["val"]:
            best_auc = {"val": m["ROC-AUC"], "w": w, "metrics": m}

    with open(output_dir / "validation_weight_sweep.json", "w") as f:
        json.dump(sweep_results, f, indent=4)

    # Primary selection metric is F1
    selected_weight = best_f1["w"]

    config = {
        "selected_weight": float(selected_weight),
        "selection_metric": "F1",
        "validation_score": float(best_f1["val"]),
        "rationale": "Selected strictly on validation set F1 performance",
        "best_accuracy_weight": float(best_acc["w"]),
        "best_roc_auc_weight": float(best_auc["w"])
    }

    with open(output_dir / "selected_ensemble_config.json", "w") as f:
        json.dump(config, f, indent=4)

    print(f"Validation sweep complete. Locked weight: {selected_weight} (F1: {best_f1['val']:.5f})")

def run_final_test(exp1_npz, exp2_npz, output_dir):
    config_path = output_dir / "selected_ensemble_config.json"
    if not config_path.exists():
        raise FileNotFoundError(f"Must run --validation mode first to generate {config_path}")

    with open(config_path, "r") as f:
        config = json.load(f)

    locked_w = config["selected_weight"]

    t1, prob1, prob2, p1, p2 = load_and_audit(exp1_npz, exp2_npz, expected_count=21000)

    # Baselines
    m1 = evaluate_metrics(t1, prob1)
    m2 = evaluate_metrics(targets=t1, probs=prob2)
    err1_mask = (p1 != t1)
    err2_mask = (p2 != t1)
    both_err_mask = err1_mask & err2_mask

    # Final Ensemble
    ens_prob = locked_w * prob1 + (1.0 - locked_w) * prob2
    ens_metrics = evaluate_metrics(t1, ens_prob)
    ens_pred = (ens_prob >= 0.5).astype(int)
    ens_err_mask = (ens_pred != t1)

    exp1_rescued = np.sum(err1_mask & ~ens_err_mask)
    exp2_rescued = np.sum(err2_mask & ~ens_err_mask)
    new_errors = np.sum(~err1_mask & ens_err_mask)
    both_rescued = np.sum(both_err_mask & ~ens_err_mask)

    final_test_metrics = {
        "baselines": {
            "EXP-001": m1,
            "EXP-002": m2
        },
        "locked_ensemble": {
            "weight": locked_w,
            "metrics": ens_metrics
        },
        "comparison_vs_exp001": {
            "accuracy_delta": ens_metrics["Accuracy"] - m1["Accuracy"],
            "f1_delta": ens_metrics["F1"] - m1["F1"],
            "roc_auc_delta": ens_metrics["ROC-AUC"] - m1["ROC-AUC"],
            "exp1_errors_rescued": int(exp1_rescued),
            "new_errors_introduced": int(new_errors),
            "net_errors": int(np.sum(ens_err_mask))
        },
        "rescue_analysis": {
            "exp1_rescued": int(exp1_rescued),
            "exp2_rescued": int(exp2_rescued),
            "both_wrong_rescued": int(both_rescued)
        }
    }

    with open(output_dir / "final_test_metrics.json", "w") as f:
        json.dump(final_test_metrics, f, indent=4)

    report = f"""# EXP-003 Final Ensemble Evaluation

**Methodology**: Ensemble weight selected on the validation split and evaluated once on the held-out test split.

## Validation Selection
- **Selected Weight**: {locked_w:.2f}
- **Selection Metric**: {config['selection_metric']}
- **Validation Score**: {config['validation_score']:.7f}

## Final Test Evaluation (Locked)
**EXP-001 Spatial Baseline:**
- Accuracy: {m1['Accuracy']:.7f}
- F1: {m1['F1']:.7f}
- ROC-AUC: {m1['ROC-AUC']:.7f}
- Errors: {np.sum(err1_mask)}

**EXP-002 Frequency Baseline:**
- Accuracy: {m2['Accuracy']:.7f}
- Errors: {np.sum(err2_mask)}

**Locked Ensemble (w={locked_w:.2f}):**
- Accuracy: {ens_metrics['Accuracy']:.7f}
- F1: {ens_metrics['F1']:.7f}
- ROC-AUC: {ens_metrics['ROC-AUC']:.7f}
- Errors: {np.sum(ens_err_mask)}

## Comparison against EXP-001
- **Accuracy Delta**: {ens_metrics['Accuracy'] - m1['Accuracy']:+.7f}
- **EXP-001 Errors Rescued**: {exp1_rescued}
- **New Errors Introduced**: {new_errors}

## Error Rescue Analysis
- **EXP-002 Errors Rescued**: {exp2_rescued}
- **Both-Wrong Samples Rescued**: {both_rescued} (out of {np.sum(both_err_mask)} both-wrong cases)
"""
    with open(output_dir / "ensemble_report.md", "w") as f:
        f.write(report)

    print(f"Final test evaluation complete. Saved to {output_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate EXP-003 Validation or Final Test Ensembles")
    parser.add_argument("--exp1", type=Path, required=True, help="EXP-001 predictions")
    parser.add_argument("--exp2", type=Path, required=True, help="EXP-002 predictions")
    parser.add_argument("--out", type=Path, required=True, help="Output directory")

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--validation", action="store_true", help="Run validation sweep and lock weight")
    group.add_argument("--final-test", action="store_true", help="Run final test evaluation using locked weight")

    args = parser.parse_args()

    if args.validation:
        run_validation_sweep(args.exp1, args.exp2, args.out)
    else:
        run_final_test(args.exp1, args.exp2, args.out)
