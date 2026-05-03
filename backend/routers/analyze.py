import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
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
from services.prompt_builder import build_final_messages, build_followup_messages, build_phase1_messages
from services.report_parser import clean_model_text, report_from_raw_text

router = APIRouter(prefix="/api", tags=["analysis"])


def _create_or_update_patient(db: Session, profile: PatientProfile) -> Patient:
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


def _question_key(text: str | None) -> str:
    return " ".join((text or "").strip().lower().split())


def _fallback_questions(history: Any, round_number: int, existing_texts: set[str] | None = None) -> list[dict[str, Any]]:
    existing_texts = existing_texts or set()
    base_options = ["Evet", "Hayır", "Emin değilim / Bilmiyorum"]
    if round_number == 1:
        candidates = [
            "Şikayetiniz tam olarak ne zaman başladı ve o günden beri nasıl değişti?",
            "Belirti ataklar halinde mi geliyor, sürekli mi devam ediyor?",
            "Belirtileri başlatan veya artıran belirgin bir durum var mı?",
            "Dinlenmek, pozisyon değiştirmek, yemek yemek veya sıvı almak belirtileri değiştiriyor mu?",
            "Bu şikayete göğüs ağrısı, nefes darlığı, bayılma hissi, baş dönmesi veya terleme eşlik ediyor mu?",
            "Son günlerde ateş, enfeksiyon bulgusu, kusma, ishal veya belirgin sıvı kaybı oldu mu?",
            "Kafein, enerji içeceği, alkol, sigara veya başka madde kullanımı belirtilerle ilişkili olabilir mi?",
            "Yeni başladığınız, bıraktığınız veya dozunu değiştirdiğiniz bir ilaç var mı?",
            "Ailede erken yaşta kalp hastalığı, ani ölüm, ritim bozukluğu veya benzer yakınmalar var mı?",
            "Bu şikayet günlük yaşamınızı, uykunuzu, egzersiz kapasitenizi veya iş/okul performansınızı nasıl etkiliyor?",
        ]
    else:
        candidates = [
            "Önceki cevaplarınızdan sonra en çok endişe ettiğiniz belirti hangisi ve neden?",
            "En son yaşadığınız atağı başlangıç, süre, şiddet ve eşlik eden bulgularla anlatabilir misiniz?",
            "Atak sırasında nabzınızı, tansiyonunuzu, oksijen satürasyonunuzu veya ateşinizi ölçtünüz mü?",
            "Belirtiler egzersizle mi, istirahatte mi, yemek sonrası mı, stresle mi daha belirginleşiyor?",
            "Atak sırasında göğüste baskı, kola/çeneye yayılan ağrı, bayılma veya ciddi nefes darlığı oldu mu?",
            "Yakın zamanda kan tahlili, EKG, ritim takibi, görüntüleme veya doktor değerlendirmesi yapıldı mı?",
            "Benzer şikayeti daha önce yaşadıysanız, önceki ataklardan farkı nedir?",
            "Şu an acil değerlendirme gerektirebileceğini düşündüren hızlı kötüleşme veya yeni belirti var mı?",
        ]

    questions: list[dict[str, Any]] = []
    for index, question in enumerate(candidates, start=1):
        key = _question_key(question)
        if key in existing_texts:
            continue
        questions.append(
            {
                "id": f"{'q' if round_number == 1 else 'r2_q'}fallback_{index}",
                "question": question,
                "options": base_options,
                "clinical_rationale": "Model yeterli sayıda yapılandırılmış soru üretmediğinde güvenli anamnez tamamlama sorusu.",
            }
        )
    return questions


def _dedupe_and_complete_questions(data: dict[str, Any], history: Any, round_number: int, existing_texts: set[str] | None = None) -> None:
    seen = set(existing_texts or set())
    questions = []
    for index, question in enumerate(data.get("follow_up_questions", []) or []):
        text = question.get("question") if isinstance(question, dict) else None
        key = _question_key(text)
        if not key or key in seen:
            continue
        seen.add(key)
        question["id"] = question.get("id") or f"{'q' if round_number == 1 else 'r2_q'}{index + 1}"
        questions.append(question)

    minimum = 6 if round_number == 1 else 4
    if len(questions) < minimum:
        questions.extend(_fallback_questions(history, round_number, seen)[: minimum - len(questions)])

    data["follow_up_questions"] = questions[:20]


def _normalize_phase1(data: dict[str, Any], rule_emergency: tuple[bool, str | None], history: Any | None = None) -> dict[str, Any]:
    if "raw_text" in data:
        clean_text = clean_model_text(data["raw_text"])
        data = {
            "initial_assessment": clean_text[:1200] or "İlk değerlendirme yapılandırılamadı; ek klinik soru ile devam edilebilir.",
            "follow_up_questions": [],
            "is_emergency": False,
            "emergency_message": None,
        }

    is_rule_emergency, rule_message = rule_emergency
    data.setdefault("initial_assessment", "İlk değerlendirme üretildi.")
    data.setdefault("follow_up_questions", [])
    _dedupe_and_complete_questions(data, history, 1)
    data["is_emergency"] = bool(data.get("is_emergency")) or is_rule_emergency
    data["emergency_message"] = data.get("emergency_message") or rule_message
    return data


def _normalize_followup(data: dict[str, Any], rule_emergency: tuple[bool, str | None], history: Any | None = None, existing_texts: set[str] | None = None) -> dict[str, Any]:
    if "raw_text" in data:
        clean_text = clean_model_text(data["raw_text"])
        data = {
            "initial_assessment": clean_text[:1200] or "Ek yanıtlar işlendi; hedefli sorularla devam edilebilir.",
            "follow_up_questions": [],
            "is_emergency": False,
            "emergency_message": None,
        }

    is_rule_emergency, rule_message = rule_emergency
    data.setdefault("initial_assessment", "Ek yanıtlar işlendi.")
    data.setdefault("follow_up_questions", [])
    _dedupe_and_complete_questions(data, history, 2, existing_texts)
    data["is_emergency"] = bool(data.get("is_emergency")) or is_rule_emergency
    data["emergency_message"] = data.get("emergency_message") or rule_message
    return data


def _normalize_final(data: dict[str, Any], emergency: tuple[bool, str | None]) -> dict[str, Any]:
    if "raw_text" in data:
        data = report_from_raw_text(data["raw_text"], emergency)

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
        phase1 = _normalize_phase1(await service.generate_phase1(messages), rule_emergency, payload.medical_data)
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


@router.post("/follow-up", response_model=AnalysisResponse)
async def follow_up(
    payload: CompleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AnalysisResponse:
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
    messages = build_followup_messages(
        profile,
        history,
        extracted_texts,
        image_paths,
        analysis.phase1_response or {},
        payload.answers,
    )

    rule_emergency = check_emergency(history)
    try:
        existing_texts = {
            _question_key(question.get("question"))
            for question in (analysis.phase1_response or {}).get("follow_up_questions", [])
            if question.get("question")
        }
        followup = _normalize_followup(await service.generate_followup(messages), rule_emergency, history, existing_texts)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Model inference failed: {exc}") from exc

    previous = analysis.phase1_response or {}
    rounds = list(previous.get("follow_up_rounds", []))
    rounds.append({"round": 2, "questions": followup.get("follow_up_questions", []), "answers_before_round": [answer.model_dump() for answer in payload.answers]})
    analysis.phase1_response = {
        **previous,
        "follow_up_rounds": rounds,
        "latest_follow_up": followup,
    }
    analysis.is_emergency = bool(analysis.is_emergency) or followup["is_emergency"]
    analysis.emergency_message = analysis.emergency_message or followup.get("emergency_message")
    db.commit()

    questions = [FollowUpQuestion(**question) for question in followup.get("follow_up_questions", [])]
    return AnalysisResponse(
        session_id=analysis.id,
        initial_assessment=followup["initial_assessment"],
        follow_up_questions=questions,
        is_emergency=followup["is_emergency"],
        emergency_message=followup.get("emergency_message"),
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
    for round_data in (analysis.phase1_response or {}).get("follow_up_rounds", []):
        for question in round_data.get("questions", []):
            question_map[question.get("id")] = question.get("question", question.get("id", ""))
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
