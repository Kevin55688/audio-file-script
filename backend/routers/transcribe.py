import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse

router = APIRouter()

TEMP_DIR = Path(__file__).parent.parent / "temp"
TEMP_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB


def _find_audio_file(task_id: str) -> Path | None:
    for ext in ALLOWED_EXTENSIONS:
        path = TEMP_DIR / f"{task_id}{ext}"
        if path.exists():
            return path
    return None


@router.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail="只接受 .mp3 或 .wav 檔案")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="檔案超過 500MB 上限")

    task_id = str(uuid.uuid4())
    file_path = TEMP_DIR / f"{task_id}{ext}"
    file_path.write_bytes(content)

    return {"task_id": task_id, "audio_url": f"/api/audio/{task_id}"}


@router.get("/audio/{task_id}")
async def serve_audio(task_id: str):
    file_path = _find_audio_file(task_id)
    if file_path is None:
        raise HTTPException(status_code=404, detail="找不到音檔")
    return FileResponse(file_path)
