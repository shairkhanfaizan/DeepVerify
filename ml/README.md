# DeepVerify ML Package (`deepverify_ml`)

This package contains the core machine learning logic, neural network model definitions, preprocessing pipelines, training loops, and evaluation metrics for deepfake detection.

## Package Structure
* `deepverify_ml/models/` — Model definitions (e.g., EfficientNet, MesoNet, ResNet baselines) and Grad-CAM interpretability hooks.
* `deepverify_ml/preprocessing/` — Face extraction, frame sampling, normalization, and tensor transformation pipelines. (Must be identical for training and inference).
* `deepverify_ml/evaluation/` — Standardized metrics calculation (Accuracy, Precision, Recall, F1, ROC-AUC, Confusion Matrix).
* `deepverify_ml/training/` — Configuration-driven CLI training routines (run in Colab or on dedicated GPU machines).

## Rules & Boundaries
* Follows `.agents/rules/ml.md`:
  - Training and inference share the exact same preprocessing logic.
  - Video datasets must be split by source video ID to prevent data leakage.
  - No model weights (`.pt`, `.pth`, `.safetensors`) are committed to this repository.
