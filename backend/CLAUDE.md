# 後端開發脈絡

## 技術棧

- **框架：** FastAPI 0.115
- **AI 轉錄：** faster-whisper（small model，CPU + int8）
- **測試：** pytest + httpx TestClient
- **Python：** 3.10+

## 常用指令

```bash
# 安裝依賴
pip install -r requirements.txt

# 啟動開發伺服器（port 8000）
uvicorn main:app --reload

# 執行所有測試（須在 backend/ 目錄執行）
pytest tests/ -v

# 執行單一測試檔
pytest tests/test_upload.py -v
```

## 專案結構

```
backend/
├── main.py                    # FastAPI app + CORS 設定
├── routers/
│   └── transcribe.py          # 所有 API 路由（上傳、音檔、SSE）
├── services/
│   └── whisper_service.py     # faster-whisper 轉錄邏輯
├── tests/
│   ├── test_upload.py         # 上傳與音檔服務端點測試
│   ├── test_whisper_service.py# 轉錄服務單元測試（mock model）
│   └── test_sse.py            # SSE 串流端點測試
└── temp/                      # 暫存音檔（轉錄完後刪除）
```

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/upload` | 上傳 MP3/WAV，回傳 task_id |
| GET | `/api/audio/{task_id}` | 取得音檔二進位 |
| GET | `/api/transcribe/{task_id}` | SSE 串流字幕 |

## SSE 格式

```
# 每個字幕段落
data: {"index": 0, "start": 0.0, "end": 3.5, "text": "字幕文字"}\n\n

# 轉錄完成
data: {"status": "done"}\n\n

# 轉錄錯誤
data: {"status": "error", "message": "..."}\n\n
```

## 注意事項

- Whisper model 首次執行時自動下載（約 500MB），後續快取在本機
- 測試中 mock `services.whisper_service.model`，不會真正執行轉錄
- temp/ 目錄中的音檔為測試殘留，可手動清除

## 實作計畫

`docs/plans/2026-02-23-audio-subtitle-backend.md`
