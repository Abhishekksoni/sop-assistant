from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.services.user_service import user_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure Master Admin exists in Supabase
    try:
        user_service.ensure_master_admin_exists()
        print(f"✅ Master Admin '{settings.MASTER_ADMIN_EMAIL}' verified/initialized.")
    except Exception as e:
        print(f"⚠️ Note on Master Admin initialization: {e}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
        "login": f"{settings.API_V1_STR}/auth/login",
    }
