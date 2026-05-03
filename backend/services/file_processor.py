import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import fitz
from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass


ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic", ".heif"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
PDF_MIME_TYPES = {"application/pdf"}
IMAGE_MIME_PREFIX = "image/"
MAX_IMAGE_SIDE = 1024


@dataclass
class ProcessedFile:
    original_filename: str
    stored_filename: str
    path: str
    mime_type: str
    file_type: str
    size_bytes: int
    extracted_text: str | None


def _safe_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext or 'unknown'}")
    return ext


def _detect_file_type(ext: str, content_type: str | None) -> str:
    if ext == ".pdf" or content_type in PDF_MIME_TYPES:
        return "pdf"
    if ext in IMAGE_EXTENSIONS or (content_type or "").startswith(IMAGE_MIME_PREFIX):
        return "image"
    raise HTTPException(status_code=400, detail="Unsupported file type")


def _extract_pdf_text(path: str) -> str | None:
    try:
        with fitz.open(path) as doc:
            chunks: list[str] = []
            for page in doc:
                text = page.get_text("text").strip()
                if text:
                    chunks.append(text)
        joined = "\n\n".join(chunks).strip()
        return joined or None
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PDF could not be processed: {exc}") from exc


def _normalize_image(path: str) -> None:
    try:
        with Image.open(path) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
            if img.mode not in {"RGB", "L"}:
                img = img.convert("RGB")
            img.save(path)
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Image file could not be identified") from exc


def process_upload(upload: UploadFile, upload_dir: str, max_bytes: int) -> ProcessedFile:
    original_filename = upload.filename or "upload"
    ext = _safe_extension(original_filename)
    file_type = _detect_file_type(ext, upload.content_type)
    stored_ext = ".jpg" if file_type == "image" else ext
    stored_filename = f"{uuid4()}{stored_ext}"
    os.makedirs(upload_dir, exist_ok=True)
    destination = os.path.join(upload_dir, stored_filename)

    size = 0
    try:
        with open(destination, "wb") as out_file:
            while True:
                chunk = upload.file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    out_file.close()
                    os.remove(destination)
                    raise HTTPException(status_code=413, detail="File exceeds maximum allowed size")
                out_file.write(chunk)
    finally:
        upload.file.close()

    if size == 0:
        os.remove(destination)
        raise HTTPException(status_code=400, detail="Empty files are not allowed")

    extracted_text: str | None = None
    mime_type = upload.content_type or "application/octet-stream"
    if file_type == "pdf":
        extracted_text = _extract_pdf_text(destination)
    elif file_type == "image":
        _normalize_image(destination)
        mime_type = "image/jpeg"

    return ProcessedFile(
        original_filename=original_filename,
        stored_filename=stored_filename,
        path=destination,
        mime_type=mime_type,
        file_type=file_type,
        size_bytes=os.path.getsize(destination),
        extracted_text=extracted_text,
    )


def copy_for_model(stored_path: str, temp_dir: str) -> str:
    os.makedirs(temp_dir, exist_ok=True)
    target = os.path.join(temp_dir, os.path.basename(stored_path))
    shutil.copy2(stored_path, target)
    return target
