import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.models import Base, ModelRegistryEntry
from app.services.model_registry import ModelRegistryService, ModelNotFoundError, ModelNotApprovedError
from app.core.config import settings

TEST_DATABASE_URL = settings.DATABASE_URL

@pytest.mark.asyncio
async def test_model_registry_approved():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Setup
        model = ModelRegistryEntry(
            id="test-model-1",
            version="1.0",
            name="Test Model 1",
            approval_status="APPROVED",
            task="IMAGE_MANIPULATION_DETECTION",
            score_semantics="AI_PROBABILITY",
            artifact_hash="hash1"
        )
        session.add(model)
        await session.commit()
        
        # Act
        retrieved = await ModelRegistryService.get_approved_model(session, "test-model-1", "1.0")
        
        # Assert
        assert retrieved is not None
        assert retrieved.id == "test-model-1"
        
        # Cleanup
        await session.delete(retrieved)
        await session.commit()
    await engine.dispose()

@pytest.mark.asyncio
async def test_model_registry_not_found():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        with pytest.raises(ModelNotFoundError):
            await ModelRegistryService.get_approved_model(session, "nonexistent-model", "1.0")
    await engine.dispose()

@pytest.mark.asyncio
async def test_model_registry_not_approved():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Setup
        model = ModelRegistryEntry(
            id="test-model-2",
            version="1.0",
            name="Test Model 2",
            approval_status="EVALUATING",  # Not APPROVED
            task="IMAGE_MANIPULATION_DETECTION",
            score_semantics="AI_PROBABILITY",
            artifact_hash="hash2"
        )
        session.add(model)
        await session.commit()
        
        # Act & Assert
        with pytest.raises(ModelNotApprovedError):
            await ModelRegistryService.get_approved_model(session, "test-model-2", "1.0")
            
        # Cleanup
        await session.delete(model)
        await session.commit()
    await engine.dispose()

@pytest.mark.asyncio
async def test_seed_initial_models():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session() as session:
        await ModelRegistryService.seed_initial_models(session)
        
        m1 = await ModelRegistryService.get_approved_model(session, "deepverify-spatial-v1", "1.0")
        assert m1.id == "deepverify-spatial-v1"
        
        m2 = await ModelRegistryService.get_approved_model(session, "deepverify-frequency-v1", "1.0")
        assert m2.id == "deepverify-frequency-v1"
    await engine.dispose()
