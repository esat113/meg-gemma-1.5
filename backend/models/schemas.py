from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class PatientProfile(BaseModel):
    patient_number: str | None = None
    full_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    birth_date: date | None = None
    age: int = Field(ge=0, le=120)
    gender: str
    height_cm: float | None = Field(default=None, ge=30, le=260)
    weight_kg: float | None = Field(default=None, ge=1, le=400)
    notes: str | None = None


class MedicationItem(BaseModel):
    name: str
    dose: str | None = None
    frequency: str | None = None


class MedicalHistory(BaseModel):
    chief_complaint: str = Field(min_length=3)
    complaint_start_date: date | None = None
    complaint_duration: str
    severity: int = Field(ge=1, le=10)
    symptoms: list[str] = Field(default_factory=list)
    chronic_diseases: list[str] = Field(default_factory=list)
    past_surgeries: str | None = None
    family_history: str | None = None
    allergies: list[str] = Field(default_factory=list)
    current_medications: list[MedicationItem] = Field(default_factory=list)
    uses_supplements: bool = False
    smoking: str
    alcohol: str
    physical_activity: str
    extra_notes: str | None = None


class FollowUpQuestion(BaseModel):
    id: str
    question: str
    options: list[str]
    clinical_rationale: str | None = None

    @field_validator("options")
    @classmethod
    def ensure_unknown_option(cls, options: list[str]) -> list[str]:
        if not any(option.lower() in {"emin değilim / bilmiyorum", "i don't know"} for option in options):
            return [*options, "Emin değilim / Bilmiyorum"]
        return options


class UploadedFileResponse(BaseModel):
    file_id: str
    type: str
    filename: str
    mime_type: str
    size_bytes: int
    extracted_text: str | None = None
    preview_url: str | None = None


class UploadResponse(BaseModel):
    files: list[UploadedFileResponse]


class AnalysisRequest(BaseModel):
    patient_profile: PatientProfile
    medical_data: MedicalHistory
    file_ids: list[str] = Field(default_factory=list)
    extra_notes: str | None = None


class AnalysisResponse(BaseModel):
    session_id: str
    initial_assessment: str
    follow_up_questions: list[FollowUpQuestion]
    is_emergency: bool = False
    emergency_message: str | None = None


class FollowUpAnswer(BaseModel):
    question_id: str
    selected_option: str


class CompleteRequest(BaseModel):
    session_id: str
    answers: list[FollowUpAnswer]


class PossibleCondition(BaseModel):
    name: str
    likelihood: Literal["high", "medium", "low"] | str
    explanation: str


class Recommendations(BaseModel):
    lifestyle: list[str] = Field(default_factory=list)
    diet: list[str] = Field(default_factory=list)
    monitoring: list[str] = Field(default_factory=list)
    when_to_seek_care: str


class AnalysisReport(BaseModel):
    summary: str
    possible_conditions: list[PossibleCondition] = Field(default_factory=list)
    recommendations: Recommendations
    is_emergency: bool = False
    emergency_message: str | None = None
    disclaimer: str


class PatientSummary(BaseModel):
    id: str
    patient_number: str | None = None
    full_name: str | None = None
    phone: str | None = None
    email: str | None = None
    age: int | None = None
    gender: str | None = None
    created_at: datetime
    analysis_count: int


class PatientDetail(BaseModel):
    id: str
    patient_number: str | None = None
    full_name: str | None = None
    phone: str | None = None
    email: str | None = None
    birth_date: date | None = None
    age: int | None = None
    gender: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    notes: str | None = None
    created_at: datetime
    analyses: list[dict[str, Any]]


class HealthResponse(BaseModel):
    status: str
    mock_model: bool
    model_id: str
    model_loaded: bool
    gpu_available: bool
    gpu_name: str | None = None
    cuda_device_count: int = 0
    error: str | None = None
