import pytest
import os
from app.adapters.spatial import DeepVerifySpatialAdapter
from app.adapters.frequency import DeepVerifyFrequencyAdapter
from app.core.config import settings

def test_real_spatial_adapter_smoke():
    if not settings.EXP001_SPATIAL_WEIGHTS_PATH or not os.path.exists(settings.EXP001_SPATIAL_WEIGHTS_PATH):
        pytest.skip("Spatial model weights not configured or not found on disk.")
    adapter = DeepVerifySpatialAdapter(settings.EXP001_SPATIAL_CONFIG_PATH)
    adapter.load(settings.EXP001_SPATIAL_WEIGHTS_PATH, device="cpu")
    
    import numpy as np
    from PIL import Image
    import tempfile
    
    img = Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8))
    with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
        img.save(tmp.name)
        
        tensor = adapter.preprocess(tmp.name)
        signals = adapter.infer(tensor)
        
        assert len(signals) == 1
        assert signals[0].signal_type == "SPATIAL_PROBABILITY_REAL"
        assert 0.0 <= float(signals[0].value) <= 1.0
        
        explanation = adapter.explain(tensor)
        assert explanation is not None
        assert explanation.heatmap_array is not None

def test_real_frequency_adapter_smoke():
    if not settings.EXP002_FREQUENCY_WEIGHTS_PATH or not os.path.exists(settings.EXP002_FREQUENCY_WEIGHTS_PATH):
        pytest.skip("Frequency model weights not configured or not found on disk.")
    adapter = DeepVerifyFrequencyAdapter(settings.EXP002_FREQUENCY_CONFIG_PATH)
    adapter.load(settings.EXP002_FREQUENCY_WEIGHTS_PATH, device="cpu")
    
    import numpy as np
    from PIL import Image
    import tempfile
    
    img = Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8))
    with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
        img.save(tmp.name)
        
        tensor = adapter.preprocess(tmp.name)
        signals = adapter.infer(tensor)
        
        assert len(signals) == 1
        assert signals[0].signal_type == "FREQUENCY_PROBABILITY_REAL"
        assert 0.0 <= float(signals[0].value) <= 1.0
        
        # Frequency does not have Grad-CAM spatial heatmaps
        explanation = adapter.explain(tensor)
        assert explanation is None
