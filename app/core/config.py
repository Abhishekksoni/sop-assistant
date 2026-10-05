from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    PROJECT_NAME: str = "FastAPI LangChain & Supabase Vector Service"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # JWT & Authentication Settings
    JWT_SECRET_KEY: str = "a_super_secret_jwt_key_for_sop_system_2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Master Admin Default Credentials
    MASTER_ADMIN_EMAIL: str = "abhishekad152003@gmail.com"
    MASTER_ADMIN_PASSWORD: str = "123456"

    # Google Gemini Settings
    GOOGLE_API_KEY: Optional[str] = None
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIMENSION: int = 768

    # Supabase Vector Store & Storage Settings
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_TABLE_NAME: str = "documents"
    SUPABASE_QUERY_NAME: str = "match_documents"
    SUPABASE_STORAGE_BUCKET: str = "sop-bucket"

    # Server & Storage Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    UPLOAD_DIR: str = "uploads"


settings = Settings()
