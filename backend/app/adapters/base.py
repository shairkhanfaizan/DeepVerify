from typing import Protocol, Any, List, Optional
from dataclasses import dataclass

@dataclass
class SignalResult:
    signal_type: str
    value: str
    confidence_semantics: str

@dataclass
class ExplanationResult:
    heatmap_array: Optional[Any] # numpy array

class ModelAdapter(Protocol):
    @property
    def model_id(self) -> str:
        """Returns the canonical model ID (e.g. deepverify-spatial-v1)"""
        ...
        
    @property
    def model_version(self) -> str:
        """Returns the model version string"""
        ...

    def load(self, weights_path: str, device: str = "cpu") -> None:
        """Loads the model weights from the given path"""
        ...
        
    def preprocess(self, file_path: str) -> Any:
        """Preprocesses the input file into a model-compatible tensor or format"""
        ...
        
    def infer(self, tensor: Any) -> List[SignalResult]:
        """Runs inference and returns a list of standardized SignalResults"""
        ...
        
    def explain(self, tensor: Any) -> Optional[ExplanationResult]:
        """Generates an explanation (e.g. Grad-CAM) if supported, else None"""
        ...
