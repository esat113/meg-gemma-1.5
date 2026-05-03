from fastapi import APIRouter, HTTPException

from models.schemas import AnamnesisQuestionBank
from services.anamnesis_questions import QuestionBankError, get_anamnesis_question_bank

router = APIRouter(prefix="/api/anamnesis", tags=["anamnesis"])


@router.get("/questions", response_model=AnamnesisQuestionBank)
def get_questions() -> AnamnesisQuestionBank:
    try:
        return get_anamnesis_question_bank()
    except QuestionBankError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
