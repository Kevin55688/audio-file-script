# Audio Subtitle App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立網頁應用，讓使用者上傳 MP3/WAV 音檔，AI 自動轉錄字幕，播放時即時同步顯示。

**Architecture:** FastAPI 後端接收音檔、透過 faster-whisper（small + int8）轉錄，以 SSE 逐段推送字幕。React 前端上傳後同時開啟 EventSource 接收字幕，根據 `audio.currentTime` 與 segment 時間比對，顯示對應字幕文字。

**Tech Stack:** FastAPI, faster-whisper, Python 3.10+, React 18, TypeScript, Vite, Vitest, React Testing Library

---

## Task 1: 後端專案初始化

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/temp/.gitkeep`
- Create: `backend/tests/__init__.py`

**Step 1: 建立 requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
faster-whisper==1.0.3
pytest==8.3.0
httpx==0.27.0
pytest-asyncio==0.23.0
```

**Step 2: 建立 main.py**

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

**Step 3: 建立空 __init__.py 與目錄**

```bash
mkdir -p backend/routers backend/services backend/temp backend/tests
touch backend/routers/__init__.py
touch backend/services/__init__.py
touch backend/tests/__init__.py
touch backend/temp/.gitkeep
```

**Step 4: 安裝依賴**

```bash
cd backend
pip install -r requirements.txt
```

**Step 5: 驗證 FastAPI 可啟動**

```bash
cd backend
uvicorn main:app --reload
```

Expected: 終端顯示 "Uvicorn running on http://127.0.0.1:8000"（Ctrl+C 結束）

**Step 6: Commit**

```bash
git add backend/
git commit -m "[Feature] 初始化 FastAPI 後端專案結構"
```

---

## Task 2: 音檔上傳與服務端點

**Files:**
- Create: `backend/routers/transcribe.py`
- Create: `backend/tests/test_upload.py`

**Step 1: 撰寫失敗測試**

建立 `backend/tests/test_upload.py`：

```python
import io
import pytest
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

**Step 2: 執行測試確認失敗**

```bash
cd backend
pytest tests/test_upload.py -v
```

Expected: FAIL — `ImportError` 或 404

**Step 3: 實作 upload router**

建立 `backend/routers/transcribe.py`：

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

**Step 4: 執行測試確認通過**

```bash
cd backend
pytest tests/test_upload.py -v
```

Expected: 4 PASS

**Step 5: Commit**

```bash
git add backend/routers/transcribe.py backend/tests/test_upload.py
git commit -m "[Feature] 新增音檔上傳與服務端點"
```

---

## Task 3: Whisper 轉錄服務

**Files:**
- Create: `backend/services/whisper_service.py`
- Create: `backend/tests/test_whisper_service.py`

**Step 1: 撰寫失敗測試**

建立 `backend/tests/test_whisper_service.py`：

```python
from unittest.mock import MagicMock, patch
from services.whisper_service import transcribe_audio


def _make_segment(id, start, end, text):
    seg = MagicMock()
    seg.id = id
    seg.start = start
    seg.end = end
    seg.text = f"  {text}  "  # 含空白，測試 strip()
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

**Step 2: 執行測試確認失敗**

```bash
cd backend
pytest tests/test_whisper_service.py -v
```

Expected: FAIL — `ModuleNotFoundError`

**Step 3: 實作 whisper_service.py**

建立 `backend/services/whisper_service.py`：

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

**Step 4: 執行測試確認通過**

```bash
cd backend
pytest tests/test_whisper_service.py -v
```

Expected: 3 PASS

**Step 5: Commit**

```bash
git add backend/services/whisper_service.py backend/tests/test_whisper_service.py
git commit -m "[Feature] 新增 faster-whisper 轉錄服務"
```

---

## Task 4: SSE 字幕串流端點

**Files:**
- Modify: `backend/routers/transcribe.py`（新增 SSE 路由）
- Create: `backend/tests/test_sse.py`

**Step 1: 撰寫失敗測試**

建立 `backend/tests/test_sse.py`：

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

**Step 2: 執行測試確認失敗**

```bash
cd backend
pytest tests/test_sse.py -v
```

Expected: FAIL

**Step 3: 在 transcribe.py 新增 SSE 端點**

在 `backend/routers/transcribe.py` 的 `serve_audio` 函式後面加入：

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

同時在 `transcribe.py` 頂端補上缺少的 import：

```python
from services.whisper_service import transcribe_audio
```

**Step 4: 執行全部後端測試確認通過**

```bash
cd backend
pytest tests/ -v
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add backend/routers/transcribe.py backend/tests/test_sse.py
git commit -m "[Feature] 新增 SSE 字幕串流端點"
```

---

## Task 5: 前端專案初始化

**Files:**
- Create: `frontend/`（由 Vite 產生）

**Step 1: 建立 React TypeScript 專案**

```bash
cd /c/Users/utafy/OneDrive/桌面/audio-file-script
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: 安裝測試依賴**

```bash
cd frontend
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 3: 修改 vite.config.ts**

將 `frontend/vite.config.ts` 完整替換為：

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

**Step 4: 建立測試 setup 檔案**

建立 `frontend/src/test-setup.ts`：

```typescript
import "@testing-library/jest-dom";
```

**Step 5: 在 package.json 新增 test script**

在 `frontend/package.json` 的 `scripts` 中加入：

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 6: 驗證測試環境正常**

```bash
cd frontend
npm test
```

Expected: 顯示 "No test files found"（無錯誤）

**Step 7: Commit**

```bash
git add frontend/
git commit -m "[Feature] 初始化 React TypeScript 前端專案"
```

---

## Task 6: 共用型別定義 + SubtitleDisplay 組件

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/components/SubtitleDisplay.tsx`
- Create: `frontend/src/components/SubtitleDisplay.test.tsx`

**Step 1: 建立共用型別**

建立 `frontend/src/types.ts`：

```typescript
export interface Segment {
  index: number;
  start: number;
  end: number;
  text: string;
}
```

**Step 2: 撰寫失敗測試**

建立 `frontend/src/components/SubtitleDisplay.test.tsx`：

```typescript
import { render, screen } from "@testing-library/react";
import SubtitleDisplay from "./SubtitleDisplay";
import type { Segment } from "../types";

const segments: Segment[] = [
  { index: 0, start: 0, end: 3, text: "第一段字幕" },
  { index: 1, start: 3, end: 6, text: "第二段字幕" },
];

test("shows active subtitle for current time", () => {
  render(<SubtitleDisplay segments={segments} currentTime={1.5} isTranscribing={false} />);
  expect(screen.getByText("第一段字幕")).toBeInTheDocument();
});

test("shows second subtitle when in range", () => {
  render(<SubtitleDisplay segments={segments} currentTime={4} isTranscribing={false} />);
  expect(screen.getByText("第二段字幕")).toBeInTheDocument();
});

test("shows transcribing indicator when past transcribed range and still transcribing", () => {
  render(<SubtitleDisplay segments={segments} currentTime={10} isTranscribing={true} />);
  expect(screen.getByText("轉錄中...")).toBeInTheDocument();
});

test("shows empty text when no match and transcription done", () => {
  render(<SubtitleDisplay segments={segments} currentTime={10} isTranscribing={false} />);
  expect(screen.getByRole("paragraph").textContent).toBe("");
});
```

**Step 3: 執行測試確認失敗**

```bash
cd frontend
npm test
```

Expected: FAIL — `Cannot find module './SubtitleDisplay'`

**Step 4: 實作 SubtitleDisplay**

建立 `frontend/src/components/SubtitleDisplay.tsx`：

```typescript
import type { Segment } from "../types";

interface Props {
  segments: Segment[];
  currentTime: number;
  isTranscribing: boolean;
}

export default function SubtitleDisplay({ segments, currentTime, isTranscribing }: Props) {
  const active = segments.find((s) => currentTime >= s.start && currentTime <= s.end);

  const text = active ? active.text : isTranscribing ? "轉錄中..." : "";

  return (
    <div className="subtitle-container">
      <p className="subtitle-text">{text}</p>
    </div>
  );
}
```

**Step 5: 執行測試確認通過**

```bash
cd frontend
npm test
```

Expected: 4 PASS

**Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/components/SubtitleDisplay.tsx frontend/src/components/SubtitleDisplay.test.tsx
git commit -m "[Feature] 新增 SubtitleDisplay 組件"
```

---

## Task 7: useTranscription Hook

**Files:**
- Create: `frontend/src/hooks/useTranscription.ts`
- Create: `frontend/src/hooks/useTranscription.test.ts`

**Step 1: 撰寫失敗測試**

建立 `frontend/src/hooks/useTranscription.test.ts`：

```typescript
import { renderHook, act } from "@testing-library/react";
import { useTranscription } from "./useTranscription";

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  url: string;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  (global as any).EventSource = MockEventSource;
});

test("starts with empty segments and not transcribing when taskId is null", () => {
  const { result } = renderHook(() => useTranscription(null));
  expect(result.current.segments).toEqual([]);
  expect(result.current.isTranscribing).toBe(false);
});

test("sets isTranscribing to true when taskId is provided", () => {
  const { result } = renderHook(() => useTranscription("task-123"));
  expect(result.current.isTranscribing).toBe(true);
});

test("accumulates segments from SSE events", () => {
  const { result } = renderHook(() => useTranscription("task-123"));

  act(() => {
    MockEventSource.instances[0].emit({ index: 0, start: 0, end: 3, text: "Hello" });
  });
  act(() => {
    MockEventSource.instances[0].emit({ index: 1, start: 3, end: 6, text: "World" });
  });

  expect(result.current.segments).toHaveLength(2);
  expect(result.current.segments[0].text).toBe("Hello");
});

test("sets isTranscribing to false on done event", () => {
  const { result } = renderHook(() => useTranscription("task-123"));

  act(() => {
    MockEventSource.instances[0].emit({ status: "done" });
  });

  expect(result.current.isTranscribing).toBe(false);
});

test("closes EventSource when taskId becomes null", () => {
  const { rerender } = renderHook(({ id }) => useTranscription(id), {
    initialProps: { id: "task-123" as string | null },
  });

  const source = MockEventSource.instances[0];
  rerender({ id: null });

  expect(source.closed).toBe(true);
});
```

**Step 2: 執行測試確認失敗**

```bash
cd frontend
npm test
```

Expected: FAIL — `Cannot find module './useTranscription'`

**Step 3: 實作 useTranscription**

建立 `frontend/src/hooks/useTranscription.ts`：

```typescript
import { useState, useEffect } from "react";
import type { Segment } from "../types";

interface TranscriptionState {
  segments: Segment[];
  isTranscribing: boolean;
  error: string | null;
}

export function useTranscription(taskId: string | null): TranscriptionState {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) {
      setIsTranscribing(false);
      return;
    }

    setSegments([]);
    setIsTranscribing(true);
    setError(null);

    const source = new EventSource(`/api/transcribe/${taskId}`);

    source.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.status === "done") {
        setIsTranscribing(false);
        source.close();
      } else if (data.status === "error") {
        setError(data.message);
        setIsTranscribing(false);
        source.close();
      } else {
        setSegments((prev) => [...prev, data as Segment]);
      }
    };

    source.onerror = () => {
      setError("連線中斷，請重新整理");
      setIsTranscribing(false);
      source.close();
    };

    return () => {
      source.close();
    };
  }, [taskId]);

  return { segments, isTranscribing, error };
}
```

**Step 4: 執行測試確認通過**

```bash
cd frontend
npm test
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useTranscription.ts frontend/src/hooks/useTranscription.test.ts
git commit -m "[Feature] 新增 useTranscription SSE hook"
```

---

## Task 8: AudioUploader 組件

**Files:**
- Create: `frontend/src/components/AudioUploader.tsx`
- Create: `frontend/src/components/AudioUploader.test.tsx`

**Step 1: 撰寫失敗測試**

建立 `frontend/src/components/AudioUploader.test.tsx`：

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AudioUploader from "./AudioUploader";

const mockOnUploaded = vi.fn();

beforeEach(() => {
  mockOnUploaded.mockClear();
});

test("renders upload area with label", () => {
  render(<AudioUploader onUploaded={mockOnUploaded} />);
  expect(screen.getByText(/上傳音檔/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/選擇音檔/i)).toBeInTheDocument();
});

test("calls onUploaded with task_id and audio_url after successful upload", async () => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ task_id: "abc-123", audio_url: "/api/audio/abc-123" }),
  } as Response);

  render(<AudioUploader onUploaded={mockOnUploaded} />);

  const file = new File(["content"], "test.mp3", { type: "audio/mpeg" });
  await userEvent.upload(screen.getByLabelText(/選擇音檔/i), file);

  expect(global.fetch).toHaveBeenCalledWith(
    "/api/upload",
    expect.objectContaining({ method: "POST" })
  );
  expect(mockOnUploaded).toHaveBeenCalledWith("abc-123", "/api/audio/abc-123");
});

test("shows error message when upload fails", async () => {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detail: "格式不支援" }),
  } as Response);

  render(<AudioUploader onUploaded={mockOnUploaded} />);

  const file = new File(["content"], "test.txt", { type: "text/plain" });
  await userEvent.upload(screen.getByLabelText(/選擇音檔/i), file);

  expect(await screen.findByText(/上傳失敗/i)).toBeInTheDocument();
});
```

**Step 2: 執行測試確認失敗**

```bash
cd frontend
npm test
```

Expected: FAIL

**Step 3: 實作 AudioUploader**

建立 `frontend/src/components/AudioUploader.tsx`：

```typescript
import { useState } from "react";

interface Props {
  onUploaded: (taskId: string, audioUrl: string) => void;
}

export default function AudioUploader({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(`上傳失敗：${data.detail ?? "未知錯誤"}`);
      return;
    }

    onUploaded(data.task_id, data.audio_url);
  };

  return (
    <div className="uploader">
      <p>上傳音檔</p>
      <label htmlFor="audio-input">選擇音檔</label>
      <input
        id="audio-input"
        type="file"
        accept=".mp3,.wav"
        onChange={handleChange}
        disabled={uploading}
      />
      {uploading && <p>上傳中...</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

**Step 4: 執行測試確認通過**

```bash
cd frontend
npm test
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add frontend/src/components/AudioUploader.tsx frontend/src/components/AudioUploader.test.tsx
git commit -m "[Feature] 新增 AudioUploader 組件"
```

---

## Task 9: AudioPlayer 組件

**Files:**
- Create: `frontend/src/components/AudioPlayer.tsx`
- Create: `frontend/src/components/AudioPlayer.test.tsx`

**Step 1: 撰寫失敗測試**

建立 `frontend/src/components/AudioPlayer.test.tsx`：

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import AudioPlayer from "./AudioPlayer";
import type { Segment } from "../types";

const segments: Segment[] = [
  { index: 0, start: 0, end: 3, text: "Hello" },
];

test("renders audio element and subtitle area", () => {
  render(<AudioPlayer audioUrl="/api/audio/test" segments={segments} isTranscribing={false} />);
  expect(document.querySelector("audio")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: /audio player/i })).toBeInTheDocument();
});

test("displays correct subtitle on timeupdate", () => {
  render(<AudioPlayer audioUrl="/api/audio/test" segments={segments} isTranscribing={false} />);

  const audio = document.querySelector("audio")!;
  Object.defineProperty(audio, "currentTime", { value: 1.5, configurable: true });
  fireEvent.timeUpdate(audio);

  expect(screen.getByText("Hello")).toBeInTheDocument();
});
```

**Step 2: 執行測試確認失敗**

```bash
cd frontend
npm test
```

Expected: FAIL

**Step 3: 實作 AudioPlayer**

建立 `frontend/src/components/AudioPlayer.tsx`：

```typescript
import { useRef, useState } from "react";
import type { Segment } from "../types";
import SubtitleDisplay from "./SubtitleDisplay";

interface Props {
  audioUrl: string;
  segments: Segment[];
  isTranscribing: boolean;
}

export default function AudioPlayer({ audioUrl, segments, isTranscribing }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current?.currentTime ?? 0);
  };

  return (
    <div aria-label="audio player" role="region">
      <audio ref={audioRef} src={audioUrl} controls onTimeUpdate={handleTimeUpdate} />
      <SubtitleDisplay
        segments={segments}
        currentTime={currentTime}
        isTranscribing={isTranscribing}
      />
    </div>
  );
}
```

**Step 4: 執行測試確認通過**

```bash
cd frontend
npm test
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add frontend/src/components/AudioPlayer.tsx frontend/src/components/AudioPlayer.test.tsx
git commit -m "[Feature] 新增 AudioPlayer 組件"
```

---

## Task 10: App 整合

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`
- Modify: `frontend/index.html`（更新頁面標題）

**Step 1: 替換 App.tsx**

將 `frontend/src/App.tsx` 完整替換為：

```typescript
import { useState } from "react";
import AudioUploader from "./components/AudioUploader";
import AudioPlayer from "./components/AudioPlayer";
import { useTranscription } from "./hooks/useTranscription";
import "./App.css";

export default function App() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { segments, isTranscribing, error } = useTranscription(taskId);

  const handleUploaded = (id: string, url: string) => {
    setTaskId(id);
    setAudioUrl(url);
  };

  return (
    <main>
      <h1>音檔字幕播放器</h1>
      <AudioUploader onUploaded={handleUploaded} />
      {error && <p className="error">轉錄錯誤：{error}</p>}
      {audioUrl && (
        <AudioPlayer
          audioUrl={audioUrl}
          segments={segments}
          isTranscribing={isTranscribing}
        />
      )}
    </main>
  );
}
```

**Step 2: 替換 App.css**

將 `frontend/src/App.css` 完整替換為：

```css
main {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: sans-serif;
}

h1 {
  margin-bottom: 1.5rem;
}

.uploader {
  border: 2px dashed #ccc;
  padding: 2rem;
  text-align: center;
  margin-bottom: 2rem;
  border-radius: 8px;
  cursor: pointer;
}

.uploader label {
  display: inline-block;
  margin: 0.5rem;
  padding: 0.5rem 1rem;
  background: #0066cc;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.uploader input[type="file"] {
  display: none;
}

audio {
  width: 100%;
  margin-bottom: 1rem;
}

.subtitle-container {
  min-height: 4rem;
  background: #111;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.subtitle-text {
  color: #fff;
  font-size: 1.2rem;
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.error {
  color: #cc0000;
}
```

**Step 3: 更新頁面標題**

在 `frontend/index.html` 中將 `<title>` 改為：

```html
<title>音檔字幕播放器</title>
```

**Step 4: 執行所有測試**

```bash
cd frontend
npm test
```

Expected: 全部 PASS

**Step 5: 手動整合測試**

```bash
# Terminal 1：啟動後端
cd backend
uvicorn main:app --reload

# Terminal 2：啟動前端
cd frontend
npm run dev
```

開啟 http://localhost:5173，上傳一個 MP3 或 WAV 音檔，確認：
1. 上傳成功後出現播放器
2. SSE 開始接收字幕（Network tab 可見 EventStream）
3. 播放音檔時，字幕隨時間同步更新

**Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.css frontend/index.html
git commit -m "[Feature] 整合 App 主頁面，完成上傳與字幕播放流程"
```

---

## 完整測試指令

```bash
# 後端
cd backend && pytest tests/ -v

# 前端
cd frontend && npm test
```

---

## 任務總覽

| Task | 重點 | 測試 |
|------|------|------|
| 1 | FastAPI 後端初始化 | 手動驗證 |
| 2 | 音檔上傳 + 服務端點 | `test_upload.py` |
| 3 | faster-whisper 轉錄服務 | `test_whisper_service.py` |
| 4 | SSE 字幕串流端點 | `test_sse.py` |
| 5 | React + Vite 前端初始化 | 手動驗證 |
| 6 | SubtitleDisplay 組件 | `SubtitleDisplay.test.tsx` |
| 7 | useTranscription Hook | `useTranscription.test.ts` |
| 8 | AudioUploader 組件 | `AudioUploader.test.tsx` |
| 9 | AudioPlayer 組件 | `AudioPlayer.test.tsx` |
| 10 | App 整合 | 手動整合測試 |
