import torch
import time
from pathlib import Path
from deepverify_ml.models.efficientnet import DeepVerifyEfficientNet
from deepverify_ml.explainability.gradcam import GradCAM

def benchmark():
    model = DeepVerifyEfficientNet(num_classes=2, pretrained=False)
    model.eval()

    # Target final conv layer
    target_layer = model.model.features[-1]
    grad_cam = GradCAM(model, target_layer)

    tensor = torch.randn(1, 3, 224, 224)

    # Warmup
    for _ in range(5):
        with torch.no_grad():
            _ = model(tensor)

    # Normal inference
    start = time.time()
    for _ in range(100):
        with torch.no_grad():
            _ = model(tensor)
    normal_time = (time.time() - start) / 100 * 1000  # ms

    # Warmup Grad-CAM
    for _ in range(5):
        _ = grad_cam.generate(tensor, target_class=1)

    # Grad-CAM inference
    start = time.time()
    for _ in range(100):
        _ = grad_cam.generate(tensor, target_class=1)
    gradcam_time = (time.time() - start) / 100 * 1000  # ms

    print(f"Normal Inference Time: {normal_time:.2f} ms")
    print(f"Grad-CAM Inference Time: {gradcam_time:.2f} ms")
    print(f"Overhead: {(gradcam_time - normal_time):.2f} ms")
    print("Explanation generation requires gradients, meaning `torch.no_grad()` cannot be used, and backpropagation computation is required. This fundamentally adds overhead.")

if __name__ == "__main__":
    benchmark()
