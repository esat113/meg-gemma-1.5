import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from models.schemas import AnamnesisQuestionBank


DEFAULT_QUESTION_BANK = AnamnesisQuestionBank(
    sections=[
        {
            "id": "red_flags",
            "title": "Aciliyet ve Kırmızı Bayraklar",
            "description": "Acil değerlendirme gerektirebilecek bulgular.",
            "questions": [
                {
                    "id": "red_flags_current_danger",
                    "question": "Şu anda kendinizi acil veya tehlikede hissetmenize neden olan bir belirti var mı?",
                    "rationale": "Hastanın subjektif aciliyet algısı triyaj için önemlidir.",
                    "answer_type": "textarea",
                    "placeholder": "Varsa hangi belirti ve neden endişelendirdiğini yazın.",
                    "tags": ["red_flag", "triage"],
                }
            ],
        }
    ]
)


class QuestionBankError(RuntimeError):
    pass


def _question_bank_path() -> str:
    return os.getenv("ANAMNESIS_QUESTIONS_PATH", "/app/prompts/anamnesis_questions.json")


def _resolve_question_bank_path() -> str | None:
    configured_path = _question_bank_path()
    if configured_path and os.path.exists(configured_path):
        return configured_path
    local_path = Path(__file__).resolve().parents[1] / "prompts" / "anamnesis_questions.json"
    if local_path.exists():
        return str(local_path)
    return None


def _normalize_payload(payload: Any) -> AnamnesisQuestionBank:
    try:
        return AnamnesisQuestionBank.model_validate(payload)
    except ValidationError as exc:
        raise QuestionBankError(f"Anamnez soru bankası geçersiz: {exc}") from exc


@lru_cache(maxsize=8)
def _load_question_bank_cached(path: str, mtime: float) -> AnamnesisQuestionBank:
    with open(path, encoding="utf-8") as question_file:
        payload = json.load(question_file)
    return _normalize_payload(payload)


def get_anamnesis_question_bank() -> AnamnesisQuestionBank:
    path = _resolve_question_bank_path()
    if not path:
        return DEFAULT_QUESTION_BANK
    try:
        return _load_question_bank_cached(path, os.path.getmtime(path))
    except json.JSONDecodeError as exc:
        raise QuestionBankError(f"Anamnez soru bankası JSON olarak okunamadı: {exc}") from exc
