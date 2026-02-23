# 前端開發脈絡

## 技術棧

- **框架：** React 18 + TypeScript
- **建置工具：** Vite
- **樣式：** Tailwind CSS v4（`@tailwindcss/vite` plugin）
- **測試：** Vitest + React Testing Library

## 常用指令

```bash
# 安裝依賴
npm install

# 啟動開發伺服器（port 5173，需後端在 8000）
npm run dev

# 執行所有測試
npm test

# 監聽模式測試
npm run test:watch
```

## 專案結構

```
frontend/src/
├── types.ts                        # 共用型別（Segment）
├── App.tsx                         # 根組件，串接所有子組件
├── index.css                       # @import "tailwindcss"
├── components/
│   ├── AudioUploader.tsx           # 拖曳/選擇上傳音檔
│   ├── AudioUploader.test.tsx
│   ├── AudioPlayer.tsx             # 播放器 + timeupdate 追蹤
│   ├── AudioPlayer.test.tsx
│   ├── SubtitleDisplay.tsx         # 根據 currentTime 顯示字幕
│   └── SubtitleDisplay.test.tsx
└── hooks/
    ├── useTranscription.ts         # EventSource SSE 字幕接收
    └── useTranscription.test.ts
```

## 樣式規範

- **所有樣式使用 Tailwind utility class**，不寫自訂 CSS
- 禁止使用 `style={{ }}` inline style
- 顏色以 Tailwind 色彩系統為主（`gray-*`, `blue-*` 等）

## 型別定義

```typescript
// types.ts
interface Segment {
  index: number;
  start: number;  // 秒
  end: number;    // 秒
  text: string;
}
```

## 字幕同步邏輯

```typescript
// SubtitleDisplay 核心邏輯
const active = segments.find((s) => currentTime >= s.start && currentTime <= s.end);
```

## API 合約（後端提供）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/upload` | 上傳音檔，回傳 task_id + audio_url |
| GET | `/api/audio/{task_id}` | 音檔二進位（用於 `<audio src>`） |
| GET | `/api/transcribe/{task_id}` | SSE 字幕串流 |

開發時 Vite proxy 自動將 `/api/*` 轉發到 `http://localhost:8000`。

## 實作計畫

`docs/plans/2026-02-23-audio-subtitle-frontend.md`
