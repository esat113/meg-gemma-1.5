import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from config import Settings, get_settings
from database import get_db
from models.db_models import UploadedFile
from models.schemas import UploadResponse, UploadedFileResponse
from services.file_processor import process_upload

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload", response_model=UploadResponse)
def upload_files(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> UploadResponse:
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")
    if len(files) > settings.max_files_per_analysis:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.max_files_per_analysis} files are allowed")

    responses: list[UploadedFileResponse] = []
    for upload in files:
        processed = process_upload(upload, settings.upload_dir, settings.max_upload_bytes)
        record = UploadedFile(
            original_filename=processed.original_filename,
            stored_filename=processed.stored_filename,
            mime_type=processed.mime_type,
            file_type=processed.file_type,
            size_bytes=processed.size_bytes,
            extracted_text=processed.extracted_text,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        responses.append(
            UploadedFileResponse(
                file_id=record.id,
                type=record.file_type,
                filename=record.original_filename,
                mime_type=record.mime_type,
                size_bytes=record.size_bytes,
                extracted_text=record.extracted_text,
                preview_url=f"/api/files/{record.id}" if os.path.exists(processed.path) else None,
            )
        )

    return UploadResponse(files=responses)
