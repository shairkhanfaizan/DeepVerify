# Jupyter & Google Colab Notebooks

This directory contains lightweight execution notebooks for training and evaluating models in cloud GPU environments like Google Colab.

## Colab Workflow Standards
Per `.agents/rules/ml.md` and repository guidelines:
1. **Colab is an execution runner, not the codebase:** Notebooks should not contain monolithic application code.
2. **Notebook Role:** A training notebook should merely:
   - Clone the DeepVerify repository
   - Authenticate with storage/GPU runtimes
   - Install requirements (`pip install -e ml/`)
   - Invoke parameterized CLI scripts (e.g., `python -m ml.training.train --config ...`)
   - Push trained artifacts to the designated model registry
