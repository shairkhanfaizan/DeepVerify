from fastapi import FastAPI
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio

from app.api.v1.router import api_router
from app.services import inference
from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load ML models on startup
    # We use a thread to not block event loop during startup, though startup blocks anyway
    await asyncio.to_thread(inference.load_models)
    yield
    # Cleanup on shutdown
    pass

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

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

app.include_router(api_router, prefix=settings.API_V1_STR)
