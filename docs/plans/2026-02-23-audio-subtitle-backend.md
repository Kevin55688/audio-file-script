# Audio Subtitle App — 後端實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立 FastAPI 後端，接收音檔上傳、以 faster-whisper 轉錄，透過 SSE 逐段推送字幕。

**Architecture:** FastAPI 接收 MP3/WAV 上傳後存入 temp/，背景呼叫 faster-whisper（small + int8）轉錄，SSE 端點以 Generator 逐段 yield 字幕 JSON，轉錄完畢推送 done 事件。

**Tech Stack:** Python 3.10+, FastAPI 0.115, faster-whisper 1.0.3, pytest, httpx

**工作目錄:** `audio-file-script/backend/`

---

## API 合約（前端依此串接）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/upload` | 上傳音檔，回傳 task_id + audio_url |
| GET | `/api/audio/{task_id}` | 回傳音檔二進位（FileResponse） |
| GET | `/api/transcribe/{task_id}` | SSE 串流字幕 |

**SSE segment 格式：**
```
data: {"index": 0, "start": 0.0, "end": 3.5, "text": "字幕文字"}\n\n
```
**完成事件：**
```
data: {"status": "done"}\n\n
```
**錯誤事件：**
```
data: {"status": "error", "message": "..."}\n\n
```

---

## Task 1：專案初始化

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/temp/.gitkeep`

**Step 1: 建立目錄結構**

```bash
mkdir -p backend/routers backend/services backend/tests backend/temp
touch backend/routers/__init__.py backend/services/__init__.py backend/tests/__init__.py backend/temp/.gitkeep
```

**Step 2: 建立 `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
faster-whisper==1.0.3
pytest==8.3.0
httpx==0.27.0
pytest-asyncio==0.23.0
```

**Step 3: 建立 `backend/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import transcribe

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcribe.router, prefix="/api")
```

**Step 4: 安裝依賴**

```bash
cd backend
pip install -r requirements.txt
```

**Step 5: 驗證啟動**

```bash
cd backend
uvicorn main:app --reload
```

Expected: "Uvicorn running on http://127.0.0.1:8000"（Ctrl+C 結束）

**Step 6: Commit**

```bash
git add backend/
git commit -m "[Feature] 初始化 FastAPI 後端專案結構"
```

---

## Task 2：音檔上傳與服務端點

**Files:**
- Create: `backend/routers/transcribe.py`
- Create: `backend/tests/test_upload.py`

**Step 1: 建立測試 `backend/tests/test_upload.py`**

```python
import io
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_upload_mp3_success():
    fake_mp3 = io.BytesIO(b"fake mp3 content")
    response = client.post(
        "/api/upload",
        files={"file": ("test.mp3", fake_mp3, "audio/mpeg")},
    )
    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data
    assert "audio_url" in data
    assert data["audio_url"].startswith("/api/audio/")


def test_upload_wav_success():
    fake_wav = io.BytesIO(b"fake wav content")
    response = client.post(
        "/api/upload",
        files={"file": ("test.wav", fake_wav, "audio/wav")},
    )
    assert response.status_code == 200


def test_upload_invalid_format():
    fake_txt = io.BytesIO(b"not audio")
    response = client.post(
        "/api/upload",
        files={"file": ("test.txt", fake_txt, "text/plain")},
    )
    assert response.status_code == 422


def test_serve_audio_not_found():
    response = client.get("/api/audio/nonexistent-task-id")
    assert response.status_code == 404
```

**Step 2: 執行確認失敗**

```bash
cd backend && pytest tests/test_upload.py -v
```

Expected: FAIL（router 尚未建立）

**Step 3: 建立 `backend/routers/transcribe.py`**

```python
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
```

**Step 4: 執行確認通過**

```bash
cd backend && pytest tests/test_upload.py -v
```

Expected: 4 PASS

**Step 5: Commit**

```bash
git add backend/routers/transcribe.py backend/tests/test_upload.py
git commit -m "[Feature] 新增音檔上傳與服務端點"
```

---

## Task 3：Whisper 轉錄服務

**Files:**
- Create: `backend/services/whisper_service.py`
- Create: `backend/tests/test_whisper_service.py`

**Step 1: 建立測試 `backend/tests/test_whisper_service.py`**

```python
from unittest.mock import MagicMock, patch
from services.whisper_service import transcribe_audio


def _make_segment(id, start, end, text):
    seg = MagicMock()
    seg.id = id
    seg.start = start
    seg.end = end
    seg.text = f"  {text}  "
    return seg


@patch("services.whisper_service.model")
def test_transcribe_yields_segments(mock_model):
    mock_segments = [
        _make_segment(0, 0.0, 3.5, "Hello world"),
        _make_segment(1, 3.5, 7.0, "Second segment"),
    ]
    mock_model.transcribe.return_value = (iter(mock_segments), MagicMock())

    results = list(transcribe_audio("fake_path.mp3"))

    assert len(results) == 2
    assert results[0] == {"index": 0, "start": 0.0, "end": 3.5, "text": "Hello world"}
    assert results[1] == {"index": 1, "start": 3.5, "end": 7.0, "text": "Second segment"}


@patch("services.whisper_service.model")
def test_transcribe_strips_whitespace(mock_model):
    mock_segments = [_make_segment(0, 0.0, 2.0, "有空格")]
    mock_model.transcribe.return_value = (iter(mock_segments), MagicMock())

    results = list(transcribe_audio("fake.mp3"))

    assert results[0]["text"] == "有空格"


@patch("services.whisper_service.model")
def test_transcribe_rounds_timestamps(mock_model):
    seg = _make_segment(0, 1.23456, 4.56789, "精度測試")
    mock_model.transcribe.return_value = (iter([seg]), MagicMock())

    results = list(transcribe_audio("fake.mp3"))

    assert results[0]["start"] == 1.23
    assert results[0]["end"] == 4.57
```

**Step 2: 執行確認失敗**

```bash
cd backend && pytest tests/test_whisper_service.py -v
```

Expected: FAIL（service 尚未建立）

**Step 3: 建立 `backend/services/whisper_service.py`**

```python
from typing import Generator
from faster_whisper import WhisperModel

# 首次執行時自動下載模型（約 500MB），後續快取在本機
model = WhisperModel("small", device="cpu", compute_type="int8")


def transcribe_audio(file_path: str) -> Generator[dict, None, None]:
    segments, _ = model.transcribe(file_path)
    for segment in segments:
        yield {
            "index": segment.id,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip(),
        }
```

**Step 4: 執行確認通過**

```bash
cd backend && pytest tests/test_whisper_service.py -v
```

Expected: 3 PASS

**Step 5: Commit**

```bash
git add backend/services/whisper_service.py backend/tests/test_whisper_service.py
git commit -m "[Feature] 新增 faster-whisper 轉錄服務"
```

---

## Task 4：SSE 字幕串流端點

**Files:**
- Modify: `backend/routers/transcribe.py`（新增 SSE 路由）
- Create: `backend/tests/test_sse.py`

**Step 1: 建立測試 `backend/tests/test_sse.py`**

```python
import io
import json
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

MOCK_SEGMENTS = [
    {"index": 0, "start": 0.0, "end": 3.0, "text": "Hello"},
    {"index": 1, "start": 3.0, "end": 6.0, "text": "World"},
]


def _upload_fake_file():
    resp = client.post(
        "/api/upload",
        files={"file": ("test.mp3", io.BytesIO(b"fake"), "audio/mpeg")},
    )
    return resp.json()["task_id"]


@patch("routers.transcribe.transcribe_audio")
def test_sse_streams_segments(mock_transcribe):
    mock_transcribe.return_value = iter(MOCK_SEGMENTS)
    task_id = _upload_fake_file()

    with client.stream("GET", f"/api/transcribe/{task_id}") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
        raw = response.text

    data_lines = [l for l in raw.strip().split("\n") if l.startswith("data:")]
    events = [json.loads(l[5:].strip()) for l in data_lines]

    assert events[0] == MOCK_SEGMENTS[0]
    assert events[1] == MOCK_SEGMENTS[1]
    assert events[-1] == {"status": "done"}


@patch("routers.transcribe.transcribe_audio")
def test_sse_returns_404_for_unknown_task(mock_transcribe):
    response = client.get("/api/transcribe/nonexistent-id")
    assert response.status_code == 404
```

**Step 2: 執行確認失敗**

```bash
cd backend && pytest tests/test_sse.py -v
```

Expected: FAIL（SSE 端點尚未建立）

**Step 3: 修改 `backend/routers/transcribe.py`**

將頂端 import 區塊替換為：

```python
import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from services.whisper_service import transcribe_audio
```

在 `serve_audio` 函式後新增 SSE 端點：

```python
@router.get("/transcribe/{task_id}")
async def transcribe_endpoint(task_id: str):
    file_path = _find_audio_file(task_id)
    if file_path is None:
        raise HTTPException(status_code=404, detail="找不到音檔")

    def event_stream():
        try:
            for segment in transcribe_audio(str(file_path)):
                yield f"data: {json.dumps(segment, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'status': 'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

**Step 4: 執行全部後端測試**

```bash
cd backend && pytest tests/ -v
```

Expected: 全部 PASS（共 9 個測試）

**Step 5: Commit**

```bash
git add backend/routers/transcribe.py backend/tests/test_sse.py
git commit -m "[Feature] 新增 SSE 字幕串流端點"
```

---

## 啟動後端

```bash
cd backend
uvicorn main:app --reload --port 8000
```
