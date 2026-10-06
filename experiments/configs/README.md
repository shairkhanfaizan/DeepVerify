# Experiment Configurations

YAML configuration files for reproducible ML runs are placed in this directory.  
All configuration schemas must adhere to the [ML & Data Pipeline Contract](../../docs/research/data-contract.md).

## Configuration Schema Example (EXP-001 Spatial Baseline)

> [!NOTE]
> The hyperparameter values shown below (`batch_size`, `epochs`, `optimizer`, `learning_rate`, `weight_decay`, `scheduler`, `mixed_precision`, `dropout_rate`) are **initial candidate/proposed defaults for EXP-001** and will be frozen when EXP-001 execution begins.

```yaml
experiment_id: EXP-001-spatial-baseline
description: "Initial EfficientNet-B0 spatial baseline on 140k Real/Fake Faces"
tags: ["spatial", "efficientnet-b0", "baseline", "m0"]
seed: 42

dataset:
  name: "140k-real-and-fake-faces"
  version: "1.0"
  split_manifest: "data/splits/140k-split-v1.0.csv"
  split_seed: 42

model:
  architecture: "efficientnet-b0"
  pretrained: true
  weights: "IMAGENET1K_V1"
  num_classes: 2
  dropout_rate: 0.2

preprocessing:
  input_size: [224, 224]
  mean: [0.485, 0.456, 0.406]
  std: [0.229, 0.224, 0.225]
  resize_method: "bilinear_center_crop"

training:
  batch_size: 64
  epochs: 10
  optimizer: "AdamW"
  learning_rate: 0.0001
  weight_decay: 0.01
  loss_function: "CrossEntropyLoss"
  scheduler: "CosineAnnealingLR"
  mixed_precision: true

environment:
  runtime: "Google Colab"
  accelerator: "NVIDIA T4 / A100 GPU"
```
