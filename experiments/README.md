# Experiments Registry & Configurations

This directory contains configuration files and tracking records for DeepVerify ML experiments.

## Principles
1. **No Hardcoded Constants:** Every hyperparameter, batch size, learning rate, dataset version, and random seed must be defined in a YAML configuration file under `configs/`.
2. **Registry Tracking:** Each experiment run logs its unique identifier (`EXP-001`), Git commit hash, dataset split version, and output evaluation metrics in `registry.csv`.
3. **Artifact Independence:** Experiment weights and tensor logs are uploaded to an external artifact store (e.g., Hugging Face Hub, MLflow, Weights & Biases) and never stored directly in Git.
