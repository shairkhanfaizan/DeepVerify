import pytest
import numpy as np
import json
import subprocess
from pathlib import Path

def test_script_execution(tmp_path):
    val_exp1 = tmp_path / "val1.npz"
    val_exp2 = tmp_path / "val2.npz"
    test_exp1 = tmp_path / "test1.npz"
    test_exp2 = tmp_path / "test2.npz"
    out_dir = tmp_path / "analysis"

    # 21000 samples test array
    targets = np.zeros(21000, dtype=int)
    targets[10500:] = 1

    preds1 = targets.copy()
    probs1 = targets.astype(float) * 0.9 + 0.05  # 0.05 and 0.95

    preds2 = targets.copy()
    preds2[0] = 1 # make an error
    probs2 = targets.astype(float) * 0.8 + 0.1
    probs2[0] = 0.9 # confidently wrong

    np.savez(val_exp1, targets=targets, preds=preds1, probs=probs1)
    np.savez(val_exp2, targets=targets, preds=preds2, probs=probs2)
    np.savez(test_exp1, targets=targets, preds=preds1, probs=probs1)
    np.savez(test_exp2, targets=targets, preds=preds2, probs=probs2)

    script_path = Path(__file__).parent.parent / "scripts" / "evaluate_ensemble_exp003.py"

    # Run validation
    subprocess.run(["python3", str(script_path), "--exp1", str(val_exp1), "--exp2", str(val_exp2), "--out", str(out_dir), "--validation"], check=True)

    assert (out_dir / "selected_ensemble_config.json").exists()
    assert (out_dir / "validation_weight_sweep.json").exists()

    # Run final test
    subprocess.run(["python3", str(script_path), "--exp1", str(test_exp1), "--exp2", str(test_exp2), "--out", str(out_dir), "--final-test"], check=True)

    assert (out_dir / "final_test_metrics.json").exists()
    assert (out_dir / "ensemble_report.md").exists()
