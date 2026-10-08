from abc import ABC, abstractmethod
import torch
import numpy as np
from dataclasses import dataclass
from typing import Optional, Dict

@dataclass
class PredictionResult:
    model_version: str
    model_type: str
    label: str
    score: float
    probabilities: Dict[str, float]
    processing_time_ms: int

@dataclass
class ExplanationResult:
    heatmap_array: np.ndarray
    target_layer: str

class ModelInterface(ABC):
    """
    Conceptual interface all DeepVerify inference models must implement.
    """
    @abstractmethod
    def load(self, checkpoint_path: str, device: str) -> None:
        """Load model weights from checkpoint. Called once at backend startup."""
        pass

    @abstractmethod
    def preprocess(self, input_path: str) -> torch.Tensor:
        """
        Load and preprocess input into model-ready tensor.
        MUST use the same preprocessing logic as training.
        """
        pass

    @abstractmethod
    def infer(self, tensor: torch.Tensor) -> PredictionResult:
        """
        Run forward pass. No gradient tracking.
        Returns a structured PredictionResult.
        """
        pass

    @abstractmethod
    def explain(self, tensor: torch.Tensor) -> Optional[ExplanationResult]:
        """
        Generate Grad-CAM heatmap (optional — returns None if not supported).
        Phase 3+ only.
        """
        pass
