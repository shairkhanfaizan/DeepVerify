import pytest
from fastapi.testclient import TestClient
import io
import os
from unittest.mock import patch, MagicMock

from app.main import app
from app.services import inference
from app.schemas.responses import ExplanationResultSchema
import deepverify_ml.models.interface as ml_interface

client = TestClient(app)

@pytest.fixture(autouse=True)
def mock_ml_layer(monkeypatch):
    """Mocks the ML components so backend tests don't require real weights or datasets."""
    # We directly mock the models in the inference module

    mock_spatial = MagicMock()
    mock_spatial.infer.return_value = ml_interface.PredictionResult(
        model_version="spatial-v1.0", model_type="spatial", label="LIKELY_AUTHENTIC",
        score=0.9, probabilities={"REAL": 0.9, "FAKE": 0.1}, processing_time_ms=10
    )
    mock_spatial_explain = MagicMock()
    mock_spatial_explain.heatmap_array = None # Skip array to avoid generating image in tests unless tested
    mock_spatial.explain.return_value = mock_spatial_explain

    mock_freq = MagicMock()
    mock_freq.infer.return_value = ml_interface.PredictionResult(
        model_version="frequency-v1.0", model_type="frequency", label="LIKELY_AI_GENERATED",
        score=0.1, probabilities={"REAL": 0.1, "FAKE": 0.9}, processing_time_ms=10
    )

    monkeypatch.setattr(inference, "spatial_model", mock_spatial)
    monkeypatch.setattr(inference, "frequency_model", mock_freq)
    monkeypatch.setattr(inference, "models_loaded", True)

def test_health_check_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_v1_health_check_ok():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["model_loaded"] is True

def test_v1_health_check_degraded(monkeypatch):
    monkeypatch.setattr(inference, "models_loaded", False)
    response = client.get("/api/v1/health")
    assert response.status_code == 503
    assert response.json()["model_loaded"] is False

def test_analyze_image_invalid_extension():
    file_bytes = b"fake image content"
    response = client.post(
        "/api/v1/analyze/image",
        files={"file": ("test.txt", file_bytes, "text/plain")}
    )
    assert response.status_code == 415

def test_analyze_image_invalid_magic_bytes():
    file_bytes = b"fake image content"
    response = client.post(
        "/api/v1/analyze/image",
        files={"file": ("test.jpg", file_bytes, "image/jpeg")}
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_MAGIC_BYTES"

def test_analyze_image_success():
    # Construct a minimal valid JPEG
    # FF D8 FF E0 00 10 4A 46 49 46 00 ... (Valid JPEG header)
    import PIL.Image
    img = PIL.Image.new("RGB", (100, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    file_bytes = buf.getvalue()
    response = client.post(
        "/api/v1/analyze/image",
        files={"file": ("test.jpg", file_bytes, "image/jpeg")}
    )
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "PROCESSING"
    request_id = data["request_id"]

    # Poll for result
    res_response = client.get(f"/api/v1/results/{request_id}")
    assert res_response.status_code == 200
    res_data = res_response.json()

    # Check ensemble logic (0.6 * 0.9 + 0.4 * 0.1 = 0.54 + 0.04 = 0.58)
    # Background task might not have finished immediately, so we need to wait or mock it to run sync
    # Since background task is run in async thread, wait slightly
    import time
    for _ in range(10):
        res_response = client.get(f"/api/v1/results/{request_id}")
        res_data = res_response.json()
        if res_data["status"] == "COMPLETED":
            break
        time.sleep(0.1)

    assert res_data["status"] == "COMPLETED"
    assert abs(res_data["scores"]["ensemble"] - 0.58) < 1e-5
    assert res_data["verdict"] == "LIKELY_AUTHENTIC"

def test_analyze_image_results_not_found():
    response = client.get("/api/v1/results/unknown-uuid")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
