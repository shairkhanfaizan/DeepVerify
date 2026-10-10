from typing import Any, List, Optional
from app.adapters.base import ModelAdapter, SignalResult, ExplanationResult
from deepverify_ml.inference import FrequencyInferenceModel

class DeepVerifyFrequencyAdapter:
    def __init__(self, config_path: str):
        self.model = FrequencyInferenceModel(config_path)
        self._model_id = "deepverify-frequency-v1"
        self._model_version = "1.0"
        self._loaded = False

    @property
    def model_id(self) -> str:
        return self._model_id

    @property
    def model_version(self) -> str:
        return self._model_version

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def load(self, weights_path: str, device: str = "cpu") -> None:
        self.model.load(weights_path, device=device)
        self._loaded = True

    def preprocess(self, file_path: str) -> Any:
        return self.model.preprocess(file_path)

    def infer(self, tensor: Any) -> List[SignalResult]:
        res = self.model.infer(tensor)
        p_real = res.probabilities.get("REAL", 0.0)
        return [
            SignalResult(
                signal_type="FREQUENCY_PROBABILITY_REAL",
                value=str(p_real),
                confidence_semantics="AI_PROBABILITY"
            )
        ]

    def explain(self, tensor: Any) -> Optional[ExplanationResult]:
        exp = self.model.explain(tensor)
        if exp and exp.heatmap_array is not None:
            return ExplanationResult(heatmap_array=exp.heatmap_array)
        return None
