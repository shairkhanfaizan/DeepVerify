import pytest
from app.adapters.spatial import DeepVerifySpatialAdapter
from app.adapters.frequency import DeepVerifyFrequencyAdapter
from app.core.config import settings
from unittest.mock import patch, MagicMock

def test_spatial_adapter():
    # We won't load actual weights in tests as they might not exist locally,
    # so we mock the inner model to verify the adapter contract.
    with patch("app.adapters.spatial.SpatialInferenceModel") as MockModel:
        mock_instance = MockModel.return_value
        # Mock infer return
        mock_res = MagicMock()
        mock_res.probabilities = {"REAL": 0.85, "FAKE": 0.15}
        mock_instance.infer.return_value = mock_res
        
        adapter = DeepVerifySpatialAdapter(settings.EXP001_SPATIAL_CONFIG_PATH)
        assert adapter.model_id == "deepverify-spatial-v1"
        assert adapter.model_version == "1.0"
        assert adapter.is_loaded is False
        adapter.load("mock_weights.pth")
        assert adapter.is_loaded is True
        
        # Test infer standardization
        signals = adapter.infer("fake_tensor")
        assert len(signals) == 1
        assert signals[0].signal_type == "SPATIAL_PROBABILITY_REAL"
        assert signals[0].value == "0.85"
        assert signals[0].confidence_semantics == "AI_PROBABILITY"

def test_frequency_adapter():
    with patch("app.adapters.frequency.FrequencyInferenceModel") as MockModel:
        mock_instance = MockModel.return_value
        # Mock infer return
        mock_res = MagicMock()
        mock_res.probabilities = {"REAL": 0.42, "FAKE": 0.58}
        mock_instance.infer.return_value = mock_res
        
        adapter = DeepVerifyFrequencyAdapter(settings.EXP002_FREQUENCY_CONFIG_PATH)
        assert adapter.model_id == "deepverify-frequency-v1"
        assert adapter.model_version == "1.0"
        assert adapter.is_loaded is False
        adapter.load("mock_weights.pth")
        assert adapter.is_loaded is True
        
        # Test infer standardization
        signals = adapter.infer("fake_tensor")
        assert len(signals) == 1
        assert signals[0].signal_type == "FREQUENCY_PROBABILITY_REAL"
        assert signals[0].value == "0.42"
        assert signals[0].confidence_semantics == "AI_PROBABILITY"
