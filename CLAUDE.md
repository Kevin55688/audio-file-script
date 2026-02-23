# Claude Code 專案指引

## 啟動流程（每次新 Session 必讀）

1. **閱讀專案狀態**：讀取 `.claude/SUMMARY.md` 了解專案整體狀態與待辦事項
2. **確認工作項目**：根據 SUMMARY 中的待辦清單，詢問使用者要處理哪個項目

> **注意**：HISTORY.md 僅在需要查詢歷史細節時才讀取，平時不必載入以節省 token

## 程式碼規範（生成程式碼前必讀）

**重要**：在撰寫或修改任何程式碼之前，必須遵循 `.claude/skills.md` 中定義的開發規範，包括：

詳細規範請參閱：[`.claude/skills.md`](.claude/skills.md)

## 功能開發計畫（開發前必讀）

開發以下功能時，**必須先讀取對應的設計文件**：

| 功能 | 設計文件 | 後端計畫 | 前端計畫 |
|------|---------|---------|---------|
| 音檔字幕播放器 | `docs/plans/2026-02-23-audio-subtitle-design.md` | `docs/plans/2026-02-23-audio-subtitle-backend.md` | `docs/plans/2026-02-23-audio-subtitle-frontend.md` |

**開發流程**：

1. 讀取設計文件，了解架構與 API 合約
2. 後端 session 讀取後端計畫、前端 session 讀取前端計畫，按 Task 順序執行（TDD 流程）
3. 完成後更新設計文件中的狀態（⏳ → ✅）

## 任務完成檢查（每次任務結束必做）

⚠️ **在回報「完成」之前，必須確認：**

1. [ ] 已更新 `.claude/HISTORY.md`（新增本次變更紀錄）
2. [ ] 已更新 `.claude/SUMMARY.md`（**每完成一個 Task 都必須立即更新**，不等用戶提醒）
3. 確認程式碼是否有符合設計規範

**SUMMARY.md 更新內容（每個 Task 完成後）：**
- 將該 Task 從 `[ ]` 改為 `[x]`，並移至「已完成項目」清單（含日期）
- 更新專案狀態標題（例：Task 3/12 完成）
- 更新「最後更新」日期

**Commit 順序規定：**

> ⚠️ **必須先更新 SUMMARY.md，再執行 git commit。**
> 不可先 commit 程式碼、再更新 SUMMARY.md，否則會產生額外的 chore commit。
> 正確順序：測試通過 → 更新 SUMMARY.md → `git add`（含 SUMMARY.md）→ `git commit`

**無論任務大小（包含 bug 修復、緊急修復），都必須執行此檢查。**

> 這是強制性流程，不可跳過。若忘記執行，用戶有權要求補做。

## Session 結束流程

每次對話結束或完成重要工作後，必須更新以下檔案：

### 1. 更新 `.claude/HISTORY.md`

在檔案**最上方**新增一筆紀錄，格式如下：

> **時間格式**：使用台北時間 (UTC+8)，24 小時制

```markdown
## [YYYY-MM-DD HH:mm] @開發者名稱

### 處理項目

- 項目名稱或任務描述

### 實作方式

- 具體做了什麼
- 修改了哪些檔案
- 使用了什麼技術或方法

### 變更檔案

- `path/to/file1.ts` - 變更說明
- `path/to/file2.tsx` - 變更說明

---
```

### 2. 更新 `.claude/SUMMARY.md`

更新專案狀態摘要：

- 專案當前狀態
- 已完成項目清單（含日期，作為長期紀錄）
- 待完成項目清單
- 重要決策與架構變更

### 3. 歸檔機制（當 HISTORY.md 超過 15 筆）

當 HISTORY.md 紀錄超過 15 筆時，執行歸檔：

1. 保留最近 10 筆在 `HISTORY.md`
2. 將較舊的紀錄移至 `.claude/archive/HISTORY-YYYY-MM.md`
3. 確保 SUMMARY.md 已包含被歸檔項目的摘要

```
.claude/
├── SUMMARY.md          # 必讀 - 專案狀態摘要
├── HISTORY.md          # 最近 10-15 筆紀錄
└── archive/
    └── HISTORY-YYYY-MM.md  # 歸檔紀錄
```

## 多人協作規範

## 專案特定規範

### 技術棧

- **後端**：Python 3.10+ / FastAPI 0.115 / faster-whisper（small, int8, CPU）
- **前端**：React 18 + TypeScript / Vite / Tailwind CSS v4
- **測試**：pytest + httpx TestClient / Vitest + React Testing Library
- **即時推送**：Server-Sent Events（SSE）

### 專案結構

```
audio-file-script/
├── backend/              # Python FastAPI 後端
│   ├── CLAUDE.md         # 後端 session 脈絡（自動載入）
│   ├── main.py           # FastAPI 入口 + CORS
│   ├── routers/
│   │   └── transcribe.py # 上傳、音檔、SSE 字幕端點
│   ├── services/
│   │   └── whisper_service.py  # faster-whisper 轉錄邏輯
│   ├── tests/            # pytest 測試
│   ├── temp/             # 暫存音檔（轉錄後刪除）
│   └── requirements.txt
├── frontend/             # React + Vite 前端
│   ├── CLAUDE.md         # 前端 session 脈絡（自動載入）
│   ├── src/
│   │   ├── types.ts              # 共用型別（Segment）
│   │   ├── App.tsx
│   │   ├── index.css             # @import "tailwindcss"
│   │   ├── components/           # AudioUploader, AudioPlayer, SubtitleDisplay
│   │   └── hooks/
│   │       └── useTranscription.ts  # SSE 字幕接收 hook
│   └── package.json
├── docs/plans/           # 設計與實作文件
└── .claude/              # Claude Code 設定與紀錄
```

### 程式碼風格

- Python：遵循 PEP 8
- TypeScript：React 函式元件 + Hooks

### 前端設計規範

**設計任何前端 UI 之前，必須遵循以下流程：**

1. 使用 `frontend-design:frontend-design` skill 進行 UI 設計（產生高品質、有特色的介面）
2. 所有樣式一律使用 **Tailwind CSS**，不使用 inline style 或額外 CSS 檔案
3. 技術棧：React + TypeScript + Tailwind CSS

> ⚠️ **強制規定**：前端 UI 設計前必須呼叫 `frontend-design` skill，不可跳過。
