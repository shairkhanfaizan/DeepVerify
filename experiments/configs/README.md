# Experiment Configurations

YAML configuration files for reproducible ML runs are placed in this directory.

## Configuration Schema Example
```yaml
experiment_id: EXP-000-baseline
description: "Initial image-level baseline validation"
seed: 42

dataset:
  name: faceforensics++
  variant: c23
  split_manifest: docs/research/ffpp_splits.json

model:
  architecture: efficientnet-b0
  pretrained: true
  num_classes: 2

training:
  batch_size: 32
  epochs: 10
  optimizer: adamw
  learning_rate: 0.0001
```
