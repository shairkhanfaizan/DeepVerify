from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from pathlib import Path
from typing import Optional

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    API_V2_STR: str = "/api/v2"
    PROJECT_NAME: str = "DeepVerify Backend"
    DATABASE_URL: str = "postgresql+asyncpg://deepverify:deepverify_password@localhost:5432/deepverify_v2"
    
    # Auth & Security
    SECRET_KEY: str = "supersecretkey_please_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 hours
    ENVIRONMENT: str = "development"
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Model Loading
    EXP001_SPATIAL_CONFIG_PATH: str = "experiments/configs/EXP-001.yaml"
    EXP001_SPATIAL_WEIGHTS_PATH: Optional[str] = None
    EXP002_FREQUENCY_CONFIG_PATH: str = "experiments/configs/EXP-002.yaml"
    EXP002_FREQUENCY_WEIGHTS_PATH: Optional[str] = None

    # Validation Limits
    MAX_IMAGE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_IMAGE_RESOLUTION: int = 4096

    # Temp storage
    TEMP_DIR: str = "tmp"

    # AI Assistant & Grounding
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"
    ASSISTANT_PROVIDER: str = "auto" # "auto", "google", "openai", "anthropic", "offline"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @model_validator(mode="after")
    def validate_production_secret(self) -> 'Settings':
        # Auto-resolve paths
        def _resolve(p: Optional[str]) -> Optional[str]:
            if not p:
                return None
            path = Path(p)
            if path.is_absolute() and path.exists():
                return str(path)
            if path.exists():
                return str(path.resolve())
            backend_dir = Path(__file__).resolve().parent.parent.parent
            repo_dir = backend_dir.parent
            for base in [backend_dir, repo_dir]:
                if (base / p).exists():
                    return str((base / p).resolve())
                cleaned = p.lstrip("./")
                if (base / cleaned).exists():
                    return str((base / cleaned).resolve())
            return str(path)

        if self.EXP001_SPATIAL_CONFIG_PATH:
            self.EXP001_SPATIAL_CONFIG_PATH = _resolve(self.EXP001_SPATIAL_CONFIG_PATH) or self.EXP001_SPATIAL_CONFIG_PATH
        if self.EXP002_FREQUENCY_CONFIG_PATH:
            self.EXP002_FREQUENCY_CONFIG_PATH = _resolve(self.EXP002_FREQUENCY_CONFIG_PATH) or self.EXP002_FREQUENCY_CONFIG_PATH
        if self.EXP001_SPATIAL_WEIGHTS_PATH:
            self.EXP001_SPATIAL_WEIGHTS_PATH = _resolve(self.EXP001_SPATIAL_WEIGHTS_PATH) or self.EXP001_SPATIAL_WEIGHTS_PATH
        if self.EXP002_FREQUENCY_WEIGHTS_PATH:
            self.EXP002_FREQUENCY_WEIGHTS_PATH = _resolve(self.EXP002_FREQUENCY_WEIGHTS_PATH) or self.EXP002_FREQUENCY_WEIGHTS_PATH

        if self.ENVIRONMENT == "production":
            default_secret = "supersecretkey_please_change_in_production"
            if not self.SECRET_KEY or self.SECRET_KEY == default_secret:
                raise ValueError("In production, SECRET_KEY must be overridden and cannot be the default development secret.")
            if len(self.SECRET_KEY) < 32:
                raise ValueError("In production, SECRET_KEY must be at least 32 characters long.")
        return self

settings = Settings()

# Ensure temp dir exists
Path(settings.TEMP_DIR).mkdir(parents=True, exist_ok=True)
