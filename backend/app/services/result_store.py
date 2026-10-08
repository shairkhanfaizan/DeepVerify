from typing import Dict, Optional, Any
from app.schemas.responses import AnalysisResult
from datetime import datetime, timezone

# Simple V1 in-memory ephemeral store
# Note: Restarts will lose data. No multiprocess scaling.
_store: Dict[str, AnalysisResult] = {}
_heatmaps: Dict[str, bytes] = {}  # request_id -> PNG bytes

def create_pending_result(request_id: str, media_type: str = "image"):
    _store[request_id] = AnalysisResult(
        request_id=request_id,
        status="PROCESSING",
        media_type=media_type,
    )

def get_result(request_id: str) -> Optional[AnalysisResult]:
    return _store.get(request_id)

def update_result(request_id: str, result: AnalysisResult):
    _store[request_id] = result

def save_heatmap(request_id: str, heatmap_bytes: bytes):
    _heatmaps[request_id] = heatmap_bytes

def get_heatmap(request_id: str) -> Optional[bytes]:
    return _heatmaps.get(request_id)
