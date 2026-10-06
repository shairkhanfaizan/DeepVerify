"""
DeepVerify EXP-001 Configuration Validation
===========================================
Validates the frozen EXP-001.yaml configuration file against the 
approved Phase 2 spatial baseline contract.
"""

import yaml
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = REPO_ROOT / "experiments" / "configs" / "EXP-001.yaml"

def test_exp001_config_exists():
    """Verify that the EXP-001 configuration file exists."""
    assert CONFIG_PATH.is_file(), f"Configuration file missing: {CONFIG_PATH}"

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

def test_exp001_yaml_parses():
    """Verify that the YAML file is valid and parses into a dictionary."""
    config = load_config()
    assert isinstance(config, dict), "Parsed config should be a dictionary."

def test_exp001_experiment_identity():
    config = load_config()
    assert config["experiment"]["id"] == "EXP-001-spatial-baseline"
    assert config["experiment"]["seed"] == 42

def test_exp001_dataset_contract():
    config = load_config()
    assert config["dataset"]["name"] == "140k-real-and-fake-faces"
    assert config["dataset"]["split_manifest"] == "data/splits/140k-split-v1.0.csv"
    assert config["dataset"]["split_manifest_sha256"] == "f9bef275982fb9f6c8c58cbea4e5e2885019417a71324e4fe716fe39384de466"

def test_exp001_model_contract():
    config = load_config()
    assert config["model"]["architecture"] == "efficientnet-b0"
    assert config["model"]["pretrained"] is True
    assert config["model"]["pretrained_weights"] == "IMAGENET1K_V1"
    assert config["model"]["num_classes"] == 2

def test_exp001_preprocessing_contract():
    config = load_config()
    assert config["preprocessing"]["input_size"] == [224, 224]
    assert config["preprocessing"]["normalization_mean"] == [0.485, 0.456, 0.406]
    assert config["preprocessing"]["normalization_std"] == [0.229, 0.224, 0.225]
    
    aug = config["augmentation"]
    assert aug["horizontal_flip_probability"] == 0.5
    assert aug["rotation_degrees"] == 10.0
    assert aug["brightness_jitter"] == 0.1
    assert aug["contrast_jitter"] == 0.1

def test_exp001_training_defaults():
    config = load_config()
    train = config["training"]
    assert train["batch_size"] == 64
    assert train["epochs"] == 10
    assert train["optimizer"] == "AdamW"
    assert train["learning_rate"] == 0.0001
    assert train["weight_decay"] == 0.01

def test_exp001_evaluation_contract():
    config = load_config()
    metrics = config["evaluation"]["required_metrics"]
    expected_metrics = ["Accuracy", "Precision", "Recall", "F1", "ROC-AUC", "Confusion Matrix"]
    for metric in expected_metrics:
        assert metric in metrics, f"Missing required metric: {metric}"
