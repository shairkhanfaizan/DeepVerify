from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class ModelInfo(BaseModel):
    model_version: str
    model_type: str

class ModelScores(BaseModel):
    spatial: Optional[float] = None
    frequency: Optional[float] = None
    ensemble: Optional[float] = None

class ExplanationResultSchema(BaseModel):
    heatmap_url: Optional[str] = None
    regions: Optional[list] = None

class ProcessingMeta(BaseModel):
    processing_time_ms: int
    created_at: str

class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: Optional[str] = None

class ErrorResponse(BaseModel):
    error: ErrorDetail

class AnalysisResult(BaseModel):
    request_id: str
    status: str
    media_type: str
    verdict: Optional[str] = None
    confidence: Optional[float] = None
    model_info: Optional[ModelInfo] = None
    scores: Optional[ModelScores] = None
    explanation: Optional[ExplanationResultSchema] = None
    frames: Optional[list] = None
    processing_meta: Optional[ProcessingMeta] = None
    error: Optional[ErrorDetail] = None

class AnalyzeAcceptedResponse(BaseModel):
    request_id: str
    status: str
    media_type: str
    message: str
