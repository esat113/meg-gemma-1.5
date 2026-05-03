import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from config import get_settings
from database import init_db
from models.schemas import HealthResponse
from routers import anamnesis, analyze, files, patients, upload
from services.medgemma_service import MedGemmaService

settings = get_settings()


def init_db_with_retry() -> None:
    last_error: Exception | None = None
    for _ in range(20):
        try:
            init_db()
            return
        except OperationalError as exc:
            last_error = exc
            time.sleep(1)
    if last_error:
        raise last_error


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db_with_retry()
    app.state.medgemma = MedGemmaService(settings)
    app.state.medgemma.load()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router)
app.include_router(anamnesis.router)
app.include_router(analyze.router)
app.include_router(patients.router)
app.include_router(files.router)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(**app.state.medgemma.health())
