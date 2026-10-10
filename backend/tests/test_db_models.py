import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.models import Base, User, Investigation, EvidenceItem, AnalysisPolicy, EvidenceObservation, EvidenceSignal
from app.core.config import settings

# Test DB url - using the same one for simplicity of the test
TEST_DATABASE_URL = settings.DATABASE_URL

@pytest.mark.asyncio
async def test_db_connectivity():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        assert conn is not None
    await engine.dispose()

import uuid

@pytest.mark.asyncio
async def test_create_user():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        user = User(email=f"test_{uuid.uuid4()}@example.com", hashed_password="hashed")
        session.add(user)
        await session.commit()
        assert user.id is not None
    await engine.dispose()
    
@pytest.mark.asyncio
async def test_create_analysis_policy():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        policy = AnalysisPolicy(
            version=f"1.0.1-{uuid.uuid4()}",
            configuration_hash="abc",
            participating_model_ids=["m1", "m2"],
            model_versions={"m1": "1.0", "m2": "2.0"},
            weights={"m1": 0.6, "m2": 0.4},
            score_semantics="AI_PROBABILITY",
            decision_threshold=0.5,
            preprocessing_version="1.2"
        )
        session.add(policy)
        await session.commit()
        assert policy.id is not None
        assert policy.decision_threshold == 0.5
    await engine.dispose()

@pytest.mark.asyncio
async def test_analysis_policy_immutability():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    # 1. Create Policy
    async with async_session() as session:
        policy = AnalysisPolicy(
            version=f"1.0.2-{uuid.uuid4()}",
            configuration_hash="def",
            participating_model_ids=["m1"],
            model_versions={"m1": "1.0"},
            weights={"m1": 1.0},
            score_semantics="AI_PROBABILITY",
            decision_threshold=0.5,
            preprocessing_version="1.2"
        )
        session.add(policy)
        await session.commit()
        policy_id = policy.id

    # 2. Attempt to mutate it
    async with async_session() as session:
        policy = await session.get(AnalysisPolicy, policy_id)
        policy.decision_threshold = 0.9  # Try to silently change the threshold
        
        with pytest.raises(ValueError, match="AnalysisPolicy records are immutable and cannot be modified"):
            await session.commit()
            
    await engine.dispose()
