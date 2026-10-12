#!/usr/bin/env bash
# Render Build Script for DeepVerify Backend
set -e

echo "=== [1/4] Upgrading pip ==="
python -m pip install --upgrade pip

echo "=== [2/4] Installing PyTorch (CPU-only build for low memory footprint) ==="
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "=== [3/4] Installing DeepVerify packages ==="
python -m pip install -e ./ml
python -m pip install -e ./backend

echo "=== [4/4] Downloading ML Models from Hugging Face ==="
mkdir -p models

if [ ! -f "models/spatial_model_best.pth" ]; then
    echo "Downloading EXP-001 (Spatial model)..."
    curl -L "https://huggingface.co/shairkhanfaizan/deepverify-models/resolve/main/spatial/model_best.pth" -o "models/spatial_model_best.pth"
fi

if [ ! -f "models/frequency_model_best.pth" ]; then
    echo "Downloading EXP-002 (Frequency model)..."
    curl -L "https://huggingface.co/shairkhanfaizan/deepverify-models/resolve/main/frequency/model_best.pth" -o "models/frequency_model_best.pth"
fi

echo "=== Build finished successfully! ==="
