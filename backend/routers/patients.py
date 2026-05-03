from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models.db_models import Analysis, Patient
from models.schemas import PatientDetail, PatientSummary, SavedProfileResponse, SaveProfileRequest
from services.patient_store import create_or_update_patient

router = APIRouter(prefix="/api", tags=["patients"])


@router.post("/patients/save-profile", response_model=SavedProfileResponse)
def save_patient_profile(payload: SaveProfileRequest, db: Session = Depends(get_db)) -> SavedProfileResponse:
    patient = create_or_update_patient(db, payload.patient_profile)
    draft = None
    if _has_medical_draft(payload):
        draft = _get_patient_draft(db, patient.id) or Analysis(patient_id=patient.id)
        draft.anamnesis = {
            "patient_profile": payload.patient_profile.model_dump(mode="json"),
            "medical_data": payload.medical_data.model_dump(mode="json"),
            "static_question_answers": [
                answer.model_dump(mode="json")
                for answer in payload.static_question_answers
                if answer.answer.strip()
            ],
            "extra_notes": payload.extra_notes,
            "draft": True,
        }
        draft.phase1_response = None
        draft.final_report = None
        draft.is_emergency = False
        draft.emergency_message = None
        db.add(draft)
        db.commit()
        db.refresh(draft)

    return SavedProfileResponse(
        patient_id=patient.id,
        analysis_id=draft.id if draft else None,
        message="Profil kaydedildi." if draft is None else "Profil ve anamnez taslağı kaydedildi.",
    )


@router.get("/patients", response_model=list[PatientSummary])
def list_patients(db: Session = Depends(get_db)) -> list[PatientSummary]:
    patients = db.execute(select(Patient).options(selectinload(Patient.analyses))).scalars().all()
    summaries = []
    for patient in patients:
        real_analyses = _real_analyses(patient.analyses)
        latest_analysis = real_analyses[0] if real_analyses else None
        summaries.append(
            PatientSummary(
                id=patient.id,
                patient_number=patient.patient_number,
                full_name=patient.full_name,
                phone=patient.phone,
                email=patient.email,
                age=patient.age,
                gender=patient.gender,
                created_at=patient.created_at,
                analysis_count=len(real_analyses),
                latest_complaint=(
                    latest_analysis.anamnesis.get("medical_data", {}).get("chief_complaint")
                    if latest_analysis
                    else None
                ),
                latest_analysis_at=latest_analysis.created_at if latest_analysis else None,
            )
        )
    return sorted(summaries, key=lambda item: item.latest_analysis_at or item.created_at, reverse=True)


@router.get("/patients/{patient_id}", response_model=PatientDetail)
def get_patient(patient_id: str, db: Session = Depends(get_db)) -> PatientDetail:
    patient = db.execute(
        select(Patient).where(Patient.id == patient_id).options(selectinload(Patient.analyses))
    ).scalar_one_or_none()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    analyses = [
        {
            "id": analysis.id,
            "created_at": analysis.created_at.isoformat(),
            "is_emergency": analysis.is_emergency,
            "emergency_message": analysis.emergency_message,
            "anamnesis": analysis.anamnesis,
            "phase1_response": analysis.phase1_response,
            "final_report": analysis.final_report,
        }
        for analysis in _real_analyses(patient.analyses)
    ]

    return PatientDetail(
        id=patient.id,
        patient_number=patient.patient_number,
        full_name=patient.full_name,
        phone=patient.phone,
        email=patient.email,
        birth_date=patient.birth_date,
        age=patient.age,
        gender=patient.gender,
        height_cm=patient.height_cm,
        weight_kg=patient.weight_kg,
        notes=patient.notes,
        created_at=patient.created_at,
        analyses=analyses,
    )


def _is_draft_analysis(analysis: Analysis) -> bool:
    return bool((analysis.anamnesis or {}).get("draft")) and analysis.phase1_response is None and analysis.final_report is None


def _real_analyses(analyses: list[Analysis]) -> list[Analysis]:
    return sorted((analysis for analysis in analyses if not _is_draft_analysis(analysis)), key=lambda item: item.created_at, reverse=True)


def _get_patient_draft(db: Session, patient_id: str) -> Analysis | None:
    drafts = db.execute(
        select(Analysis)
        .where(Analysis.patient_id == patient_id)
        .order_by(Analysis.created_at.desc())
    ).scalars()
    return next((analysis for analysis in drafts if _is_draft_analysis(analysis)), None)


def _has_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _has_medical_draft(payload: SaveProfileRequest) -> bool:
    medical = payload.medical_data
    medications = [item for item in medical.current_medications if _has_text(item.name)]
    return any(
        [
            _has_text(medical.chief_complaint),
            _has_text(medical.past_surgeries),
            _has_text(medical.family_history),
            _has_text(medical.extra_notes),
            _has_text(payload.extra_notes),
            bool(medical.symptoms),
            bool(medical.chronic_diseases),
            bool(medical.allergies),
            bool(medications),
            any(answer.answer.strip() for answer in payload.static_question_answers),
        ]
    )
