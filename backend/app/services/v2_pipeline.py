import asyncio
from typing import Union
import os
import uuid
import io
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
from datetime import datetime, timezone
from sqlalchemy.future import select

from app.db.database import AsyncSessionLocal
from app.db.models import AnalysisJob, EvidenceSignal, EvidenceObservation, AnalysisResult, AnalysisPolicy
from app.adapters.spatial import DeepVerifySpatialAdapter
from app.adapters.frequency import DeepVerifyFrequencyAdapter
from app.core.config import settings
from app.core.storage import get_storage_provider

v2_inference_semaphore = None

def get_inference_semaphore():
    global v2_inference_semaphore
    if v2_inference_semaphore is None:
        v2_inference_semaphore = asyncio.Semaphore(1)
    return v2_inference_semaphore

spatial_adapter = DeepVerifySpatialAdapter(settings.EXP001_SPATIAL_CONFIG_PATH)
frequency_adapter = DeepVerifyFrequencyAdapter(settings.EXP002_FREQUENCY_CONFIG_PATH)

v2_adapters_loaded = False

def load_v2_adapters():
    global v2_adapters_loaded
    try:
        spatial_ok = False
        freq_ok = False
        if settings.EXP001_SPATIAL_WEIGHTS_PATH and os.path.exists(settings.EXP001_SPATIAL_WEIGHTS_PATH):
            spatial_adapter.load(settings.EXP001_SPATIAL_WEIGHTS_PATH, device="cpu")
            spatial_ok = spatial_adapter.is_loaded
        if settings.EXP002_FREQUENCY_WEIGHTS_PATH and os.path.exists(settings.EXP002_FREQUENCY_WEIGHTS_PATH):
            frequency_adapter.load(settings.EXP002_FREQUENCY_WEIGHTS_PATH, device="cpu")
            freq_ok = frequency_adapter.is_loaded
        
        v2_adapters_loaded = spatial_ok and freq_ok
        if not v2_adapters_loaded:
            print("Warning: V2 inference adapters not loaded (weights missing or unconfigured). Inference is unavailable.")
    except Exception as e:
        print(f"Failed to load V2 adapters: {e}")
        v2_adapters_loaded = False

def _run_v2_inference(file_input: Union[str, bytes], policy):
    if not v2_adapters_loaded:
        raise RuntimeError("MODEL_ADAPTERS_UNAVAILABLE: V2 inference adapters are not loaded. Cannot run inference on uninitialized models.")
    
    spatial_signals, spatial_heatmap, freq_signals = [], None, []
    
    # Spatial
    if "deepverify-spatial-v1" in policy.participating_model_ids:
        spatial_tensor = spatial_adapter.preprocess(file_input)
        spatial_signals = spatial_adapter.infer(spatial_tensor)
        spatial_exp = spatial_adapter.explain(spatial_tensor)
        spatial_heatmap = spatial_exp.heatmap_array if spatial_exp else None
    
    # Frequency
    if "deepverify-frequency-v1" in policy.participating_model_ids:
        freq_tensor = frequency_adapter.preprocess(file_input)
        freq_signals = frequency_adapter.infer(freq_tensor)
    
    return spatial_signals, spatial_heatmap, freq_signals

async def process_analysis_job(job_id: str, evidence_id: str, file_path: str):
    from sqlalchemy import update
    async with AsyncSessionLocal() as session:
        stmt = update(AnalysisJob).where(
            AnalysisJob.id == job_id,
            AnalysisJob.status == "QUEUED"
        ).values(
            status="RUNNING",
            started_at=datetime.now(timezone.utc)
        )
        result = await session.execute(stmt)
        await session.commit()
        if result.rowcount == 0:
            return  # Already claimed or not queued
            
        job = await session.get(AnalysisJob, job_id)
        policy_version = job.policy_version if job.policy_version else "ensemble-v1.0"
        
        stmt_policy = select(AnalysisPolicy).where(AnalysisPolicy.version == policy_version)
        policy = (await session.execute(stmt_policy)).scalar_one()
        
    heatmap_uri = None
    try:
        storage = get_storage_provider()
        # If file_path is an R2 key or not on local filesystem, fetch bytes from storage
        if isinstance(file_path, str) and not os.path.isfile(file_path):
            file_input = await storage.get_file(file_path)
        else:
            file_input = file_path

        async with get_inference_semaphore():
            results = await asyncio.to_thread(_run_v2_inference, file_input, policy)
            
        spatial_signals, spatial_heatmap, freq_signals = results
        
        if spatial_heatmap is not None:
            storage = get_storage_provider()
            cm = plt.get_cmap("jet")
            colored = cm(spatial_heatmap)[:, :, :3]
            colored = (colored * 255).astype(np.uint8)
            img = Image.fromarray(colored)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            heatmap_uri = await storage.save_file(f"heatmap_{uuid.uuid4().hex}", buf.getvalue(), "png")
            
        try:
            async with AsyncSessionLocal() as session:
                # Need to fetch policy in this session
                stmt = select(AnalysisPolicy).where(AnalysisPolicy.version == policy_version)
                policy_record = (await session.execute(stmt)).scalar_one()
                
                # Extract deterministic observations
                try:
                    with Image.open(file_path) as im:
                        width, height = im.size
                        img_format = im.format
                        img_mode = im.mode
                        
                        obs_dimensions = EvidenceObservation(
                            evidence_id=evidence_id,
                            signal_type="IMAGE_DIMENSIONS",
                            value=f"{width}x{height}",
                            representation=f"Width: {width}px, Height: {height}px",
                            provenance="PIL.Image (Backend Extraction)"
                        )
                        obs_format = EvidenceObservation(
                            evidence_id=evidence_id,
                            signal_type="IMAGE_FORMAT",
                            value=str(img_format),
                            representation=f"Color Mode: {img_mode}",
                            provenance="PIL.Image (Backend Extraction)"
                        )
                        session.add_all([obs_dimensions, obs_format])
                except Exception as e:
                    pass # Non-fatal if PIL can't read it natively here
                
                for s in spatial_signals + freq_signals:
                    signal_record = EvidenceSignal(
                        evidence_id=evidence_id,
                        signal_type=s.signal_type,
                        value=s.value,
                        confidence_semantics=s.confidence_semantics,
                        model_id=spatial_adapter.model_id if "SPATIAL" in s.signal_type else frequency_adapter.model_id,
                        model_version=spatial_adapter.model_version if "SPATIAL" in s.signal_type else frequency_adapter.model_version,
                        provenance=spatial_adapter.model_id if "SPATIAL" in s.signal_type else frequency_adapter.model_id
                    )
                    session.add(signal_record)
                    
                s_val = next((float(s.value) for s in spatial_signals if s.signal_type == "SPATIAL_PROBABILITY_REAL"), None)
                f_val = next((float(s.value) for s in freq_signals if s.signal_type == "FREQUENCY_PROBABILITY_REAL"), None)
                
                w_spatial = policy_record.weights.get("deepverify-spatial-v1", 0.0)
                w_freq = policy_record.weights.get("deepverify-frequency-v1", 0.0)
                
                ensemble_score = 0.0
                if s_val is not None:
                    ensemble_score += w_spatial * s_val
                if f_val is not None:
                    ensemble_score += w_freq * f_val
                    
                verdict = "LIKELY_AUTHENTIC" if ensemble_score >= policy_record.decision_threshold else "LIKELY_AI_GENERATED"
                
                res = AnalysisResult(
                    evidence_id=evidence_id,
                    policy_id=policy_record.id,
                    verdict=verdict,
                    ensemble_score=ensemble_score,
                    ai_explanation=heatmap_uri
                )
                session.add(res)
                
                job = await session.get(AnalysisJob, job_id)
                job.status = "COMPLETED"
                job.completed_at = datetime.now(timezone.utc)
                
                # Update evidence status
                from app.db.models import EvidenceItem
                evidence = await session.get(EvidenceItem, evidence_id)
                if evidence:
                    evidence.status = "COMPLETED"
                    
                await session.commit()
        except Exception as e:
            if heatmap_uri:
                storage = get_storage_provider()
                await storage.delete_file(heatmap_uri)
            raise e
            
            
    except Exception as e:
        async with AsyncSessionLocal() as session:
            job = await session.get(AnalysisJob, job_id)
            if job:
                job.status = "FAILED"
                job.error_message = str(e)
                job.completed_at = datetime.now(timezone.utc)
                
                from app.db.models import EvidenceItem
                evidence = await session.get(EvidenceItem, evidence_id)
                if evidence:
                    evidence.status = "FAILED"
                    
                await session.commit()
