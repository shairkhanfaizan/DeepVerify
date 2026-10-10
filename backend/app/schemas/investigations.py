from pydantic import BaseModel, ConfigDict, Field, field_validator
import re
from datetime import datetime
from typing import Optional, List
from .auth import UserResponse

class EvidenceSignalResponse(BaseModel):
    id: str
    signal_type: str
    value: str
    confidence_semantics: str
    model_id: str
    model_version: str
    provenance: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class EvidenceObservationResponse(BaseModel):
    id: str
    signal_type: str
    value: str
    representation: str
    provenance: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class AnalysisResultResponse(BaseModel):
    id: str
    policy_id: str
    policy_version: str
    verdict: str
    ensemble_score: float
    ai_explanation: Optional[str]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class AnalysisJobResponse(BaseModel):
    id: str
    status: str
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

class EvidenceItemResponse(BaseModel):
    id: str
    file_hash: str
    mime_type: str
    status: str
    created_at: datetime
    
    jobs: List[AnalysisJobResponse] = []
    signals: List[EvidenceSignalResponse] = []
    observations: List[EvidenceObservationResponse] = []
    analysis_results: List[AnalysisResultResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class InvestigationCreate(BaseModel):
    title: str
    notes: Optional[str] = None

class InvestigationUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None

class AssistantQueryRequest(BaseModel):
    question: Optional[str] = Field(None, max_length=4000)
    google_api_key: Optional[str] = Field(None, max_length=128)
    gemini_model: Optional[str] = Field(None, max_length=64)

    @field_validator("google_api_key")
    @classmethod
    def validate_key(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not re.match(r"^[A-Za-z0-9_\-\.]+$", v):
            raise ValueError("Invalid API key format: contains illegal characters.")
        if len(v) < 10:
            raise ValueError("Invalid API key: too short.")
        return v

    @field_validator("gemini_model")
    @classmethod
    def validate_model(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", v):
            raise ValueError("Invalid model identifier format.")
        return v

class KeyValidationRequest(BaseModel):
    google_api_key: str = Field(..., min_length=10, max_length=128)
    gemini_model: Optional[str] = Field(None, max_length=64)

    @field_validator("google_api_key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^[A-Za-z0-9_\-\.]+$", v):
            raise ValueError("Invalid API key format: contains illegal characters.")
        return v

    @field_validator("gemini_model")
    @classmethod
    def validate_model(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if not re.match(r"^[a-zA-Z0-9_\-\.]+$", v):
            raise ValueError("Invalid model identifier format.")
        return v

class KeyValidationResponse(BaseModel):
    valid: bool
    model: str
    message: Optional[str] = None

class InvestigationResponse(BaseModel):
    id: str
    title: str
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    evidence_items: List[EvidenceItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class InvestigationListResponse(BaseModel):
    id: str
    title: str
    status: str
    created_at: datetime
    updated_at: datetime
    evidence_items: List[EvidenceItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)
