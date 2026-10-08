import pytest
import torch
import torch.nn as nn
import numpy as np
from deepverify_ml.explainability.gradcam import GradCAM

class DummyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv = nn.Conv2d(3, 10, kernel_size=3, padding=1)
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Linear(10, 2)

    def forward(self, x):
        x = self.conv(x)
        x = self.pool(x)
        x = torch.flatten(x, 1)
        x = self.fc(x)
        return x

def test_gradcam_output_shape_and_range():
    model = DummyModel()
    target_layer = model.conv
    grad_cam = GradCAM(model, target_layer)

    # Create a dummy image tensor [1, 3, 224, 224]
    input_tensor = torch.randn(1, 3, 224, 224)

    heatmap = grad_cam.generate(input_tensor, target_class=1)

    # Check shape
    assert heatmap.shape == (224, 224), f"Expected (224, 224), got {heatmap.shape}"

    # Check range (normalized between 0 and 1 safely)
    assert np.all(heatmap >= 0.0) and np.all(heatmap <= 1.0)

    # Check finiteness
    assert np.all(np.isfinite(heatmap))

    grad_cam.remove_hooks()

def test_gradcam_zero_gradient_handling():
    model = DummyModel()
    target_layer = model.conv
    grad_cam = GradCAM(model, target_layer)

    input_tensor = torch.zeros(1, 3, 224, 224)

    # If we force gradients to be zero (e.g. by setting weights to 0)
    model.fc.weight.data.fill_(0.0)
    model.fc.bias.data.fill_(0.0)

    heatmap = grad_cam.generate(input_tensor, target_class=1)

    # Should safely return an array of zeros, no NaNs
    assert heatmap.shape == (224, 224)
    assert np.all(np.isfinite(heatmap))
    assert np.all(heatmap == 0.0)

    grad_cam.remove_hooks()

def test_gradcam_cleanup():
    model = DummyModel()
    target_layer = model.conv
    grad_cam = GradCAM(model, target_layer)

    # Should have hooks registered
    assert len(grad_cam.hooks) == 2

    grad_cam.remove_hooks()
    assert len(grad_cam.hooks) == 0

def test_gradcam_does_not_break_inference():
    model = DummyModel()
    target_layer = model.conv
    grad_cam = GradCAM(model, target_layer)

    input_tensor = torch.randn(1, 3, 224, 224)

    # Normal inference with torch.no_grad()
    with torch.no_grad():
        out1 = model(input_tensor)

    # Generate Grad-CAM (which uses gradients)
    _ = grad_cam.generate(input_tensor, target_class=0)

    # Normal inference again
    with torch.no_grad():
        out2 = model(input_tensor)

    assert torch.allclose(out1, out2)
    grad_cam.remove_hooks()
