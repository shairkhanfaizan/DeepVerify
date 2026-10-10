import uuid
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.database import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String, default="investigator")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    investigations: Mapped[list["Investigation"]] = relationship(back_populates="user")

class Investigation(Base):
    __tablename__ = "investigations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="OPEN") # OPEN, COMPLETED, ARCHIVED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    
    user: Mapped["User"] = relationship(back_populates="investigations")
    evidence_items: Mapped[list["EvidenceItem"]] = relationship(back_populates="investigation", cascade="all, delete-orphan")

class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    investigation_id: Mapped[str] = mapped_column(ForeignKey("investigations.id"), index=True)
    file_hash: Mapped[str] = mapped_column(String, index=True)
    mime_type: Mapped[str] = mapped_column(String)
    storage_key: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="UPLOADED") # UPLOADED, ANALYZING, COMPLETED, FAILED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    investigation: Mapped["Investigation"] = relationship(back_populates="evidence_items")
    jobs: Mapped[list["AnalysisJob"]] = relationship(back_populates="evidence_item", cascade="all, delete-orphan")
    observations: Mapped[list["EvidenceObservation"]] = relationship(back_populates="evidence_item", cascade="all, delete-orphan")
    signals: Mapped[list["EvidenceSignal"]] = relationship(back_populates="evidence_item", cascade="all, delete-orphan")
    analysis_results: Mapped[list["AnalysisResult"]] = relationship(back_populates="evidence_item", cascade="all, delete-orphan")

class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence_items.id"), index=True)
    policy_version: Mapped[str] = mapped_column(String, default="ensemble-v1.0")
    status: Mapped[str] = mapped_column(String, default="QUEUED") # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    evidence_item: Mapped["EvidenceItem"] = relationship(back_populates="jobs")

class EvidenceObservation(Base):
    __tablename__ = "evidence_observations"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence_items.id"), index=True)
    signal_type: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[str] = mapped_column(String)
    representation: Mapped[str] = mapped_column(String)
    provenance: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    evidence_item: Mapped["EvidenceItem"] = relationship(back_populates="observations")

class EvidenceSignal(Base):
    __tablename__ = "evidence_signals"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence_items.id"), index=True)
    signal_type: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[str] = mapped_column(String)
    confidence_semantics: Mapped[str] = mapped_column(String)
    model_id: Mapped[str] = mapped_column(String, index=True)
    model_version: Mapped[str] = mapped_column(String)
    provenance: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    evidence_item: Mapped["EvidenceItem"] = relationship(back_populates="signals")

class AnalysisPolicy(Base):
    __tablename__ = "analysis_policies"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    version: Mapped[str] = mapped_column(String, unique=True, index=True)
    configuration_hash: Mapped[str] = mapped_column(String)
    participating_model_ids: Mapped[list[str]] = mapped_column(JSONB)
    model_versions: Mapped[dict[str, str]] = mapped_column(JSONB)
    weights: Mapped[dict[str, float]] = mapped_column(JSONB)
    score_semantics: Mapped[str] = mapped_column(String)
    decision_threshold: Mapped[float] = mapped_column(Float)
    preprocessing_version: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

from sqlalchemy import event
@event.listens_for(AnalysisPolicy, 'before_update')
def receive_before_update(mapper, connection, target):
    raise ValueError("AnalysisPolicy records are immutable and cannot be modified.")

class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=generate_uuid)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence_items.id"), unique=True)
    policy_id: Mapped[str] = mapped_column(ForeignKey("analysis_policies.id"))
    verdict: Mapped[str] = mapped_column(String)
    ensemble_score: Mapped[float] = mapped_column(Float)
    ai_explanation: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    
    evidence_item: Mapped["EvidenceItem"] = relationship(back_populates="analysis_results")
    policy: Mapped["AnalysisPolicy"] = relationship()
    
    @property
    def policy_version(self) -> str:
        return self.policy.version if self.policy else "Unknown"

class ModelRegistryEntry(Base):
    __tablename__ = "model_registry"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    version: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    source_url: Mapped[Optional[str]] = mapped_column(String)
    approval_status: Mapped[str] = mapped_column(String, default="EVALUATING") # EVALUATING, APPROVED, REJECTED, DEPRECATED
    task: Mapped[str] = mapped_column(String)
    score_semantics: Mapped[str] = mapped_column(String)
    artifact_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
