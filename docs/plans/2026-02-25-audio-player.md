# AudioPlayer 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立 AudioPlayer 組件，整合原生 `<audio>` 播放器與 SubtitleDisplay，在播放時根據 currentTime 同步顯示對應字幕。

**Architecture:** AudioPlayer 持有 `useRef<HTMLAudioElement>` 與 `useState<number>(0)` 追蹤 currentTime；`onTimeUpdate` 事件更新 state 後傳入 SubtitleDisplay 做段落比對。容器採 Warm Archive 設計（深色圓角卡 + 琥珀金頂邊線），與現有組件視覺一致。

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Vitest, React Testing Library

**工作目錄:** `frontend/`

---

## API 合約（供參考）

AudioPlayer 接收由 App.tsx 傳入的 props：
- `audioUrl` — 來自 `POST /api/upload` 回傳的 `/api/audio/{task_id}`
- `segments` — 來自 `useTranscription` hook 的 SSE 累積結果
- `isTranscribing` — 是否仍在轉錄中

---

## Task 9：AudioPlayer 組件

**Files:**
- Create: `frontend/src/components/AudioPlayer.test.tsx`
- Create: `frontend/src/components/AudioPlayer.tsx`

---

### Step 1：建立測試檔案

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

---

### Step 2：執行測試確認失敗

```bash
cd frontend && npm test
```

Expected: FAIL — `Cannot find module './AudioPlayer'`

---

### Step 3：建立 AudioPlayer 組件

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
    <div
      aria-label="audio player"
      role="region"
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: "#1A1814" }}
    >
      {/* 琥珀金頂邊線 */}
      <div
        aria-hidden="true"
        style={{ height: "1px", backgroundColor: "rgba(232,168,68,0.25)" }}
      />
      {/* 播放器區 */}
      <div className="px-4 pt-4 pb-2">
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          onTimeUpdate={handleTimeUpdate}
          className="w-full"
        />
      </div>
      {/* 字幕區 */}
      <SubtitleDisplay
        segments={segments}
        currentTime={currentTime}
        isTranscribing={isTranscribing}
      />
    </div>
  );
}
```

---

### Step 4：執行測試確認通過

```bash
cd frontend && npm test
```

Expected: 全部 PASS（包含既有測試）

---

### Step 5：Commit

```bash
git add frontend/src/components/AudioPlayer.tsx frontend/src/components/AudioPlayer.test.tsx
git commit -m "[Feature] 新增 AudioPlayer 組件（Warm Archive 設計）"
```

---

### Step 6：更新 SUMMARY.md

將 `Task 9：AudioPlayer 組件` 從待辦清單移除，更新「最後更新」日期。

---

## 執行完成後

接續執行 **Task 10：App 整合**（詳見 `docs/plans/2026-02-23-audio-subtitle-frontend.md`）。
