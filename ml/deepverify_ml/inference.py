import torch
import yaml
from pathlib import Path
from typing import Optional, Dict
import time

from .models.interface import ModelInterface, PredictionResult, ExplanationResult
from .models.efficientnet import build_model_from_config
from .preprocessing.pipeline import preprocess_image
from .preprocessing.frequency import log_magnitude_fft
from .explainability.gradcam import GradCAM

class SpatialInferenceModel(ModelInterface):
    """
    Wraps the EXP-001 Spatial EfficientNet-B0 model to fulfill the standard ModelInterface.
    Provides Grad-CAM explainability for the spatial domain.
    """
    def __init__(self, config_path: Path):
        with open(config_path, "r") as f:
            self.config = yaml.safe_load(f)
        self.device = "cpu"
        self.model = build_model_from_config(self.config)

        # Determine the target layer for EfficientNet-B0 (last conv layer before pooling)
        # In torchvision efficientnet_b0, self.model.features[-1] is a Conv2dNormActivation
        # whose first element is the final 1x1 Conv2d.
        self.target_layer = self.model.model.features[-1]
        self.grad_cam = GradCAM(self.model, self.target_layer)

    def load(self, checkpoint_path: str, device: str = "cpu") -> None:
        self.device = device
        state_dict = torch.load(checkpoint_path, map_location=device, weights_only=True)
        if "model_state_dict" in state_dict:
            self.model.load_state_dict(state_dict["model_state_dict"])
        else:
            self.model.load_state_dict(state_dict)
        self.model.to(device)
        self.model.eval()

    def preprocess(self, input_path: str) -> torch.Tensor:
        arr = preprocess_image(input_path, is_training=False, normalize=True)
        tensor = torch.from_numpy(arr).unsqueeze(0).to(self.device)
        return tensor

    def infer(self, tensor: torch.Tensor) -> PredictionResult:
        start = time.time()
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
        end = time.time()

        score = probs[1].item() # probability of REAL (class 1)
        label = "LIKELY_AUTHENTIC" if score >= 0.5 else "LIKELY_AI_GENERATED"

        return PredictionResult(
            model_version="spatial-v1.0",
            model_type="spatial",
            label=label,
            score=score,
            probabilities={"FAKE": probs[0].item(), "REAL": probs[1].item()},
            processing_time_ms=int((end - start) * 1000)
        )

    def explain(self, tensor: torch.Tensor) -> Optional[ExplanationResult]:
        """
        Generates Grad-CAM spatial explanation.
        The heatmap highlights spatial regions supporting the ensemble/model prediction.
        """
        with torch.no_grad():
            logits = self.model(tensor)
            pred_class = torch.argmax(logits, dim=1).item()

        heatmap = self.grad_cam.generate(tensor, target_class=pred_class)

        return ExplanationResult(
            heatmap_array=heatmap,
            target_layer=self.target_layer.__class__.__name__
        )

class FrequencyInferenceModel(ModelInterface):
    """
    Wraps the EXP-002 Frequency EfficientNet-B0 model.
    Applies the exact canonical FFT preprocessing pipeline.
    Does NOT provide Grad-CAM (explain returns None).
    """
    def __init__(self, config_path: Path):
        with open(config_path, "r") as f:
            self.config = yaml.safe_load(f)
        self.device = "cpu"
        self.model = build_model_from_config(self.config)

    def load(self, checkpoint_path: str, device: str = "cpu") -> None:
        self.device = device
        state_dict = torch.load(checkpoint_path, map_location=device, weights_only=True)
        if "model_state_dict" in state_dict:
            self.model.load_state_dict(state_dict["model_state_dict"])
        else:
            self.model.load_state_dict(state_dict)
        self.model.to(device)
        self.model.eval()

    def preprocess(self, input_path: str) -> torch.Tensor:
        # Canonical frequency preprocessing: unnormalized array -> FFT
        numpy_tensor = preprocess_image(input_path, is_training=False, normalize=False)
        tensor = torch.from_numpy(numpy_tensor)
        tensor = log_magnitude_fft(tensor)
        return tensor.unsqueeze(0).to(self.device)

    def infer(self, tensor: torch.Tensor) -> PredictionResult:
        start = time.time()
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
        end = time.time()

        score = probs[1].item() # probability of REAL (class 1)
        label = "LIKELY_AUTHENTIC" if score >= 0.5 else "LIKELY_AI_GENERATED"

        return PredictionResult(
            model_version="frequency-v1.0",
            model_type="frequency",
            label=label,
            score=score,
            probabilities={"FAKE": probs[0].item(), "REAL": probs[1].item()},
            processing_time_ms=int((end - start) * 1000)
        )

    def explain(self, tensor: torch.Tensor) -> Optional[ExplanationResult]:
        """
        Frequency model does not expose a spatial Grad-CAM heatmap.
        """
        return None
