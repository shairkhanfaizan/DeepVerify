import pytest
import numpy as np
import json
import subprocess
from pathlib import Path

def test_significance_execution(tmp_path):
    exp1_file = tmp_path / "exp1.npz"
    exp2_file = tmp_path / "exp2.npz"
    out_dir = tmp_path / "analysis"

    # Generate 21000 samples
    targets = np.zeros(21000, dtype=int)
    targets[10500:] = 1

    # EXP-1: 1 wrong
    probs1 = targets.astype(float) * 0.9 + 0.05
    probs1[0] = 0.9  # target 0, prob 0.9 -> wrong
    preds1 = (probs1 >= 0.5).astype(int)

    # EXP-2: 0 wrong, perfect model
    probs2 = targets.astype(float) * 0.9 + 0.05
    preds2 = (probs2 >= 0.5).astype(int)

    np.savez(exp1_file, targets=targets, preds=preds1, probs=probs1)
    np.savez(exp2_file, targets=targets, preds=preds2, probs=probs2)

    script_path = Path(__file__).parent.parent / "scripts" / "analyze_ensemble_significance.py"

    # W=0.5 -> ensemble prob at index 0 = 0.5*0.9 + 0.5*0.05 = 0.475 -> correct
    subprocess.run(["python3", str(script_path), "--exp1", str(exp1_file), "--exp2", str(exp2_file), "--weight", "0.5", "--out", str(out_dir)], check=True)

    assert (out_dir / "paired_significance.json").exists()
    assert (out_dir / "paired_significance_report.md").exists()

    with open(out_dir / "paired_significance.json") as f:
        data = json.load(f)

    assert data["metrics"]["net_error_reduction"] == 1
    assert data["contingency_table"]["c_m1_wrong_ens_correct"] == 1
    assert data["contingency_table"]["b_m1_correct_ens_wrong"] == 0
