from io import BytesIO

from fastapi import UploadFile
from PIL import Image

from services.file_processor import process_upload


def test_process_upload_normalizes_image(tmp_path):
    image_bytes = BytesIO()
    Image.new("RGB", (1400, 900), color="white").save(image_bytes, format="PNG")
    image_bytes.seek(0)
    upload = UploadFile(filename="test.png", file=image_bytes)
    upload.headers = {"content-type": "image/png"}

    processed = process_upload(upload, str(tmp_path), max_bytes=10 * 1024 * 1024)

    assert processed.file_type == "image"
    assert processed.size_bytes > 0
    with Image.open(processed.path) as img:
        assert max(img.size) <= 1024
