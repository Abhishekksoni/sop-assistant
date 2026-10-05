from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.documents import router as documents_router
from app.api.v1.endpoints import router as endpoints_router

api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["User & Access Management (Admin)"])
api_router.include_router(documents_router, prefix="/documents", tags=["Documents & Vector Search"])
api_router.include_router(endpoints_router, prefix="", tags=["General"])
