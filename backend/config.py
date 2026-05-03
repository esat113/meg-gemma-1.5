from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "MedGemma Anamnez API"
    hf_token: str | None = Field(default=None, alias="HF_TOKEN")
    model_id: str = Field(default="google/medgemma-1.5-4b-it", alias="MODEL_ID")
    local_model_path: str | None = Field(default=None, alias="LOCAL_MODEL_PATH")
    mock_model: bool = Field(default=False, alias="MOCK_MODEL")
    upload_dir: str = Field(default="/app/uploads", alias="UPLOAD_DIR")
    database_url: str = Field(
        default="postgresql+psycopg://medgemma:medgemma@postgres:5432/medgemma",
        alias="DATABASE_URL",
    )
    clinical_rules_path: str = Field(default="/app/prompts/clinical_rules.md", alias="CLINICAL_RULES_PATH")
    anamnesis_questions_path: str = Field(default="/app/prompts/anamnesis_questions.json", alias="ANAMNESIS_QUESTIONS_PATH")
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    max_files_per_analysis: int = Field(default=5, alias="MAX_FILES_PER_ANALYSIS")
    max_upload_mb: int = Field(default=10, alias="MAX_UPLOAD_MB")
    phase1_max_new_tokens: int = Field(default=8192, alias="PHASE1_MAX_NEW_TOKENS")
    final_max_new_tokens: int = Field(default=12288, alias="FINAL_MAX_NEW_TOKENS")

    @property
    def allowed_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
