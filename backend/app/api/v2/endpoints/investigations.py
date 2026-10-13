from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import hashlib
import io
import json
import re
from pydantic import BaseModel

from app.api import deps
from app.db.models import User, Investigation, EvidenceItem, AnalysisJob, AnalysisResult, EvidenceObservation, EvidenceSignal
from app.schemas.investigations import (
    InvestigationCreate, 
    InvestigationUpdate, 
    InvestigationResponse, 
    InvestigationListResponse, 
    EvidenceItemResponse,
    EvidenceItemUpdate,
    AssistantQueryRequest,
    KeyValidationRequest,
    KeyValidationResponse
)
from app.core.security_upload import validate_and_hash_image
from app.core.storage import get_storage_provider
from app.services.v2_pipeline import process_analysis_job
from app.services.assistant import stream_assistant_response, validate_google_api_key
from app.services.reporting import generate_pdf_report
from app.core.config import settings as app_settings

router = APIRouter()

def _resolve_provider_label(client_google_key: str | None) -> str:
    """Determine which assistant provider will be used, for source attribution."""
    provider = app_settings.ASSISTANT_PROVIDER.lower()
    has_google = bool(client_google_key or app_settings.GOOGLE_API_KEY or app_settings.GEMINI_API_KEY)
    if (provider in ("google", "gemini") or provider == "auto" or client_google_key) and has_google:
        return "google-gemini"
    if (provider == "openai" or (provider == "auto" and app_settings.OPENAI_API_KEY)) and app_settings.OPENAI_API_KEY:
        return "openai"
    if (provider == "anthropic" or (provider == "auto" and app_settings.ANTHROPIC_API_KEY)) and app_settings.ANTHROPIC_API_KEY:
        return "anthropic"
    return "offline"

@router.post("/", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
async def create_investigation(
    investigation_in: InvestigationCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    investigation = Investigation(
        user_id=current_user.id,
        title=investigation_in.title,
        notes=investigation_in.notes
    )
    db.add(investigation)
    await db.commit()
    
    stmt = select(Investigation).options(
        selectinload(Investigation.evidence_items)
    ).where(Investigation.id == investigation.id)
    result = await db.execute(stmt)
    return result.scalar_one()

@router.get("/", response_model=List[InvestigationListResponse])
async def list_investigations(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(Investigation).options(
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.jobs),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.signals),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.observations),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.analysis_results).selectinload(AnalysisResult.policy)
    ).where(Investigation.user_id == current_user.id).order_by(Investigation.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{investigation_id}", response_model=InvestigationResponse)
async def get_investigation(
    investigation_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(Investigation).options(
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.jobs),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.signals),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.observations),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.analysis_results).selectinload(AnalysisResult.policy)
    ).where(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    investigation = result.scalar_one_or_none()
    
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")
        
    return investigation

@router.patch("/{investigation_id}", response_model=InvestigationResponse)
async def update_investigation(
    investigation_id: str,
    investigation_in: InvestigationUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(Investigation).options(
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.jobs),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.signals),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.observations),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.analysis_results).selectinload(AnalysisResult.policy)
    ).where(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    investigation = result.scalar_one_or_none()
    
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")
        
    if investigation_in.title is not None:
        investigation.title = investigation_in.title
    if investigation_in.notes is not None:
        investigation.notes = investigation_in.notes
    if investigation_in.status is not None:
        investigation.status = investigation_in.status
        
    await db.commit()
    await db.refresh(investigation)
    return investigation

@router.delete("/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_investigation(
    investigation_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(Investigation).where(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    investigation = result.scalar_one_or_none()
    
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")
        
    ev_stmt = select(EvidenceItem.id).where(EvidenceItem.investigation_id == investigation_id)
    ev_res = await db.execute(ev_stmt)
    evidence_ids = [row[0] for row in ev_res.fetchall()]
    if evidence_ids:
        # Clean up storage files if any
        storage = get_storage_provider()
        keys_stmt = select(EvidenceItem.storage_key).where(EvidenceItem.id.in_(evidence_ids))
        keys_res = await db.execute(keys_stmt)
        for row in keys_res.fetchall():
            if row[0]:
                try:
                    await storage.delete_file(row[0])
                except Exception:
                    pass

        await db.execute(delete(AnalysisResult).where(AnalysisResult.evidence_id.in_(evidence_ids)))
        await db.execute(delete(EvidenceSignal).where(EvidenceSignal.evidence_id.in_(evidence_ids)))
        await db.execute(delete(EvidenceObservation).where(EvidenceObservation.evidence_id.in_(evidence_ids)))
        await db.execute(delete(AnalysisJob).where(AnalysisJob.evidence_id.in_(evidence_ids)))
        await db.execute(delete(EvidenceItem).where(EvidenceItem.id.in_(evidence_ids)))

    await db.execute(delete(Investigation).where(Investigation.id == investigation_id))
    await db.commit()
    return None

@router.post("/{investigation_id}/evidence", status_code=status.HTTP_202_ACCEPTED)
async def upload_evidence(
    investigation_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Verify ownership
    stmt = select(Investigation).where(Investigation.id == investigation_id, Investigation.user_id == current_user.id)
    result = await db.execute(stmt)
    investigation = result.scalar_one_or_none()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")

    # Read and validate
    file_bytes = await file.read()
    try:
        file_hash, valid_ext = validate_and_hash_image(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Save to storage
    storage = get_storage_provider()
    storage_key = await storage.save_file(file_hash, file_bytes, valid_ext)
    
    try:
        evidence = EvidenceItem(
            investigation_id=investigation_id,
            file_hash=file_hash,
            mime_type=file.content_type,
            storage_key=storage_key,
            status="UPLOADED"
        )
        db.add(evidence)
        await db.flush()

        clean_name = name.strip() if name and name.strip() else (file.filename.rsplit('.', 1)[0] if file.filename else "Photo")
        obs_name = EvidenceObservation(
            evidence_id=evidence.id,
            signal_type="ORIGINAL_FILENAME",
            value=clean_name,
            representation=f"Photo Name: {clean_name}",
            provenance="User Input"
        )
        db.add(obs_name)

        await db.commit()
        await db.refresh(evidence)
    except Exception as e:
        await db.rollback()
        await storage.delete_file(storage_key)
        raise e

    return {"message": "Evidence uploaded", "evidence_id": evidence.id, "name": clean_name}

@router.patch("/{investigation_id}/evidence/{evidence_id}")
async def update_evidence(
    investigation_id: str,
    evidence_id: str,
    evidence_in: EvidenceItemUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(EvidenceItem).join(Investigation).options(
        selectinload(EvidenceItem.observations)
    ).where(
        EvidenceItem.id == evidence_id,
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if evidence_in.name is not None and evidence_in.name.strip():
        new_name = evidence_in.name.strip()
        obs = next((o for o in evidence.observations if o.signal_type in ("ORIGINAL_FILENAME", "EVIDENCE_NAME")), None)
        if obs:
            obs.value = new_name
            obs.representation = f"Photo Name: {new_name}"
        else:
            new_obs = EvidenceObservation(
                evidence_id=evidence.id,
                signal_type="ORIGINAL_FILENAME",
                value=new_name,
                representation=f"Photo Name: {new_name}",
                provenance="User Input"
            )
            db.add(new_obs)
            
    await db.commit()
    return {"message": "Evidence updated successfully", "evidence_id": evidence.id}

@router.delete("/{investigation_id}/evidence/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence_item(
    investigation_id: str,
    evidence_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(EvidenceItem).join(Investigation).where(
        EvidenceItem.id == evidence_id,
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if evidence.storage_key:
        storage = get_storage_provider()
        try:
            await storage.delete_file(evidence.storage_key)
        except Exception:
            pass

    await db.execute(delete(AnalysisResult).where(AnalysisResult.evidence_id == evidence_id))
    await db.execute(delete(EvidenceSignal).where(EvidenceSignal.evidence_id == evidence_id))
    await db.execute(delete(EvidenceObservation).where(EvidenceObservation.evidence_id == evidence_id))
    await db.execute(delete(AnalysisJob).where(AnalysisJob.evidence_id == evidence_id))
    await db.execute(delete(EvidenceItem).where(EvidenceItem.id == evidence_id))
    await db.commit()
    return None

class AnalyzeEvidenceRequest(BaseModel):
    policy: str = "ensemble-v1.0"

@router.post("/{investigation_id}/evidence/{evidence_id}/analyze", status_code=status.HTTP_202_ACCEPTED)
async def analyze_evidence(
    investigation_id: str,
    evidence_id: str,
    background_tasks: BackgroundTasks,
    req: AnalyzeEvidenceRequest = None,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Verify ownership
    stmt = select(Investigation).where(Investigation.id == investigation_id, Investigation.user_id == current_user.id)
    result = await db.execute(stmt)
    investigation = result.scalar_one_or_none()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")
        
    policy_version = req.policy if req else "ensemble-v1.0"
    from app.db.models import AnalysisPolicy
    stmt_policy = select(AnalysisPolicy).where(AnalysisPolicy.version == policy_version)
    result_policy = await db.execute(stmt_policy)
    policy = result_policy.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=400, detail="Unsupported analysis configuration")
        
    # Get evidence with row lock to prevent duplicate concurrent analysis jobs
    stmt = select(EvidenceItem).where(EvidenceItem.id == evidence_id, EvidenceItem.investigation_id == investigation_id).with_for_update()
    result = await db.execute(stmt)
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    if evidence.status in ("ANALYZING",):
        raise HTTPException(status_code=400, detail="Evidence is currently being analyzed")
        
    try:
        if evidence.status == "COMPLETED":
            await db.execute(delete(AnalysisResult).where(AnalysisResult.evidence_id == evidence.id))
            await db.execute(delete(EvidenceSignal).where(EvidenceSignal.evidence_id == evidence.id))
            await db.execute(delete(EvidenceObservation).where(EvidenceObservation.evidence_id == evidence.id))
            await db.execute(delete(AnalysisJob).where(AnalysisJob.evidence_id == evidence.id))
            await db.commit()
        evidence.status = "ANALYZING"
        job = AnalysisJob(evidence_id=evidence.id, status="QUEUED", policy_version=policy.version)
        db.add(job)
        await db.commit()
        await db.refresh(job)
        await db.refresh(evidence)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create analysis job")
        
    # Start background task for inference
    background_tasks.add_task(process_analysis_job, job.id, evidence.id, evidence.storage_key)
    
    return {"message": "Analysis queued", "evidence_id": evidence.id, "job_id": job.id}

@router.get("/evidence/{evidence_id}/download")
async def download_evidence_direct(
    evidence_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(EvidenceItem).join(Investigation).where(
        EvidenceItem.id == evidence_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    evidence = result.scalar_one_or_none()
    
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    storage = get_storage_provider()
    try:
        content = await storage.get_file(evidence.storage_key)
        return Response(
            content=content, 
            media_type=evidence.mime_type or "image/jpeg",
            headers={"Cache-Control": "private, max-age=86400"}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="File not found on storage")

@router.get("/{investigation_id}/evidence/{evidence_id}/download")
async def download_evidence(
    investigation_id: str,
    evidence_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(EvidenceItem).join(Investigation).where(
        EvidenceItem.id == evidence_id,
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    evidence = result.scalar_one_or_none()
    
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    storage = get_storage_provider()
    try:
        content = await storage.get_file(evidence.storage_key)
        return Response(
            content=content, 
            media_type=evidence.mime_type or "image/jpeg",
            headers={"Cache-Control": "private, max-age=86400"}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="File not found on storage")

@router.get("/{investigation_id}/evidence/{evidence_id}/heatmap")
async def download_heatmap(
    investigation_id: str,
    evidence_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(EvidenceItem).join(Investigation).options(
        selectinload(EvidenceItem.analysis_results)
    ).where(
        EvidenceItem.id == evidence_id,
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    evidence = result.scalar_one_or_none()
    
    if not evidence or not evidence.analysis_results:
        raise HTTPException(status_code=404, detail="Heatmap not found")
        
    heatmap_uri = evidence.analysis_results[0].ai_explanation
    if not heatmap_uri:
        raise HTTPException(status_code=404, detail="Heatmap not generated")
        
    storage = get_storage_provider()
    try:
        content = await storage.get_file(heatmap_uri)
        return Response(content=content, media_type="image/png")
    except Exception:
        raise HTTPException(status_code=404, detail="File not found on storage")

@router.get("/{investigation_id}/evidence/{evidence_id}/spectrum")
async def download_spectrum(
    investigation_id: str,
    evidence_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = select(EvidenceItem).join(Investigation).where(
        EvidenceItem.id == evidence_id,
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
        
    storage = get_storage_provider()
    try:
        content = await storage.get_file(evidence.storage_key)
        from PIL import Image
        import numpy as np
        import matplotlib.pyplot as plt
        
        with Image.open(io.BytesIO(content)) as pil_img:
            gray = pil_img.convert("L").resize((256, 256))
            arr = np.array(gray, dtype=np.float32)
            f = np.fft.fft2(arr)
            fshift = np.fft.fftshift(f)
            magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-9)
            norm = (magnitude_spectrum - magnitude_spectrum.min()) / (magnitude_spectrum.max() - magnitude_spectrum.min() + 1e-9)
            cm = plt.get_cmap("viridis")
            colored = (cm(norm)[:, :, :3] * 255).astype(np.uint8)
            spec_img = Image.fromarray(colored)
            buf = io.BytesIO()
            spec_img.save(buf, format="PNG")
            return Response(content=buf.getvalue(), media_type="image/png")
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to generate Fourier spectrum")


@router.post("/{investigation_id}/evidence/{evidence_id}/assistant")
async def query_evidence_assistant(
    investigation_id: str,
    evidence_id: str,
    query_in: Optional[AssistantQueryRequest] = None,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Verify ownership and load full structured evidence context
    stmt = select(Investigation).options(
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.jobs),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.signals),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.observations),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.analysis_results).selectinload(AnalysisResult.policy)
    ).where(
        Investigation.id == investigation_id,
        Investigation.user_id == current_user.id
    )
    result = await db.execute(stmt)
    investigation = result.scalar_one_or_none()
    
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")
        
    evidence = next((e for e in investigation.evidence_items if e.id == evidence_id), None)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found in this investigation")
        
    context = {
        "investigation": {
            "id": investigation.id,
            "title": investigation.title,
            "status": investigation.status
        },
        "investigator_notes": investigation.notes,
        "evidence": {
            "id": evidence.id,
            "file_hash": evidence.file_hash,
            "mime_type": evidence.mime_type,
            "created_at": evidence.created_at.isoformat() if evidence.created_at else None
        },
        "jobs": [
            {
                "id": j.id,
                "status": j.status,
                "error_message": j.error_message
            } for j in evidence.jobs
        ],
        "observations": [
            {
                "signal_type": o.signal_type,
                "value": o.value,
                "representation": o.representation,
                "provenance": o.provenance
            } for o in evidence.observations
        ],
        "signals": [
            {
                "signal_type": s.signal_type,
                "value": s.value,
                "confidence_semantics": s.confidence_semantics,
                "model_id": s.model_id,
                "model_version": s.model_version,
                "provenance": s.provenance
            } for s in evidence.signals
        ],
        "analysis_results": [
            {
                "verdict": r.verdict,
                "ensemble_score": r.ensemble_score,
                "policy_version": r.policy.version if r.policy else "Unknown",
                "ai_explanation": bool(r.ai_explanation)
            } for r in evidence.analysis_results
        ]
    }
    
    question = query_in.question if query_in else None
    google_api_key = query_in.google_api_key if query_in else None
    gemini_model = query_in.gemini_model if query_in else None
    
    async def sse_event_stream():
        try:
            # Emit provider metadata as the first event so the UI
            # can distinguish Gemini-generated from offline synthesis.
            provider_label = _resolve_provider_label(google_api_key)
            yield f"data: {json.dumps({'provider': provider_label})}\n\n"
            async for chunk in stream_assistant_response(
                context, 
                question=question, 
                google_api_key=google_api_key, 
                gemini_model=gemini_model
            ):
                if "*[Notice: " in chunk and "Falling back to DeepVerify offline scientific engine" in chunk:
                    yield f"data: {json.dumps({'provider': 'offline-fallback', 'fallback': True})}\n\n"
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            # Never leak internal error details to the client.
            safe_msg = f"Assistant stream error: {type(e).__name__}"
            yield f"data: {json.dumps({'error': safe_msg})}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/assistant/validate-key", response_model=KeyValidationResponse)
async def check_api_key(
    req: KeyValidationRequest,
    current_user: User = Depends(deps.get_current_user)
):
    valid, model, message = await validate_google_api_key(req.google_api_key, req.gemini_model)
    return KeyValidationResponse(valid=valid, model=model, message=message)

@router.get("/{id}/report")
async def export_investigation_report(
    id: str,
    evidence_id: Optional[str] = None,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Generates an authoritative, tamper-evident Forensic PDF Report
    built directly from persisted database ledger records.
    """
    stmt = select(Investigation).options(
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.analysis_results).selectinload(AnalysisResult.policy),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.signals),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.observations),
        selectinload(Investigation.evidence_items).selectinload(EvidenceItem.jobs)
    ).where(Investigation.id == id)
    result = await db.execute(stmt)
    investigation = result.scalar_one_or_none()
    
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found"
        )
        
    if investigation.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Investigation not found"
        )
        
    if evidence_id:
        ev = next((e for e in investigation.evidence_items if e.id == evidence_id), None)
        if not ev:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evidence item not found in this investigation"
            )

    pdf_bytes = await generate_pdf_report(
        investigation=investigation,
        investigator_email=current_user.email,
        evidence_id_filter=evidence_id
    )

    raw_title = str(investigation.title or "Untitled")
    clean_title = (re.sub(r'[^a-zA-Z0-9_\-]', '_', raw_title)[:20]).strip('_') or 'Case'
    suffix = f"_{evidence_id[:8]}" if evidence_id else ""
    filename = f"DeepVerify_Report_{clean_title}_{id[:8]}{suffix}.pdf"
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
            "Content-Length": str(len(pdf_bytes))
        }
    )




