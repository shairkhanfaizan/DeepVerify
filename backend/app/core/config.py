from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "DeepVerify Backend"

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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()

# Ensure temp dir exists
Path(settings.TEMP_DIR).mkdir(parents=True, exist_ok=True)
