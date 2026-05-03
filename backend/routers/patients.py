from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models.db_models import Analysis, Patient
from models.schemas import PatientDetail, PatientSummary

router = APIRouter(prefix="/api", tags=["patients"])


@router.get("/patients", response_model=list[PatientSummary])
def list_patients(db: Session = Depends(get_db)) -> list[PatientSummary]:
    rows = db.execute(
        select(Patient, func.count(Analysis.id), func.max(Analysis.created_at))
        .outerjoin(Analysis)
        .group_by(Patient.id)
        .order_by(func.max(Analysis.created_at).desc().nullslast(), Patient.created_at.desc())
    ).all()

    latest_by_patient = {}
    for analysis in db.execute(select(Analysis).order_by(Analysis.created_at.desc())).scalars():
        latest_by_patient.setdefault(analysis.patient_id, analysis)

    return [
        PatientSummary(
            id=patient.id,
            patient_number=patient.patient_number,
            full_name=patient.full_name,
            phone=patient.phone,
            email=patient.email,
            age=patient.age,
            gender=patient.gender,
            created_at=patient.created_at,
            analysis_count=analysis_count,
            latest_complaint=(
                latest_by_patient.get(patient.id).anamnesis.get("medical_data", {}).get("chief_complaint")
                if latest_by_patient.get(patient.id)
                else None
            ),
            latest_analysis_at=latest_by_patient.get(patient.id).created_at if latest_by_patient.get(patient.id) else None,
        )
        for patient, analysis_count, _latest_analysis_at in rows
    ]


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
        for analysis in sorted(patient.analyses, key=lambda item: item.created_at, reverse=True)
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
