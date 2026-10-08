import time
import io
import asyncio
from datetime import datetime, timezone
import torch
import numpy as np
from PIL import Image

from app.core.config import settings
from app.schemas.responses import (
    AnalysisResult, ModelInfo, ModelScores,
    ExplanationResultSchema, ProcessingMeta, ErrorDetail
)
from app.services.result_store import update_result, save_heatmap

from deepverify_ml.inference import SpatialInferenceModel, FrequencyInferenceModel

# Global model state
spatial_model = None
frequency_model = None
models_loaded = False

def load_models():
    global spatial_model, frequency_model, models_loaded
    try:
        if not settings.EXP001_SPATIAL_WEIGHTS_PATH or not settings.EXP002_FREQUENCY_WEIGHTS_PATH:
            raise ValueError("Model paths not configured")

        spatial_model = SpatialInferenceModel(settings.EXP001_SPATIAL_CONFIG_PATH)
        spatial_model.load(settings.EXP001_SPATIAL_WEIGHTS_PATH, device="cpu")

        frequency_model = FrequencyInferenceModel(settings.EXP002_FREQUENCY_CONFIG_PATH)
        frequency_model.load(settings.EXP002_FREQUENCY_WEIGHTS_PATH, device="cpu")

        models_loaded = True
    except Exception as e:
        print(f"Failed to load models: {e}")
        models_loaded = False

def _run_inference_sync(request_id: str, file_path: str):
    start_time = time.time()
    try:
        if not models_loaded:
            raise RuntimeError("MODEL_UNAVAILABLE")

        # Spatial
        spatial_tensor = spatial_model.preprocess(file_path)
        spatial_res = spatial_model.infer(spatial_tensor)

        # Frequency
        freq_tensor = frequency_model.preprocess(file_path)
        freq_res = frequency_model.infer(freq_tensor)

        # Ensemble 60/40
        spatial_p_real = spatial_res.probabilities.get("REAL", 0.0)
        freq_p_real = freq_res.probabilities.get("REAL", 0.0)
        ensemble_p_real = 0.60 * spatial_p_real + 0.40 * freq_p_real

        verdict = "LIKELY_AUTHENTIC" if ensemble_p_real >= 0.5 else "LIKELY_AI_GENERATED"

        # Grad-CAM
        heatmap_url = None
        explanation = spatial_model.explain(spatial_tensor)
        if explanation is not None and explanation.heatmap_array is not None:
            heatmap_url = f"{settings.API_V1_STR}/results/{request_id}/heatmap.png"
            # Encode heatmap
            try:
                import matplotlib.pyplot as plt
                cm = plt.get_cmap("jet")
                heatmap_colored = cm(explanation.heatmap_array)[:, :, :3]
                heatmap_colored = (heatmap_colored * 255).astype(np.uint8)
                img = Image.fromarray(heatmap_colored)
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                save_heatmap(request_id, buf.getvalue())
            except Exception as e:
                print(f"Heatmap generation failed: {e}")
                heatmap_url = None

        processing_time = int((time.time() - start_time) * 1000)

        result = AnalysisResult(
            request_id=request_id,
            status="COMPLETED",
            media_type="image",
            verdict=verdict,
            confidence=ensemble_p_real,
            model_info=ModelInfo(model_version="ensemble-v1.0", model_type="ensemble"),
            scores=ModelScores(
                spatial=spatial_p_real,
                frequency=freq_p_real,
                ensemble=ensemble_p_real
            ),
            explanation=ExplanationResultSchema(heatmap_url=heatmap_url),
            processing_meta=ProcessingMeta(
                processing_time_ms=processing_time,
                created_at=datetime.now(timezone.utc).isoformat()
            )
        )
        update_result(request_id, result)

    except Exception as e:
        processing_time = int((time.time() - start_time) * 1000)
        code = str(e) if str(e) == "MODEL_UNAVAILABLE" else "PROCESSING_FAILED"
        result = AnalysisResult(
            request_id=request_id,
            status="FAILED",
            media_type="image",
            processing_meta=ProcessingMeta(
                processing_time_ms=processing_time,
                created_at=datetime.now(timezone.utc).isoformat()
            ),
            error=ErrorDetail(code=code, message="Inference failed.", request_id=request_id)
        )
        update_result(request_id, result)

# V1 Concurrency Guard: Limit concurrent CPU inferences to prevent CPU thrashing
# Since PyTorch holds the GIL during some operations and maxes out cores,
# we restrict to 1 concurrent inference to maintain stable API responsiveness.
inference_semaphore = asyncio.Semaphore(1)

async def run_inference_task(request_id: str, file_path: str):
    import os
    try:
        async with inference_semaphore:
            await asyncio.to_thread(_run_inference_sync, request_id, file_path)
    finally:
        # Cleanup
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
            # Remove temp dir if empty
            os.rmdir(os.path.dirname(file_path))
        except Exception:
            pass
