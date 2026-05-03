from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models.db_models import Patient
from models.schemas import PatientProfile


def create_or_update_patient(db: Session, profile: PatientProfile) -> Patient:
    patient: Patient | None = None
    if profile.patient_number:
        patient = db.execute(select(Patient).where(Patient.patient_number == profile.patient_number)).scalar_one_or_none()
    if patient is None and profile.full_name:
        normalized_name = profile.full_name.strip().lower()
        patient = db.execute(
            select(Patient).where(func.lower(func.trim(Patient.full_name)) == normalized_name).order_by(Patient.created_at.desc())
        ).scalars().first()

    if patient is None:
        patient = Patient()
        db.add(patient)

    patient.patient_number = profile.patient_number or patient.patient_number
    patient.full_name = profile.full_name or patient.full_name
    patient.phone = profile.phone or patient.phone
    patient.email = str(profile.email) if profile.email else patient.email
    patient.birth_date = profile.birth_date or patient.birth_date
    patient.age = profile.age
    patient.gender = profile.gender
    patient.height_cm = profile.height_cm or patient.height_cm
    patient.weight_kg = profile.weight_kg or patient.weight_kg
    patient.notes = profile.notes or patient.notes
    db.commit()
    db.refresh(patient)
    return patient
