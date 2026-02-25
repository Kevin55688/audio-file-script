# 專案狀態摘要

**最後更新：** 2026-02-25（完成 Task 10：App 整合）

---

## 專案概述

**音檔字幕播放器** — 使用者上傳 MP3/WAV 音檔後，以 faster-whisper AI 語音辨識產生字幕，並在播放時同步顯示字幕。

**技術棧：** FastAPI (Python) + React 18 + TypeScript + Tailwind CSS v4 + faster-whisper + SSE

---

## 整體進度：Task 8/10 完成

---

## 待完成項目

### 後端（`backend/`）
- [ ] Task 4：SSE 字幕串流端點（GET /api/transcribe/{task_id}）

---

## 已完成項目

- ✅ Task 1：後端專案初始化（目錄結構 + requirements.txt + main.py，Python 3.11 conda 環境 `audio-subtitle`）
- ✅ Task 5：前端專案初始化 + Tailwind CSS v4 設定（含 Warm Archive 設計主題）
- ✅ Task 6：共用型別（types.ts）+ SubtitleDisplay 組件（電影字幕風格）
- ✅ Task 7：useTranscription SSE Hook
- ✅ Task 8：AudioUploader 組件（波形動畫 + 拖曳上傳）
- ✅ Task 2：音檔上傳與服務端點（POST /api/upload、GET /api/audio/{task_id}）
- ✅ Task 9：AudioPlayer 組件（Warm Archive 設計 + SubtitleDisplay 整合）
- ✅ Task 3：Whisper 轉錄服務（whisper_service.py）
- ✅ Task 10：App 整合（Warm Archive 頁面設計 + 組件串接）

---

## 開發規範

- 通用規範、Python/FastAPI 規範、React/TypeScript 規範、AI 輔助流程詳見 `.claude/skills.md`

---

## 重要決策與架構

- 即時推送採用 SSE（Server-Sent Events），不用 WebSocket
- faster-whisper 使用 small model + int8 量化，CPU 可執行
- 前端 Tailwind CSS 採用 v4（Vite plugin 方式整合，`@import "tailwindcss"`）
- 轉錄完成後刪除 temp/ 暫存音檔
- 前端 UI 採用 **Warm Archive** 設計主題：暖棕黑底色 + 琥珀金強調色 + DM Serif Display / Outfit / Space Mono 字型
- `<input type="file">` 不使用 `accept` 屬性（user-event v14.6.1 的 `applyAccept` 預設為 `true`，會攔截非音訊格式的測試檔案）；格式驗證交由後端處理
