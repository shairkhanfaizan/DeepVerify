from fastapi import APIRouter, HTTPException, Response
from app.services.result_store import get_result, get_heatmap
from app.schemas.responses import AnalysisResult

router = APIRouter()

@router.get("/results/{request_id}", response_model=AnalysisResult)
async def get_analysis_result(request_id: str):
    result = get_result(request_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "No analysis found for the given request_id.", "request_id": request_id}}
        )
    return result

@router.get("/results/{request_id}/heatmap.png")
async def get_analysis_heatmap(request_id: str):
    heatmap_bytes = get_heatmap(request_id)
    if heatmap_bytes is None:
        raise HTTPException(status_code=404, detail="Heatmap not found")
    return Response(content=heatmap_bytes, media_type="image/png")
