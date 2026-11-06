import os
from pathlib import Path
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    ALLOWED_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    DATABASE_URL: str = "sqlite+aiosqlite:///./cctv_surveillance.db"

    # Storage paths relative to backend directory or absolute
    STORAGE_ROOT: str = "../storage"
    UPLOAD_DIR: str = "../storage/uploads"
    INCIDENT_DIR: str = "../storage/incidents"
    MODEL_DIR: str = "../storage/models"

    # Detection & Processing Defaults
    SAMPLING_RATE_FPS: int = 5
    CONFIDENCE_THRESHOLD: float = 0.25
    WEAPON_MODEL_NAME: str = "yolov8n_weapon.pt"
    WEAPON_CONFIDENCE_THRESHOLD: float = 0.35
    WEAPON_CONSECUTIVE_FRAMES: int = 2
    EVENT_COOLDOWN_SECONDS: int = 10
    MAX_UPLOAD_SIZE_MB: int = 500

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def resolved_database_url(self) -> str:
        if "sqlite" in self.DATABASE_URL and ("./" in self.DATABASE_URL or self.DATABASE_URL.endswith("cctv_surveillance.db")):
            base = Path(__file__).resolve().parent.parent.parent
            db_path = (base / "cctv_surveillance.db").resolve()
            return f"sqlite+aiosqlite:///{db_path.as_posix()}"
        return self.DATABASE_URL

    @property
    def resolved_upload_dir(self) -> Path:
        base = Path(__file__).resolve().parent.parent.parent
        path = (base / self.UPLOAD_DIR).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_incident_dir(self) -> Path:
        base = Path(__file__).resolve().parent.parent.parent
        path = (base / self.INCIDENT_DIR).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_model_dir(self) -> Path:
        base = Path(__file__).resolve().parent.parent.parent
        path = (base / self.MODEL_DIR).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
