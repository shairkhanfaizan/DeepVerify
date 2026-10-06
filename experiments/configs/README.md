# Experiment Configurations

YAML configuration files for reproducible ML runs are placed in this directory.
All configuration schemas must adhere to the [ML & Data Pipeline Contract](../../docs/research/data-contract.md).

## Active Experiment: EXP-001 Spatial Baseline

- **Status**: FROZEN / UPCOMING EXECUTION
- **Configuration**: `EXP-001.yaml` is now frozen and acts as the strict source of truth for the experiment.
- **Execution State**: Training has **NOT yet occurred**.
- **Artifacts**: Checkpoint artifacts (`model_best.pth`, `model_final.pth`) and execution logs are generated **only during execution**. They do not exist in the repository prior to execution.
- **Integrity**: Experiment results **must never be fabricated or hallucinated**. Actual metrics (`metrics.json`) will be recorded **only after** the experiment runs on a GPU (e.g., Google Colab).
