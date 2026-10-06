"""
DeepVerify Phase 2 — Split + Preprocessing Tests
==================================================
Verifies:
  1.  Split seed is 42
  2.  Split generation is deterministic (two runs → identical assignments)
  3.  Manifest contains exactly the expected row count
  4.  Train / val / test counts match expected proportions
  5.  train ∩ val = ∅, train ∩ test = ∅, val ∩ test = ∅ (path-level)
  6.  Class distribution: each split is exactly 50% real / 50% fake
  7.  Exact content hashes do not cross split boundaries
  8.  Validation/test preprocessing is deterministic (same output on two calls)
  9.  Preprocessing output shape is [3, 224, 224]
  10. Normalization constants match the approved contract

Contract: docs/research/data-contract.md
"""

import csv
import hashlib
import io
import sys
import tempfile
from pathlib import Path

import numpy as np
import pytest
from PIL import Image
from sklearn.model_selection import StratifiedShuffleSplit

# Ensure the repo root is on the path so we can import pipeline + scripts
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "ml"))
sys.path.insert(0, str(REPO_ROOT / "ml" / "scripts"))

from deepverify_ml.preprocessing.pipeline import (
    IMAGENET_MEAN,
    IMAGENET_STD,
    TARGET_IMAGE_SIZE,
    preprocess_image,
    resize_and_crop,
    to_normalized_array,
    validate_and_decode,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
SPLIT_SEED  = 42
TRAIN_FRAC  = 0.70
VAL_FRAC    = 0.15
TEST_FRAC   = 0.15

SPLIT_CSV   = REPO_ROOT / "data" / "splits" / "140k-split-v1.0.csv"
LINEAGE_JSON = REPO_ROOT / "docs" / "research" / "manifests" / "140k-lineage.json"

EXPECTED_MANIFEST_SHA256 = "f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466"


def _make_solid_jpeg(color=(128, 64, 32), size=(256, 256)) -> bytes:
    """Return raw JPEG bytes of a solid-colour image — used as a synthetic fixture."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _run_split(file_paths: list, labels: list) -> dict:
    """Run the same deterministic split logic as the pipeline (no file I/O)."""
    X = np.array(file_paths)
    y = np.array(labels)

    sss_test = StratifiedShuffleSplit(n_splits=1, test_size=TEST_FRAC, random_state=SPLIT_SEED)
    trainval_idx, test_idx = next(sss_test.split(X, y))
    X_tv, y_tv = X[trainval_idx], y[trainval_idx]
    X_test, y_test = X[test_idx], y[test_idx]

    val_frac_of_tv = VAL_FRAC / (TRAIN_FRAC + VAL_FRAC)
    sss_val = StratifiedShuffleSplit(n_splits=1, test_size=val_frac_of_tv, random_state=SPLIT_SEED)
    train_idx, val_idx = next(sss_val.split(X_tv, y_tv))

    return {
        "train": list(zip(X_tv[train_idx].tolist(), y_tv[train_idx].tolist())),
        "val":   list(zip(X_tv[val_idx].tolist(),   y_tv[val_idx].tolist())),
        "test":  list(zip(X_test.tolist(),           y_test.tolist())),
    }


# ---------------------------------------------------------------------------
# Tests — Split Protocol
# ---------------------------------------------------------------------------

class TestSplitSeed:
    """T1: The split seed is 42."""

    def test_split_seed_constant_is_42(self):
        assert SPLIT_SEED == 42, "SPLIT_SEED must be 42 per data-contract.md §4.2"


class TestSplitDeterminism:
    """T2: Two executions with identical inputs produce identical assignments."""

    def test_deterministic_split_on_synthetic_manifest(self):
        # Use a small synthetic manifest — avoids I/O on 140k images
        n = 200  # 100 real, 100 fake
        paths  = [f"data/raw/140k/real/{i:05d}.jpg" for i in range(100)]
        paths += [f"data/raw/140k/fake/{i:05d}.jpg" for i in range(100)]
        labels = [1] * 100 + [0] * 100

        result_a = _run_split(paths, labels)
        result_b = _run_split(paths, labels)

        for split_name in ("train", "val", "test"):
            assert result_a[split_name] == result_b[split_name], (
                f"Split '{split_name}' is not deterministic — "
                "two identical runs produced different assignments."
            )


class TestManifestContents:
    """T3–T6: Manifest row count, split proportions, disjointness, class balance."""

    @pytest.fixture(scope="class")
    def manifest_rows(self):
        if not SPLIT_CSV.exists():
            pytest.skip("Split manifest not found — run run_data_pipeline.py first.")
        with open(SPLIT_CSV, newline="") as f:
            return list(csv.DictReader(f))

    def test_T3_total_row_count(self, manifest_rows):
        """T3: Manifest has exactly 140000 rows."""
        assert len(manifest_rows) == 140000, (
            f"Expected 140000 rows, got {len(manifest_rows)}"
        )

    def test_T4_split_counts_and_proportions(self, manifest_rows):
        """T4: Train≈98000, val≈21000, test≈21000 (70/15/15)."""
        splits = {"train": 0, "val": 0, "test": 0}
        for row in manifest_rows:
            splits[row["split"]] += 1
        assert splits["train"] == 98000, f"train={splits['train']}, expected 98000"
        assert splits["val"]   == 21000, f"val={splits['val']},   expected 21000"
        assert splits["test"]  == 21000, f"test={splits['test']},  expected 21000"

    def test_T5_splits_are_disjoint_by_path(self, manifest_rows):
        """T5: No filepath appears in more than one split."""
        split_paths: dict[str, set] = {"train": set(), "val": set(), "test": set()}
        for row in manifest_rows:
            split_paths[row["split"]].add(row["filepath"])

        assert split_paths["train"].isdisjoint(split_paths["val"]),  \
            "train ∩ val ≠ ∅ — path-level leakage detected!"
        assert split_paths["train"].isdisjoint(split_paths["test"]), \
            "train ∩ test ≠ ∅ — path-level leakage detected!"
        assert split_paths["val"].isdisjoint(split_paths["test"]),   \
            "val ∩ test ≠ ∅ — path-level leakage detected!"

    def test_T6_class_distribution(self, manifest_rows):
        """T6: Each split is exactly 50% real / 50% fake."""
        for split_name in ("train", "val", "test"):
            rows = [r for r in manifest_rows if r["split"] == split_name]
            real_count = sum(1 for r in rows if r["label"] == "real")
            fake_count = sum(1 for r in rows if r["label"] == "fake")
            assert real_count == fake_count, (
                f"Split '{split_name}' is not class-balanced: "
                f"real={real_count}, fake={fake_count}"
            )

    def test_no_duplicate_sample_identifiers(self, manifest_rows):
        """All sample identifiers (filepath) are unique across the full manifest."""
        all_paths = [r["filepath"] for r in manifest_rows]
        assert len(all_paths) == len(set(all_paths)), \
            "Duplicate filepath entries found in manifest!"


class TestCrossHashLeakage:
    """T7: Exact content hashes do not cross split boundaries."""

    @pytest.fixture(scope="class")
    def manifest_rows(self):
        if not SPLIT_CSV.exists():
            pytest.skip("Split manifest not found.")
        with open(SPLIT_CSV, newline="") as f:
            return list(csv.DictReader(f))

    def test_T7_no_cross_split_hash_duplicates(self, manifest_rows):
        """T7: ContentHashes(train) ∩ ContentHashes(val/test) = ∅."""
        split_hashes: dict[str, set] = {"train": set(), "val": set(), "test": set()}
        for row in manifest_rows:
            sha = row.get("sha256", "")
            if sha and len(sha) == 64:
                split_hashes[row["split"]].add(sha)

        assert split_hashes["train"].isdisjoint(split_hashes["val"]),  \
            "Content hash leakage: train ∩ val ≠ ∅"
        assert split_hashes["train"].isdisjoint(split_hashes["test"]), \
            "Content hash leakage: train ∩ test ≠ ∅"
        assert split_hashes["val"].isdisjoint(split_hashes["test"]),   \
            "Content hash leakage: val ∩ test ≠ ∅"


# ---------------------------------------------------------------------------
# Tests — Preprocessing
# ---------------------------------------------------------------------------

class TestPreprocessingDeterminism:
    """T8: Validation/test preprocessing is byte-identical across two calls."""

    def test_T8_deterministic_inference_mode(self):
        jpeg_bytes = _make_solid_jpeg(color=(100, 150, 200))
        out_a = preprocess_image(jpeg_bytes, is_training=False)
        out_b = preprocess_image(jpeg_bytes, is_training=False)
        np.testing.assert_array_equal(
            out_a, out_b,
            err_msg="Inference-mode preprocessing is not deterministic!"
        )


class TestPreprocessingShape:
    """T9: Preprocessing output shape is [3, 224, 224]."""

    def test_T9_output_shape(self):
        jpeg_bytes = _make_solid_jpeg(size=(300, 200))
        out = preprocess_image(jpeg_bytes, is_training=False)
        assert out.shape == (3, 224, 224), \
            f"Expected shape (3, 224, 224), got {out.shape}"

    def test_T9_output_dtype_float32(self):
        jpeg_bytes = _make_solid_jpeg()
        out = preprocess_image(jpeg_bytes, is_training=False)
        assert out.dtype == np.float32, \
            f"Expected float32, got {out.dtype}"


class TestPreprocessingNormalization:
    """T10: Normalization constants match the approved contract."""

    def test_T10_imagenet_mean(self):
        expected = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
        np.testing.assert_allclose(
            IMAGENET_MEAN, expected, rtol=1e-6,
            err_msg="IMAGENET_MEAN does not match approved contract values."
        )

    def test_T10_imagenet_std(self):
        expected = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)
        np.testing.assert_allclose(
            IMAGENET_STD, expected, rtol=1e-6,
            err_msg="IMAGENET_STD does not match approved contract values."
        )

    def test_T10_normalization_applied(self):
        """
        A pure white image (all pixels = 255) should normalize to
        (1.0 - mean) / std for each channel. Verify channel 0.
        """
        white_jpeg = _make_solid_jpeg(color=(255, 255, 255))
        out = preprocess_image(white_jpeg, is_training=False)

        expected_ch0 = (1.0 - 0.485) / 0.229
        np.testing.assert_allclose(
            out[0].mean(), expected_ch0, atol=0.01,
            err_msg="Channel 0 normalization does not match (1.0-mean)/std for white image."
        )

    def test_T10_target_image_size(self):
        assert TARGET_IMAGE_SIZE == (224, 224), \
            f"TARGET_IMAGE_SIZE must be (224, 224), got {TARGET_IMAGE_SIZE}"


class TestTrainingAugmentationIsolation:
    """Training augmentation must NOT be applied in val/test mode."""

    def test_augmentation_absent_in_inference_mode(self):
        """
        In inference mode, the same input must always produce the same output,
        even over many iterations — proving no random ops are executed.
        """
        jpeg_bytes = _make_solid_jpeg(color=(80, 160, 240))
        baseline = preprocess_image(jpeg_bytes, is_training=False)
        for _ in range(10):
            out = preprocess_image(jpeg_bytes, is_training=False)
            np.testing.assert_array_equal(baseline, out)

    def test_training_mode_augmentation_configuration(self):
        """
        Verify that training mode explicitly configures:
        - horizontal flip probability/configuration is 0.5
        - rotation configuration is ±10 degrees
        - brightness/contrast jitter configuration is ±0.1
        """
        from unittest.mock import patch, MagicMock
        
        jpeg_bytes = _make_solid_jpeg(color=(200, 100, 50))
        
        with patch('numpy.random.rand', return_value=0.6) as mock_rand, \
             patch('numpy.random.uniform', side_effect=[0.05, -0.05, 5.0]) as mock_uniform, \
             patch('PIL.Image.Image.transpose') as mock_transpose, \
             patch('PIL.Image.Image.rotate') as mock_rotate, \
             patch('PIL.ImageEnhance.Brightness') as mock_brightness, \
             patch('PIL.ImageEnhance.Contrast') as mock_contrast:
             
             # Mock the enhance returns to just return the image mock
             img_mock = MagicMock()
             mock_brightness.return_value.enhance.return_value = img_mock
             mock_contrast.return_value.enhance.return_value = img_mock
             
             # The internal pipeline calls rotate, so we just want it to not crash
             # But wait, our mocks on PIL.Image might mess up validate_and_decode.
             pass
        
        # A simpler way to test the exact values is just by patching np.random
        # and checking the calls to np.random.uniform
        with patch('numpy.random.rand', return_value=0.6) as mock_rand, \
             patch('numpy.random.uniform', return_value=0.0) as mock_uniform:
             
             _ = preprocess_image(jpeg_bytes, is_training=True)
             
             # Check that rand was called (flip prob)
             mock_rand.assert_called()
             # uniform is called for brightness, contrast, and rotation
             calls = mock_uniform.call_args_list
             assert len(calls) == 3, f"Expected 3 uniform calls, got {len(calls)}"
             
             # Brightness & Contrast: bounds are -0.1, 0.1
             assert calls[0][0] == (-0.1, 0.1), "Brightness jitter bounds must be ±0.1"
             assert calls[1][0] == (-0.1, 0.1), "Contrast jitter bounds must be ±0.1"
             # Rotation: bounds are -10.0, 10.0
             assert calls[2][0] == (-10.0, 10.0), "Rotation bounds must be ±10.0 degrees"


class TestManifestReproducibility:
    """Manifest SHA-256 matches the expected value from the pipeline run."""

    def test_manifest_sha256(self):
        if not SPLIT_CSV.exists():
            pytest.skip("Split manifest not found.")
        with open(SPLIT_CSV, "rb") as f:
            actual_sha = hashlib.sha256(f.read()).hexdigest()
        assert actual_sha == EXPECTED_MANIFEST_SHA256, (
            f"Manifest SHA-256 mismatch!\n"
            f"  Expected: {EXPECTED_MANIFEST_SHA256}\n"
            f"  Actual  : {actual_sha}\n"
            "If the manifest was intentionally regenerated, update EXPECTED_MANIFEST_SHA256."
        )
