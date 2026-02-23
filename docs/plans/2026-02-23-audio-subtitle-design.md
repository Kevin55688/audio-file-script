# Audio Subtitle App — 設計文件

**日期：** 2026-02-23
**狀態：** 已確認

---

## 功能概述

使用者上傳 MP3 或 WAV 音檔後，系統自動以 AI 語音辨識產生字幕，並在播放音檔時即時同步顯示對應字幕。

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 後端 | FastAPI (Python) |
| 前端 | React + TypeScript + Vite |
| AI 轉錄 | faster-whisper（small model） |
| 即時推送 | Server-Sent Events (SSE) |

---

## 專案結構

```
audio-file-script/
├── backend/
│   ├── main.py
│   ├── routers/
│   │   └── transcribe.py
│   ├── services/
│   │   └── whisper_service.py
│   ├── temp/                  # 暫存音檔（轉錄完後刪除）
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── AudioUploader.tsx
    │   │   ├── AudioPlayer.tsx
    │   │   └── SubtitleDisplay.tsx
    │   └── hooks/
    │       └── useTranscription.ts
    ├── package.json
    └── vite.config.ts
```

---

## API 設計

### POST `/api/upload`

上傳音檔，回傳 task_id 與音檔存取 URL。

**Request:** `multipart/form-data`，欄位 `file`（mp3 / wav）

**Response:**
```json
{
  "task_id": "uuid-v4",
  "audio_url": "/api/audio/{task_id}"
}
```

**驗證規則：**
- 僅接受 `.mp3`、`.wav`
- 檔案上限 500MB

---

### GET `/api/transcribe/{task_id}`

SSE 串流端點，逐段推送字幕資料。

**每個字幕 segment 事件：**
```json
{ "index": 0, "start": 0.0, "end": 4.5, "text": "這是第一段字幕" }
```

**轉錄完成事件：**
```json
{ "status": "done" }
```

**轉錄失敗事件：**
```json
{ "status": "error", "message": "錯誤描述" }
```

---

### GET `/api/audio/{task_id}`

回傳音檔二進位內容，供前端 `<audio>` 元素直接播放。

---

## 後端轉錄流程

```python
# whisper_service.py
from faster_whisper import WhisperModel

model = WhisperModel("small", device="cpu", compute_type="int8")

def transcribe(file_path: str):
    segments, _ = model.transcribe(file_path)
    for segment in segments:
        yield {
            "index": segment.id,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip()
        }
```

- `compute_type="int8"` 可在 CPU 上大幅加速
- 模型首次使用時自動下載，後續快取在本機
- 轉錄完成後刪除 `temp/` 中的暫存音檔

---

## 前端核心邏輯

### 上傳 → 播放流程

```
使用者選擇/拖曳音檔
  → POST /api/upload
  → 取得 task_id + audio_url
  → 同時：
      (1) <audio> 載入 audio_url（可立即播放）
      (2) EventSource 連接 /api/transcribe/{task_id}
  → SSE 每收到一個 segment 加入字幕列表
  → 播放時每 100ms 比對 currentTime，顯示對應字幕
```

### 字幕同步邏輯

```typescript
// 每 100ms 執行一次
const currentSegment = segments.find(
  (s) => currentTime >= s.start && currentTime <= s.end
);
setActiveSubtitle(currentSegment?.text ?? "");
```

### 轉錄尚未完成時的播放

- 當前時間已超過已轉錄範圍 → 顯示「轉錄中...」
- 收到 `{ status: "done" }` → 隱藏提示，全部字幕就緒

---

## 錯誤處理

| 情境 | 處理方式 |
|------|---------|
| 上傳格式不對 | 前端 file input 限制；後端回傳 422 |
| 檔案超過 500MB | 後端回傳 413 |
| SSE 連線中斷 | 前端自動重連一次，失敗顯示錯誤提示 |
| 轉錄過程失敗 | SSE 推送 `{ status: "error" }`，前端顯示錯誤訊息 |

---

## 效能預估（i5-12400 CPU）

| 音檔長度 | 預估轉錄時間（faster-whisper small） |
|---------|-------------------------------------|
| 5 分鐘 | ~1～2 分鐘 |
| 15 分鐘 | ~3～5 分鐘 |
| 30 分鐘 | ~8～12 分鐘 |

---

## 不在本次範圍內（YAGNI）

- 字幕匯出（.srt / .vtt）
- 多語言切換
- 使用者帳號系統
- 歷史記錄儲存
