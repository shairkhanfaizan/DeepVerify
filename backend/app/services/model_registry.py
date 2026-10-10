from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.models import ModelRegistryEntry

class ModelNotApprovedError(Exception):
    pass

class ModelNotFoundError(Exception):
    pass

class ModelRegistryService:
    @staticmethod
    async def get_approved_model(session: AsyncSession, model_id: str, version: str) -> ModelRegistryEntry:
        stmt = select(ModelRegistryEntry).where(
            ModelRegistryEntry.id == model_id,
            ModelRegistryEntry.version == version
        )
        result = await session.execute(stmt)
        model = result.scalar_one_or_none()
        
        if not model:
            raise ModelNotFoundError(f"Model {model_id} v{version} not found in registry.")
            
        if model.approval_status != "APPROVED":
            raise ModelNotApprovedError(f"Model {model_id} v{version} is not approved for use (Status: {model.approval_status}).")
            
        return model

    @staticmethod
    async def seed_initial_models(session: AsyncSession):
        models = [
            ModelRegistryEntry(
                id="deepverify-spatial-v1",
                version="1.0",
                name="Spatial Inference Model",
                approval_status="APPROVED",
                task="IMAGE_MANIPULATION_DETECTION",
                score_semantics="AI_PROBABILITY",
                artifact_hash="sha256-spatial-v1-hash-placeholder"
            ),
            ModelRegistryEntry(
                id="deepverify-frequency-v1",
                version="1.0",
                name="Frequency Inference Model",
                approval_status="APPROVED",
                task="IMAGE_MANIPULATION_DETECTION",
                score_semantics="AI_PROBABILITY",
                artifact_hash="sha256-freq-v1-hash-placeholder"
            )
        ]
        
        for m in models:
            stmt = select(ModelRegistryEntry).where(
                ModelRegistryEntry.id == m.id,
                ModelRegistryEntry.version == m.version
            )
            result = await session.execute(stmt)
            if not result.scalar_one_or_none():
                session.add(m)
                
        # Seed the 60/40 Ensemble AnalysisPolicy
        from app.db.models import AnalysisPolicy
        import hashlib
        
        # Calculate a stable configuration hash for the default policy
        policy_version = "ensemble-v1.0"
        config_str = "60-40-spatial-frequency-v1"
        config_hash = hashlib.sha256(config_str.encode()).hexdigest()
        
        stmt_policy = select(AnalysisPolicy).where(AnalysisPolicy.version == policy_version)
        result_policy = await session.execute(stmt_policy)
        if not result_policy.scalar_one_or_none():
            policy = AnalysisPolicy(
                version=policy_version,
                configuration_hash=config_hash,
                participating_model_ids=["deepverify-spatial-v1", "deepverify-frequency-v1"],
                model_versions={"deepverify-spatial-v1": "1.0", "deepverify-frequency-v1": "1.0"},
                weights={"deepverify-spatial-v1": 0.6, "deepverify-frequency-v1": 0.4},
                score_semantics="AI_PROBABILITY",
                decision_threshold=0.5,
                preprocessing_version="1.0"
            )
            session.add(policy)

        # Spatial-only policy
        spatial_only_version = "spatial-only-v1.0"
        spatial_only_hash = hashlib.sha256("100-spatial-v1".encode()).hexdigest()
        stmt_policy_spatial = select(AnalysisPolicy).where(AnalysisPolicy.version == spatial_only_version)
        if not (await session.execute(stmt_policy_spatial)).scalar_one_or_none():
            policy_spatial = AnalysisPolicy(
                version=spatial_only_version,
                configuration_hash=spatial_only_hash,
                participating_model_ids=["deepverify-spatial-v1"],
                model_versions={"deepverify-spatial-v1": "1.0"},
                weights={"deepverify-spatial-v1": 1.0},
                score_semantics="AI_PROBABILITY",
                decision_threshold=0.5,
                preprocessing_version="1.0"
            )
            session.add(policy_spatial)

        # Frequency-only policy
        freq_only_version = "frequency-only-v1.0"
        freq_only_hash = hashlib.sha256("100-frequency-v1".encode()).hexdigest()
        stmt_policy_freq = select(AnalysisPolicy).where(AnalysisPolicy.version == freq_only_version)
        if not (await session.execute(stmt_policy_freq)).scalar_one_or_none():
            policy_freq = AnalysisPolicy(
                version=freq_only_version,
                configuration_hash=freq_only_hash,
                participating_model_ids=["deepverify-frequency-v1"],
                model_versions={"deepverify-frequency-v1": "1.0"},
                weights={"deepverify-frequency-v1": 1.0},
                score_semantics="AI_PROBABILITY",
                decision_threshold=0.5,
                preprocessing_version="1.0"
            )
            session.add(policy_freq)
        
        await session.commit()
