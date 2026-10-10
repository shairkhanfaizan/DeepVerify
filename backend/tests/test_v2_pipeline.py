import pytest
import asyncio
from unittest.mock import patch, MagicMock
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.models import AnalysisJob, EvidenceItem, User, Investigation, EvidenceSignal, AnalysisResult
from app.services.v2_pipeline import process_analysis_job
from app.core.config import settings

TEST_DATABASE_URL = settings.DATABASE_URL

@pytest.fixture
async def async_session():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session_maker() as session:
        yield session
    
    await engine.dispose()

@pytest.mark.asyncio
async def test_process_analysis_job_success():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session_maker() as session:
        # Seed test data
        import uuid
        user = User(email=f"test_{uuid.uuid4()}@example.com", hashed_password="hashed")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        inv = Investigation(user_id=user.id, title="Test Inv")
        session.add(inv)
        await session.commit()
        await session.refresh(inv)
        
        evidence = EvidenceItem(investigation_id=inv.id, file_hash="abc", mime_type="image/jpeg", storage_key="abc.jpg")
        session.add(evidence)
        await session.commit()
        await session.refresh(evidence)
        
        job = AnalysisJob(evidence_id=evidence.id, status="QUEUED")
        session.add(job)
        await session.commit()
        
        job_id = job.id
        evidence_id = evidence.id
        
    # Mock inference to avoid loading actual weights in unit test
    from app.adapters.base import SignalResult, ExplanationResult
    import numpy as np
    
    async def mock_to_thread(*args, **kwargs):
        spatial = [SignalResult("SPATIAL_PROBABILITY_REAL", "0.9", "AI_PROBABILITY")]
        freq = [SignalResult("FREQUENCY_PROBABILITY_REAL", "0.2", "AI_PROBABILITY")]
        heatmap = np.zeros((10, 10))
        return spatial, heatmap, freq
        
    with patch("asyncio.to_thread", new=mock_to_thread):
        with patch("app.services.v2_pipeline.AsyncSessionLocal", new=async_session_maker):
            await process_analysis_job(job_id, evidence_id, "dummy_path.jpg")
        
    async with async_session_maker() as session:
        # Check job status
        job = await session.get(AnalysisJob, job_id)
        assert job.status == "COMPLETED"
        assert job.completed_at is not None
        
        # Check result
        from sqlalchemy.future import select
        stmt = select(AnalysisResult).where(AnalysisResult.evidence_id == evidence_id)
        result = (await session.execute(stmt)).scalar_one()
        assert result.verdict == "LIKELY_AUTHENTIC"
        assert result.ensemble_score == (0.6 * 0.9 + 0.4 * 0.2)
        assert result.ai_explanation is not None
        
        # Check signals
        stmt_signals = select(EvidenceSignal).where(EvidenceSignal.evidence_id == evidence_id)
        signals = (await session.execute(stmt_signals)).scalars().all()
        assert len(signals) == 2

    await engine.dispose()

@pytest.mark.asyncio
async def test_process_analysis_job_duplicate_execution():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session_maker() as session:
        import uuid
        user = User(email=f"test_{uuid.uuid4()}@example.com", hashed_password="hashed")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        inv = Investigation(user_id=user.id, title="Test Inv")
        session.add(inv)
        await session.commit()
        await session.refresh(inv)
        
        evidence = EvidenceItem(investigation_id=inv.id, file_hash="abc", mime_type="image/jpeg", storage_key="abc.jpg")
        session.add(evidence)
        await session.commit()
        await session.refresh(evidence)
        
        job = AnalysisJob(evidence_id=evidence.id, status="RUNNING") # Already running!
        session.add(job)
        await session.commit()
        
        job_id = job.id
        evidence_id = evidence.id
        
    # Attempting to process should abort immediately without error
    with patch("app.services.v2_pipeline.AsyncSessionLocal", new=async_session_maker):
        await process_analysis_job(job_id, evidence_id, "dummy_path.jpg")
    
    async with async_session_maker() as session:
        job = await session.get(AnalysisJob, job_id)
        assert job.status == "RUNNING" # Remained unchanged
        
    await engine.dispose()

@pytest.mark.asyncio
async def test_process_analysis_job_inference_failure():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session_maker() as session:
        import uuid
        user = User(email=f"test_{uuid.uuid4()}@example.com", hashed_password="hashed")
        session.add(user)
        await session.commit()
        await session.refresh(user)
        
        inv = Investigation(user_id=user.id, title="Test Inv")
        session.add(inv)
        await session.commit()
        await session.refresh(inv)
        
        evidence = EvidenceItem(investigation_id=inv.id, file_hash="abc", mime_type="image/jpeg", storage_key="abc.jpg")
        session.add(evidence)
        await session.commit()
        await session.refresh(evidence)
        
        job = AnalysisJob(evidence_id=evidence.id, status="QUEUED")
        session.add(job)
        await session.commit()
        
        job_id = job.id
        evidence_id = evidence.id
        
    async def mock_to_thread_fail(*args, **kwargs):
        raise ValueError("Inference crashed")
        
    with patch("asyncio.to_thread", new=mock_to_thread_fail):
        with patch("app.services.v2_pipeline.AsyncSessionLocal", new=async_session_maker):
            await process_analysis_job(job_id, evidence_id, "dummy_path.jpg")
        
    async with async_session_maker() as session:
        job = await session.get(AnalysisJob, job_id)
        assert job.status == "FAILED"
        assert "Inference crashed" in job.error_message
        
    await engine.dispose()

def test_run_v2_inference_uninitialized_guard():
    import app.services.v2_pipeline as pipeline
    original_state = pipeline.v2_adapters_loaded
    try:
        pipeline.v2_adapters_loaded = False
        with pytest.raises(RuntimeError) as exc_info:
            pipeline._run_v2_inference("fake_path.jpg", None)
        assert "MODEL_ADAPTERS_UNAVAILABLE" in str(exc_info.value)
    finally:
        pipeline.v2_adapters_loaded = original_state
