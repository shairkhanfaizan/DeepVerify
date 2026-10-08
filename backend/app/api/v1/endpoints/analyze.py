import uuid
import os
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from app.schemas.responses import AnalyzeAcceptedResponse, ErrorResponse
from app.services.validation import validate_and_read_image, ValidationError
from app.services import inference
from app.services.result_store import create_pending_result
from app.core.config import settings

router = APIRouter()

@router.post("/analyze/image", response_model=AnalyzeAcceptedResponse, status_code=202)
async def analyze_image(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not inference.models_loaded:
        raise HTTPException(status_code=503, detail="Model is not available.")

    request_id = str(uuid.uuid4())

    try:
        content = await validate_and_read_image(file)
    except ValidationError as e:
        raise HTTPException(status_code=e.status_code, detail={"error": {"code": e.code, "message": e.message, "request_id": request_id}})

    # Save temp file
    # We use extension .jpg or .png based on validation if needed, but validation returns content.
    # Let's save as .bin since image format is handled by pipeline.py based on PIL
    temp_dir = os.path.join(settings.TEMP_DIR, request_id)
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, "original.img")

    with open(temp_path, "wb") as f:
        f.write(content)

    create_pending_result(request_id, "image")
    background_tasks.add_task(inference.run_inference_task, request_id, temp_path)

    return AnalyzeAcceptedResponse(
        request_id=request_id,
        status="PROCESSING",
        media_type="image",
        message="Analysis queued. Poll /api/v1/results/{request_id} for result."
    )
