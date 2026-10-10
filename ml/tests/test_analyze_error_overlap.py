import pytest
import numpy as np
import json
from pathlib import Path

def test_analyze_overlap(tmp_path):
    exp1_file = tmp_path / "exp1.npz"
    exp2_file = tmp_path / "exp2.npz"
    out_dir = tmp_path / "analysis"
    
    # 5 samples:
    # T = [0, 1, 0, 1, 0]
    # P1 = [0, 1, 1, 1, 0] -> errors at index 2
    # P2 = [0, 0, 0, 0, 1] -> errors at index 1, 3, 4
    
    targets = np.array([0, 1, 0, 1, 0])
    preds1 = np.array([0, 1, 1, 1, 0])
    probs1 = np.array([0.1, 0.9, 0.8, 0.9, 0.2])
    
    preds2 = np.array([0, 0, 0, 0, 1])
    probs2 = np.array([0.2, 0.1, 0.4, 0.2, 0.8])
    
    np.savez(exp1_file, targets=targets, preds=preds1, probs=probs1)
    np.savez(exp2_file, targets=targets, preds=preds2, probs=probs2)
    
    # Needs to be callable
    # We will modify the import path or call it via script for testing.
    # Actually, we can just patch or import the file properly if it was in a package,
    # but since it's a script we can load it with importlib, or just copy the function.
    pass

# We will test this via a subprocess call since it's a script
import subprocess

def test_script_execution(tmp_path):
    exp1_file = tmp_path / "exp1.npz"
    exp2_file = tmp_path / "exp2.npz"
    out_dir = tmp_path / "analysis"
    
    targets = np.array([0, 1, 0, 1, 0])
    preds1 = np.array([0, 1, 1, 1, 0])
    probs1 = np.array([0.1, 0.9, 0.8, 0.9, 0.2])
    
    preds2 = np.array([0, 0, 0, 0, 1])
    probs2 = np.array([0.2, 0.1, 0.4, 0.2, 0.8])
    
    np.savez(exp1_file, targets=targets, preds=preds1, probs=probs1)
    np.savez(exp2_file, targets=targets, preds=preds2, probs=probs2)
    
    script_path = Path(__file__).parent.parent / "scripts" / "analyze_error_overlap.py"
    
    subprocess.run(["python3", str(script_path), "--exp1", str(exp1_file), "--exp2", str(exp2_file), "--out", str(out_dir)], check=True)
    
    assert (out_dir / "error_overlap.json").exists()
    assert (out_dir / "agreement_matrix.json").exists()
    
    with open(out_dir / "error_overlap.json") as f:
        data = json.load(f)
        
    assert data["sample_count"] == 5
    # e1: 1 (idx 2)
    # e2: 3 (idx 1, 3, 4)
    # shared: 0
    # union: 4
    # oracle_correct: 4 (idx 0, 1, 3, 4 for exp1; idx 0, 2 for exp2 -> wait, oracle correct if EITHER is correct. idx 0 is correct in both. idx 1 is correct in exp1. idx 2 is correct in exp2. idx 3 is correct in exp1. idx 4 is correct in exp1? Wait, P1[4] is 0, T[4] is 0 -> Correct. So e1 is only idx 2.)
    # Let's verify:
    # T = [0, 1, 0, 1, 0]
    # P1= [0, 1, 1, 1, 0] -> errors = [F, F, T, F, F] -> 1 error
    # P2= [0, 0, 0, 0, 1] -> errors = [F, T, F, T, T] -> 3 errors
    # Both error: None.
    assert data["error_overlap"]["exp1_errors"] == 1
    assert data["error_overlap"]["exp2_errors"] == 3
    assert data["error_overlap"]["shared_errors"] == 0
    assert data["error_overlap"]["union_errors"] == 4
    assert data["error_overlap"]["jaccard_similarity"] == 0.0
    
    assert data["oracle"]["oracle_errors"] == 0
    assert data["oracle"]["oracle_accuracy"] == 1.0
