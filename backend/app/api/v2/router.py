from fastapi import APIRouter
from app.api.v2.endpoints import auth, investigations

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(investigations.router, prefix="/investigations", tags=["investigations"])
