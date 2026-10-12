from fastapi import FastAPI
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio

from app.api.v1.router import api_router as api_router_v1
from app.api.v2.router import api_router as api_router_v2
from app.services import inference
from app.services import v2_pipeline
from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.services.model_registry import ModelRegistryService
from datetime import datetime, timezone
from sqlalchemy import update
from app.db.models import AnalysisJob

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed V2 Models
    async with AsyncSessionLocal() as session:
        await ModelRegistryService.seed_initial_models(session)
        
        # Reconcile lost jobs from previous crash
        stmt = update(AnalysisJob).where(
            AnalysisJob.status.in_(["QUEUED", "RUNNING"])
        ).values(
            status="FAILED",
            error_message="Job interrupted by server crash/restart.",
            completed_at=datetime.now(timezone.utc)
        )
        await session.execute(stmt)
        await session.commit()

    # Load ML models on startup
    await asyncio.to_thread(inference.load_models)
    await asyncio.to_thread(v2_pipeline.load_v2_adapters)
    yield
    # Cleanup on shutdown
    pass

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

if settings.BACKEND_CORS_ORIGINS:
    if "*" in settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origin_regex=r".*",
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.BACKEND_CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

# Health endpoint (root)
@app.get("/health")
async def health_root():
    return {"status": "ok"}

# Versioned Health endpoint
@app.get(f"{settings.API_V1_STR}/health")
async def health_v1():
    if inference.models_loaded:
        return {
            "status": "ok",
            "api_version": "v1",
            "model_loaded": True,
            "model_version": "ensemble-v1.0"
        }
    else:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "api_version": "v1",
                "model_loaded": False,
                "model_version": None,
                "detail": "Model is not available."
            }
        )

# Exception handler for Custom HTTPExceptions
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

app.include_router(api_router_v1, prefix=settings.API_V1_STR)
app.include_router(api_router_v2, prefix=settings.API_V2_STR)
