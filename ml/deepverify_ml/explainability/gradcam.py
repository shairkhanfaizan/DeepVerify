import torch
import torch.nn.functional as F
import numpy as np
from typing import Optional

class GradCAM:
    """
    Grad-CAM explainability for convolutional models.
    Provides visualization of salient regions supporting the model's prediction.
    NOTE: This is NOT causal proof, and must not be described as proving
    that a particular region is AI-generated.
    """
    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.activations = None
        self.gradients = None
        self.hooks = []

        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output

        def backward_hook(module, grad_input, grad_output):
            self.gradients = grad_output[0]

        # Register forward and backward hooks
        self.hooks.append(self.target_layer.register_forward_hook(forward_hook))
        self.hooks.append(self.target_layer.register_full_backward_hook(backward_hook))

    def remove_hooks(self):
        """Removes registered hooks from the model."""
        for hook in self.hooks:
            hook.remove()
        self.hooks.clear()

    def __del__(self):
        self.remove_hooks()

    def generate(self, input_tensor: torch.Tensor, target_class: Optional[int] = None) -> np.ndarray:
        """
        Generates a Grad-CAM heatmap for the given input tensor.
        NOTE: Must not be run inside torch.no_grad() because gradients are required.
        """
        was_training = self.model.training
        self.model.eval()

        # Ensure input requires gradients
        if not input_tensor.requires_grad:
            input_tensor.requires_grad_(True)

        # Forward pass
        logits = self.model(input_tensor)

        if target_class is None:
            target_class = torch.argmax(logits, dim=1).item()

        self.model.zero_grad()

        # Backward pass for the target class
        target = logits[0, target_class]
        target.backward(retain_graph=True)

        if self.gradients is None or self.activations is None:
            if was_training:
                self.model.train()
            return np.zeros((input_tensor.shape[2], input_tensor.shape[3]), dtype=np.float32)

        # Global average pool gradients over spatial dimensions (H, W)
        weights = torch.mean(self.gradients, dim=(2, 3), keepdim=True)

        # Weight activation maps
        cam = torch.sum(weights * self.activations, dim=1, keepdim=True)

        # Apply ReLU
        cam = F.relu(cam)

        # Resize to original image dimensions (B, C, H, W -> B, 1, H, W)
        cam = F.interpolate(cam, size=(input_tensor.shape[2], input_tensor.shape[3]), mode='bilinear', align_corners=False)

        cam_np = cam.detach().squeeze().cpu().numpy()

        # Normalize to [0, 1]
        cam_min, cam_max = cam_np.min(), cam_np.max()
        if cam_max > cam_min:
            cam_np = (cam_np - cam_min) / (cam_max - cam_min)
        else:
            cam_np = np.zeros_like(cam_np)

        if was_training:
            self.model.train()

        return cam_np
