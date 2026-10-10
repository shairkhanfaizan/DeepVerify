import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.models import AnalysisJob, EvidenceItem, User, Investigation
from app.core.config import settings
from app.main import lifespan
from fastapi import FastAPI
import uuid

TEST_DATABASE_URL = settings.DATABASE_URL

@pytest.mark.asyncio
async def test_startup_reconciliation():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
    
    # 1. Seed lost jobs
    async with async_session_maker() as session:
        user = User(email=f"test_{uuid.uuid4()}@example.com", hashed_password="hashed")
        session.add(user)
        await session.commit()
        
        inv = Investigation(user_id=user.id, title="Test Inv")
        session.add(inv)
        await session.commit()
        
        evidence = EvidenceItem(investigation_id=inv.id, file_hash="abc", mime_type="image/jpeg", storage_key="abc.jpg")
        session.add(evidence)
        await session.commit()
        
        job1 = AnalysisJob(evidence_id=evidence.id, status="QUEUED")
        job2 = AnalysisJob(evidence_id=evidence.id, status="RUNNING")
        job3 = AnalysisJob(evidence_id=evidence.id, status="COMPLETED")
        
        session.add_all([job1, job2, job3])
        await session.commit()
        
        job1_id = job1.id
        job2_id = job2.id
        job3_id = job3.id
        
    # 2. Run Lifespan (simulating startup)
    dummy_app = FastAPI()
    async with lifespan(dummy_app):
        pass # Lifespan executes
        
    # 3. Verify they were reconciled
    async with async_session_maker() as session:
        j1 = await session.get(AnalysisJob, job1_id)
        assert j1.status == "FAILED"
        assert j1.error_message == "Job interrupted by server crash/restart."
        
        j2 = await session.get(AnalysisJob, job2_id)
        assert j2.status == "FAILED"
        assert j2.error_message == "Job interrupted by server crash/restart."
        
        j3 = await session.get(AnalysisJob, job3_id)
        assert j3.status == "COMPLETED" # should not be touched
        assert j3.error_message is None

    await engine.dispose()
