# 專案狀態摘要

**最後更新：** 2026-02-24

---

## 專案概述

**音檔字幕播放器** — 使用者上傳 MP3/WAV 音檔後，以 faster-whisper AI 語音辨識產生字幕，並在播放時同步顯示字幕。

**技術棧：** FastAPI (Python) + React 18 + TypeScript + Tailwind CSS v4 + faster-whisper + SSE

---

## 整體進度：Task 1/10 完成（前端）

---

## 待完成項目

### 後端（`backend/`）
- [ ] Task 1：專案初始化（建立目錄結構 + requirements.txt + main.py）
- [ ] Task 2：音檔上傳與服務端點（POST /api/upload、GET /api/audio/{task_id}）
- [ ] Task 3：Whisper 轉錄服務（whisper_service.py）
- [ ] Task 4：SSE 字幕串流端點（GET /api/transcribe/{task_id}）

### 前端（`frontend/`）
- [ ] Task 6：共用型別 + SubtitleDisplay 組件
- [ ] Task 7：useTranscription Hook（SSE 接收）
- [ ] Task 8：AudioUploader 組件
- [ ] Task 9：AudioPlayer 組件
- [ ] Task 10：App 整合

---

## 已完成項目

- ✅ Task 5：前端專案初始化 + Tailwind CSS v4 設定（含 Warm Archive 設計主題）

---

## 重要決策與架構

- 即時推送採用 SSE（Server-Sent Events），不用 WebSocket
- faster-whisper 使用 small model + int8 量化，CPU 可執行
- 前端 Tailwind CSS 採用 v4（Vite plugin 方式整合，`@import "tailwindcss"`）
- 轉錄完成後刪除 temp/ 暫存音檔
- 前端 UI 採用 **Warm Archive** 設計主題：暖棕黑底色 + 琥珀金強調色 + DM Serif Display / Outfit / Space Mono 字型
