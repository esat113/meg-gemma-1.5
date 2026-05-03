import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from config import Settings, get_settings
from database import get_db
from models.db_models import Analysis, FollowUpAnswerRecord, Patient, UploadedFile
from models.schemas import (
    AnalysisReport,
    AnalysisRequest,
    AnalysisResponse,
    CompleteRequest,
    FollowUpQuestion,
    PatientProfile,
)
from services.emergency import check_emergency
from services.prompt_builder import build_final_messages, build_phase1_messages

router = APIRouter(prefix="/api", tags=["analysis"])


def _create_or_update_patient(db: Session, profile: PatientProfile) -> Patient:
    patient: Patient | None = None
    if profile.patient_number:
        patient = db.execute(select(Patient).where(Patient.patient_number == profile.patient_number)).scalar_one_or_none()

    if patient is None:
        patient = Patient()
        db.add(patient)

    patient.patient_number = profile.patient_number
    patient.full_name = profile.full_name
    patient.phone = profile.phone
    patient.email = str(profile.email) if profile.email else None
    patient.birth_date = profile.birth_date
    patient.age = profile.age
    patient.gender = profile.gender
    patient.height_cm = profile.height_cm
    patient.weight_kg = profile.weight_kg
    patient.notes = profile.notes
    db.commit()
    db.refresh(patient)
    return patient


def _files_for_analysis(db: Session, file_ids: list[str], settings: Settings) -> list[UploadedFile]:
    if len(file_ids) > settings.max_files_per_analysis:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.max_files_per_analysis} files are allowed")
    if not file_ids:
        return []

    records = list(db.execute(select(UploadedFile).where(UploadedFile.id.in_(file_ids))).scalars().all())
    found_ids = {record.id for record in records}
    missing = [file_id for file_id in file_ids if file_id not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Uploaded file(s) not found: {', '.join(missing)}")
    return records


def _file_payload(records: list[UploadedFile], settings: Settings) -> tuple[list[str], list[str]]:
    extracted_texts: list[str] = []
    image_paths: list[str] = []
    for record in records:
        if record.extracted_text:
            extracted_texts.append(f"DOSYA: {record.original_filename}\n{record.extracted_text}")
        elif record.file_type == "pdf":
            extracted_texts.append(f"DOSYA: {record.original_filename}\nMetin çıkarılamadı; taranmış PDF olabilir.")

        if record.file_type == "image":
            image_path = os.path.join(settings.upload_dir, record.stored_filename)
            if os.path.exists(image_path):
                image_paths.append(image_path)
    return extracted_texts, image_paths


def _normalize_phase1(data: dict[str, Any], rule_emergency: tuple[bool, str | None]) -> dict[str, Any]:
    if "raw_text" in data:
        data = {
            "initial_assessment": data["raw_text"],
            "follow_up_questions": [
                {
                    "id": "q1",
                    "question": "Belirtilerinizde son saatlerde belirgin kötüleşme oldu mu?",
                    "options": ["Evet", "Hayır", "Emin değilim / Bilmiyorum"],
                    "clinical_rationale": "Klinik gidişi netleştirmek için.",
                }
            ],
            "is_emergency": False,
            "emergency_message": None,
        }

    is_rule_emergency, rule_message = rule_emergency
    data.setdefault("initial_assessment", "İlk değerlendirme üretildi.")
    data.setdefault("follow_up_questions", [])
    data["follow_up_questions"] = data["follow_up_questions"][:5]
    data["is_emergency"] = bool(data.get("is_emergency")) or is_rule_emergency
    data["emergency_message"] = data.get("emergency_message") or rule_message
    return data


def _normalize_final(data: dict[str, Any], emergency: tuple[bool, str | None]) -> dict[str, Any]:
    if "raw_text" in data:
        data = {
            "summary": data["raw_text"],
            "possible_conditions": [],
            "recommendations": {
                "lifestyle": [],
                "diet": [],
                "monitoring": ["Belirtileri takip edin ve kötüleşme olursa sağlık profesyoneline başvurun."],
                "when_to_seek_care": "Kırmızı bayrak belirtileri veya hızlı kötüleşme varsa acil değerlendirme alın.",
            },
            "is_emergency": False,
            "emergency_message": None,
            "disclaimer": "Bu analiz yapay zeka tarafından üretilmiştir ve tıbbi teşhis yerine geçmez. Bir sağlık profesyoneline danışınız.",
        }

    is_rule_emergency, rule_message = emergency
    data.setdefault("summary", "Final değerlendirme üretildi.")
    data.setdefault("possible_conditions", [])
    data.setdefault(
        "recommendations",
        {
            "lifestyle": [],
            "diet": [],
            "monitoring": [],
            "when_to_seek_care": "Sağlık profesyoneline danışınız.",
        },
    )
    data.setdefault(
        "disclaimer",
        "Bu analiz yapay zeka tarafından üretilmiştir ve tıbbi teşhis yerine geçmez. Bir sağlık profesyoneline danışınız.",
    )
    data["is_emergency"] = bool(data.get("is_emergency")) or is_rule_emergency
    data["emergency_message"] = data.get("emergency_message") or rule_message
    return data


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    payload: AnalysisRequest,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AnalysisResponse:
    service = request.app.state.medgemma
    if not service.loaded:
        raise HTTPException(status_code=503, detail=service.error or "Model is not loaded")

    files = _files_for_analysis(db, payload.file_ids, settings)
    patient = _create_or_update_patient(db, payload.patient_profile)
    rule_emergency = check_emergency(payload.medical_data)
    extracted_texts, image_paths = _file_payload(files, settings)
    messages = build_phase1_messages(payload.patient_profile, payload.medical_data, extracted_texts, image_paths)

    try:
        phase1 = _normalize_phase1(await service.generate_phase1(messages), rule_emergency)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model inference failed: {exc}") from exc

    analysis = Analysis(
        patient_id=patient.id,
        anamnesis={
            "patient_profile": payload.patient_profile.model_dump(mode="json"),
            "medical_data": payload.medical_data.model_dump(mode="json"),
            "extra_notes": payload.extra_notes,
        },
        phase1_response=phase1,
        is_emergency=phase1["is_emergency"],
        emergency_message=phase1.get("emergency_message"),
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    for file_record in files:
        file_record.analysis_id = analysis.id
    db.commit()

    questions = [FollowUpQuestion(**question) for question in phase1.get("follow_up_questions", [])]
    return AnalysisResponse(
        session_id=analysis.id,
        initial_assessment=phase1["initial_assessment"],
        follow_up_questions=questions,
        is_emergency=phase1["is_emergency"],
        emergency_message=phase1.get("emergency_message"),
    )


@router.post("/complete", response_model=AnalysisReport)
async def complete(
    payload: CompleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AnalysisReport:
    service = request.app.state.medgemma
    if not service.loaded:
        raise HTTPException(status_code=503, detail=service.error or "Model is not loaded")

    analysis = db.execute(
        select(Analysis)
        .where(Analysis.id == payload.session_id)
        .options(selectinload(Analysis.patient), selectinload(Analysis.files))
    ).scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    profile = PatientProfile(**analysis.anamnesis["patient_profile"])
    medical_data = analysis.anamnesis["medical_data"]
    from models.schemas import MedicalHistory

    history = MedicalHistory(**medical_data)
    extracted_texts, image_paths = _file_payload(analysis.files, settings)
    messages = build_final_messages(
        profile,
        history,
        extracted_texts,
        image_paths,
        analysis.phase1_response or {},
        payload.answers,
    )

    rule_emergency = check_emergency(history)
    try:
        final_report = _normalize_final(await service.generate_final(messages), rule_emergency)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model inference failed: {exc}") from exc

    question_map = {
        question.get("id"): question.get("question", question.get("id", ""))
        for question in (analysis.phase1_response or {}).get("follow_up_questions", [])
    }
    for answer in payload.answers:
        db.add(
            FollowUpAnswerRecord(
                analysis_id=analysis.id,
                question_id=answer.question_id,
                question_text=question_map.get(answer.question_id, answer.question_id),
                selected_option=answer.selected_option,
            )
        )

    analysis.final_report = final_report
    analysis.is_emergency = final_report["is_emergency"]
    analysis.emergency_message = final_report.get("emergency_message")
    db.commit()

    return AnalysisReport(**final_report)
