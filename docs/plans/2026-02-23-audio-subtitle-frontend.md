# Audio Subtitle App — 前端實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立 React 前端，讓使用者上傳音檔後即時接收 SSE 字幕，並在播放音檔時同步顯示。

**Architecture:** AudioUploader 上傳檔案取得 task_id，useTranscription hook 透過 EventSource 接收 SSE 字幕段落，AudioPlayer 每 timeupdate 事件比對 currentTime 與 segment 時間範圍，顯示對應字幕。

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS v4, Vitest, React Testing Library

**工作目錄:** `audio-file-script/`（在此建立 `frontend/` 子目錄）

---

## API 合約（後端已實作，前端依此串接）

**POST `/api/upload`**
- Request: `multipart/form-data`，欄位 `file`（.mp3 / .wav）
- Response: `{ "task_id": "uuid", "audio_url": "/api/audio/{task_id}" }`

**GET `/api/audio/{task_id}`**
- Response: 音檔二進位，直接用於 `<audio src>`

**GET `/api/transcribe/{task_id}`**
- Response: SSE `text/event-stream`
- Segment 事件: `data: {"index":0,"start":0.0,"end":3.5,"text":"字幕"}`
- 完成事件: `data: {"status":"done"}`
- 錯誤事件: `data: {"status":"error","message":"..."}`

---

## Task 5：前端專案初始化 + Tailwind 設定

**Files:**
- Create: `frontend/`（由 Vite 產生）
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/index.css`
- Create: `frontend/src/test-setup.ts`

**Step 1: 建立專案**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

**Step 2: 安裝 Tailwind CSS v4（Vite plugin）**

```bash
cd frontend
npm install tailwindcss @tailwindcss/vite
```

**Step 3: 安裝測試依賴**

```bash
cd frontend
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 4: 替換 `frontend/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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

**Step 5: 替換 `frontend/src/index.css`**

```css
@import "tailwindcss";
```

**Step 6: 建立 `frontend/src/test-setup.ts`**

```typescript
import "@testing-library/jest-dom";
```

**Step 7: 在 `frontend/package.json` 的 scripts 新增**

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 8: 驗證測試環境**

```bash
cd frontend && npm test
```

Expected: "No test files found"（無錯誤）

**Step 9: Commit**

```bash
git add frontend/
git commit -m "[Feature] 初始化 React TypeScript 前端專案（含 Tailwind CSS v4）"
```

---

## Task 6：共用型別 + SubtitleDisplay 組件

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/components/SubtitleDisplay.tsx`
- Create: `frontend/src/components/SubtitleDisplay.test.tsx`

**Step 1: 建立 `frontend/src/types.ts`**

```typescript
export interface Segment {
  index: number;
  start: number;
  end: number;
  text: string;
}
```

**Step 2: 建立測試 `frontend/src/components/SubtitleDisplay.test.tsx`**

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

**Step 3: 執行確認失敗**

```bash
cd frontend && npm test
```

Expected: FAIL — `Cannot find module './SubtitleDisplay'`

**Step 4: 建立 `frontend/src/components/SubtitleDisplay.tsx`**

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
    <div className="flex items-center justify-center min-h-16 bg-gray-900 rounded-lg px-4 py-3">
      <p className="text-white text-xl text-center leading-relaxed m-0">{text}</p>
    </div>
  );
}
```

**Step 5: 執行確認通過**

```bash
cd frontend && npm test
```

Expected: 4 PASS

**Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/components/SubtitleDisplay.tsx frontend/src/components/SubtitleDisplay.test.tsx
git commit -m "[Feature] 新增 SubtitleDisplay 組件"
```

---

## Task 7：useTranscription Hook

**Files:**
- Create: `frontend/src/hooks/useTranscription.ts`
- Create: `frontend/src/hooks/useTranscription.test.ts`

**Step 1: 建立測試 `frontend/src/hooks/useTranscription.test.ts`**

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

**Step 2: 執行確認失敗**

```bash
cd frontend && npm test
```

Expected: FAIL — `Cannot find module './useTranscription'`

**Step 3: 建立 `frontend/src/hooks/useTranscription.ts`**

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

**Step 4: 執行確認通過**

```bash
cd frontend && npm test
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useTranscription.ts frontend/src/hooks/useTranscription.test.ts
git commit -m "[Feature] 新增 useTranscription SSE hook"
```

---

## Task 8：AudioUploader 組件

**Files:**
- Create: `frontend/src/components/AudioUploader.tsx`
- Create: `frontend/src/components/AudioUploader.test.tsx`

**Step 1: 建立測試 `frontend/src/components/AudioUploader.test.tsx`**

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

**Step 2: 執行確認失敗**

```bash
cd frontend && npm test
```

Expected: FAIL

**Step 3: 建立 `frontend/src/components/AudioUploader.tsx`**

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
    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-8">
      <p className="text-gray-600 mb-3">上傳音檔</p>
      <label
        htmlFor="audio-input"
        className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
      >
        選擇音檔
      </label>
      <input
        id="audio-input"
        type="file"
        accept=".mp3,.wav"
        onChange={handleChange}
        disabled={uploading}
        className="hidden"
      />
      {uploading && <p className="mt-3 text-gray-500">上傳中...</p>}
      {error && <p className="mt-3 text-red-500">{error}</p>}
    </div>
  );
}
```

**Step 4: 執行確認通過**

```bash
cd frontend && npm test
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add frontend/src/components/AudioUploader.tsx frontend/src/components/AudioUploader.test.tsx
git commit -m "[Feature] 新增 AudioUploader 組件"
```

---

## Task 9：AudioPlayer 組件

**Files:**
- Create: `frontend/src/components/AudioPlayer.tsx`
- Create: `frontend/src/components/AudioPlayer.test.tsx`

**Step 1: 建立測試 `frontend/src/components/AudioPlayer.test.tsx`**

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

**Step 2: 執行確認失敗**

```bash
cd frontend && npm test
```

Expected: FAIL

**Step 3: 建立 `frontend/src/components/AudioPlayer.tsx`**

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
    <div aria-label="audio player" role="region" className="space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        onTimeUpdate={handleTimeUpdate}
        className="w-full"
      />
      <SubtitleDisplay
        segments={segments}
        currentTime={currentTime}
        isTranscribing={isTranscribing}
      />
    </div>
  );
}
```

**Step 4: 執行確認通過**

```bash
cd frontend && npm test
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add frontend/src/components/AudioPlayer.tsx frontend/src/components/AudioPlayer.test.tsx
git commit -m "[Feature] 新增 AudioPlayer 組件"
```

---

## Task 10：App 整合

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`（清空，樣式全由 Tailwind 處理）
- Modify: `frontend/index.html`

**Step 1: 替換 `frontend/src/App.tsx`**

```typescript
import { useState } from "react";
import AudioUploader from "./components/AudioUploader";
import AudioPlayer from "./components/AudioPlayer";
import { useTranscription } from "./hooks/useTranscription";

export default function App() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { segments, isTranscribing, error } = useTranscription(taskId);

  const handleUploaded = (id: string, url: string) => {
    setTaskId(id);
    setAudioUrl(url);
  };

  return (
    <main className="max-w-2xl mx-auto px-6 py-10 font-sans">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">音檔字幕播放器</h1>
      <AudioUploader onUploaded={handleUploaded} />
      {error && (
        <p className="mb-4 text-red-500">轉錄錯誤：{error}</p>
      )}
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

**Step 2: 清空 `frontend/src/App.css`**

```css
/* 樣式由 Tailwind CSS 處理，見 index.css */
```

**Step 3: 修改 `frontend/index.html` 標題**

將 `<title>` 改為：

```html
<title>音檔字幕播放器</title>
```

**Step 4: 執行全部測試**

```bash
cd frontend && npm test
```

Expected: 全部 PASS

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.css frontend/index.html
git commit -m "[Feature] 整合 App 主頁面，完成上傳與字幕播放流程"
```

---

## 啟動前端

```bash
cd frontend
npm run dev
```

開啟 http://localhost:5173（確保後端已在 port 8000 啟動）
