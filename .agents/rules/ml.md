# DeepVerify ML Rules

## 1. Experiment-Driven Development
- ML development MUST be experiment-driven.
- Never use hardcoded values in scripts. All experiments must be configuration-driven (e.g., `YAML`).
- Experiments must be executed via parameterized CLI commands: `python train.py --config config.yaml`.

## 2. Experiment Tracking & Reproducibility
- Every experiment MUST have a unique ID (e.g., `EXP-001`).
- Results must be logged in a registry (e.g., `experiments/registry.csv`).
- Every training run MUST record: the config file used, the Git hash, the random seed, and the dataset version.

## 3. Data Leakage Prevention (CRITICAL)
- For video datasets, train/test/val splits MUST be performed by **source video**, not by individual frame.
- Splitting by frame leads to data leakage and artificially inflated accuracy.

## 4. Dataset Management
- Raw videos and large datasets MUST NEVER enter the Git repository.
- The Git repository should only contain dataset loaders, preprocessing logic, and sample/toy data.
- Dataset lineage (source, processing steps, location) must be documented in a dedicated README.

## 5. Model Versioning & Storage
- Model weights MUST NOT be committed to Git.
- Model artifacts should be versioned separately and stored in a model registry (e.g., Hugging Face Hub).
- Models must be identifiable and reproducible from their recorded artifact hash.

## 6. Colab Environment Boundaries
- Google Colab is the GPU execution environment, NOT the source of truth for the project.
- A Colab notebook should simply clone the repository, install the ML package, and execute the training scripts. It should not contain 5,000 lines of monolithic code.

## 7. Preprocessing Consistency
- **CRITICAL:** Preprocessing logic MUST NOT differ between training and inference.
- Ideally, the exact same preprocessing function/class is shared across both environments.

## 8. Evaluation & Research Validation
- Models MUST NEVER be evaluated on training data when reporting research metrics.
- Evaluation must use a held-out validation/test split as appropriate.
- At minimum, research evaluation should record:
  Accuracy, Precision, Recall, F1, ROC-AUC, and a confusion matrix where applicable.
- Metrics MUST be computed from actual evaluation results; never invent, estimate, or manually enter metrics.
- Treating cross-generator generalization and compression resilience as experiments is required (they are features of the research, not given assumptions).
