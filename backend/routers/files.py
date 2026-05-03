import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from config import Settings, get_settings
from database import get_db
from models.db_models import UploadedFile

router = APIRouter(prefix="/api", tags=["files"])


@router.get("/files/{file_id}")
def get_file(
    file_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> FileResponse:
    record = db.get(UploadedFile, file_id)
    if record is None:
        raise HTTPException(status_code=404, detail="File not found")

    path = os.path.join(settings.upload_dir, record.stored_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Stored file not found")

    return FileResponse(
        path,
        media_type=record.mime_type,
        filename=record.original_filename,
    )
