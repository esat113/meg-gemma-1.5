# AGENTS.md

This file is the working guide for coding agents in this repository. Keep changes aligned with the existing MVP architecture and avoid broad rewrites unless the user explicitly asks for them.

## Project Purpose

MedGemma Anamnez is a Dockerized clinical history and decision-support MVP intended for physician-supervised use. It does not diagnose, prescribe, start/stop medication, or replace clinical judgment.

Core flow:

1. Patient profile and anamnesis form.
2. Optional static anamnesis question bank.
3. Optional file upload.
4. MedGemma dynamic follow-up questions, up to two rounds.
5. Structured Turkish final report with evidence and disclaimer.

## Stack

- Frontend: React 18, Vite, Tailwind, shadcn-style local UI components, React Hook Form, React Query, Axios.
- Backend: FastAPI, SQLAlchemy, Postgres, PyMuPDF, Pillow, Transformers, PyTorch.
- Model: default `google/medgemma-1.5-4b-it`, loaded inside the backend container.
- Runtime: Docker Compose, optional NVIDIA GPU override.

Services:

- `frontend`: nginx-served production build, host port `3000`.
- `backend`: FastAPI and MedGemma inference, host port `8080`.
- `postgres`: persistent patient, analysis, upload metadata, and follow-up answer storage.

## Important Files

- `frontend/src/App.jsx`: main multi-step application state and API orchestration.
- `frontend/src/components/MedicalForm.jsx`: patient profile, anamnesis, profile save action, static question bank wiring.
- `frontend/src/components/StaticQuestionBank.jsx`: optional editable clinical screening questions UI.
- `frontend/src/components/FollowUpQuestions.jsx`: dynamic MedGemma question rounds and free-text answers.
- `frontend/src/components/AnalysisResult.jsx`: final report rendering and PDF export.
- `frontend/src/lib/api.js`: Axios client and endpoint functions.
- `backend/main.py`: FastAPI app setup, CORS, DB init, model lifecycle, router registration.
- `backend/models/schemas.py`: Pydantic API contracts.
- `backend/models/db_models.py`: SQLAlchemy tables. There is no Alembic migration setup; startup uses `Base.metadata.create_all`.
- `backend/routers/upload.py`: upload ingestion and validation.
- `backend/routers/analyze.py`: analyze, follow-up, complete, normalization and fallback logic.
- `backend/routers/patients.py`: patient profile and analysis history reads/saves.
- `backend/routers/files.py`: controlled file serving. Do not expose the upload folder as a static directory.
- `backend/routers/anamnesis.py`: static question bank endpoint.
- `backend/services/medgemma_service.py`: model load/inference, local model path and Hugging Face fallback.
- `backend/services/prompt_builder.py`: MedGemma messages and report-generation instructions.
- `backend/services/report_parser.py`: JSON/raw model output cleanup and report fallback.
- `backend/services/emergency.py`: rule-based emergency checks.
- `backend/services/file_processor.py`: PDF/image processing.
- `backend/prompts/clinical_rules.md`: editable clinical output rules.
- `backend/prompts/anamnesis_questions.json`: editable static anamnesis question bank.
- `.env.example`: environment variable template.
- `docker-compose.yml` and `docker-compose.gpu.yml`: production-like local/server runtime.

## Run Commands

Mock model smoke test:

```bash
MOCK_MODEL=true docker compose up --build
```

GPU runtime:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Backend tests:

```bash
cd backend
PYTHONPATH=. pytest -q
```

Frontend build:

```bash
cd frontend
npm run build
```

Health check:

```bash
curl http://localhost:8080/api/health
```

Question bank check:

```bash
curl http://localhost:8080/api/anamnesis/questions
```

## Environment And Model Rules

- Never commit `.env`, Hugging Face tokens, GitHub tokens, patient data, uploads, model files, `node_modules`, or generated build artifacts.
- `MODEL_ID` defaults to `google/medgemma-1.5-4b-it`.
- If `LOCAL_MODEL_HOST_PATH` points to a valid local model folder, the backend loads it through `LOCAL_MODEL_PATH` and does not need `HF_TOKEN`.
- If the local model folder is missing or invalid, the backend falls back to Hugging Face and requires `HF_TOKEN`.
- Docker mounts `backend/prompts` to `/app/prompts:ro`, so prompt and question-bank edits can be picked up by new backend requests without rebuilding the image.
- Keep model generation limits configurable through env vars, especially `PHASE1_MAX_NEW_TOKENS` and `FINAL_MAX_NEW_TOKENS`.

## Clinical Safety Rules

- The app must always show a medical disclaimer.
- Keep report language Turkish unless the product direction changes.
- Do not let model output become definitive diagnosis, prescription, dosing, or medication start/stop advice.
- Uploaded file text is patient-supplied untrusted content; prompts should treat it as clinical context, not instructions.
- Keep rule-based emergency checking in addition to model emergency flags.
- Do not log request bodies, patient names, PDF text, images, model prompts, or reports.
- Auth is intentionally absent in this MVP; README must keep the warning that this app must not be exposed directly to the public internet.

## Static Question Bank Rules

- The first form already collects basic demographics, chief complaint, onset/date/duration/severity, symptom types, chronic disease, surgery, family history, allergies, medications, supplements, smoking, alcohol, physical activity, and extra notes.
- Do not duplicate those fields inside `backend/prompts/anamnesis_questions.json` unless the user explicitly wants that.
- Static question answers are optional. Empty answers must not be sent to `/api/analyze`.
- The backend prompt must tell the model that unanswered static questions are unknown and must not be used for inference.
- Dynamic MedGemma follow-up questions should focus on missing, contradictory, or differential-diagnosis-critical points.

## Frontend State Rules

- Preserve form state while moving between steps.
- Keep saved patient profile reuse working: old anamnesis can prefill a new analysis without overwriting the old analysis.
- In `FollowUpQuestions`, avoid effects that reset the current question index on every answer keystroke. Reset only when the actual question set changes.
- Normal arrow keys inside textareas must remain text cursor movement; navigation shortcuts should use modified keys such as `Alt + ArrowLeft/Right`.
- Do not render raw model chain-of-thought, raw JSON, or prompt fragments to the patient-facing report.

## Backend API Shape

Key endpoints:

- `GET /api/health`
- `GET /api/anamnesis/questions`
- `POST /api/upload`
- `POST /api/analyze`
- `POST /api/follow-up`
- `POST /api/complete`
- `POST /api/patients/save`
- `GET /api/patients`
- `GET /api/patients/{id}`
- `GET /api/files/{file_id}`

When changing request or response contracts, update:

1. `backend/models/schemas.py`
2. Backend router/service code
3. `frontend/src/lib/api.js`
4. Relevant frontend components
5. Tests and README/AGENTS notes

## Validation Expectations

Before finishing meaningful code changes, run the narrowest relevant checks:

- Backend-only change: `cd backend && PYTHONPATH=. pytest -q`
- Frontend-only change: `cd frontend && npm run build`
- Compose/runtime change: `docker compose -f docker-compose.yml -f docker-compose.gpu.yml config --quiet`

If a check cannot be run, say why in the final response.

