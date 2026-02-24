# 開發規範（Python + React 通用）

> **使用方式**：撰寫任何 Python 或 React 程式碼前，Claude 必須閱讀對應章節，確認符合規範後再生成程式碼。

---

## 何時使用此文件

| 情境 | 必讀章節 |
|------|---------|
| 撰寫後端 Python / FastAPI 程式碼 | 一（通用）+ 二（Python） |
| 撰寫前端 React / TypeScript 程式碼 | 一（通用）+ 三（React） |
| Claude 生成任何程式碼 | 一（通用）+ 四（AI 流程） |

---

## 一、通用規範

> 適用所有語言與檔案，是所有章節的基礎。

### 1.1 程式碼設計原則

- **YAGNI**：只實作當下需要的功能，不為「未來可能」預先設計
- **單一職責**：每個函式 / 類別 / 組件只做一件事
- **最小修改原則**：修 bug 時只改最小範圍，不順手重構無關程式碼
- **不過度工程**：三行重複的程式碼優於過早抽象；抽象必須有兩個以上真實使用場景

### 1.2 命名慣例

| 語言 | 類別 | 函式 / 變數 | 常數 | 檔案 |
|------|------|------------|------|------|
| Python | `PascalCase` | `snake_case` | `UPPER_SNAKE` | `snake_case.py` |
| TypeScript | `PascalCase` | `camelCase` | `UPPER_SNAKE` | `PascalCase.tsx` / `camelCase.ts` |

- 命名應自解釋意圖，避免 `data`、`info`、`temp` 等模糊名稱
- 布林值以 `is_`、`has_`、`can_` 開頭（Python：`is_ready`；TS：`isReady`）
- 函式名稱以動詞開頭（`get_`、`create_`、`handle_`、`fetch_`）

### 1.3 禁止行為

- 禁止 Magic Number：`time.sleep(3)` → 改用具名常數 `RETRY_DELAY_SEC = 3`
- 禁止空 `except` / `catch`（沒有任何處理的吞掉例外）
- 禁止提交 `console.log` / `print` 除錯輸出（應使用 logger）
- 禁止直接 hardcode 敏感資訊（金鑰、密碼）

---

## 二、Python / FastAPI 規範

> **何時適用**：撰寫 `backend/` 目錄下任何 Python 程式碼時。

### 2.1 模組分層

```
backend/
├── main.py          # FastAPI 初始化 + CORS + router 掛載，不含業務邏輯
├── routers/         # 只負責 HTTP 路由：接收 request、呼叫 service、回傳 response
├── services/        # 業務邏輯：資料處理、外部服務呼叫（Whisper、DB 等）
├── schemas/         # Pydantic 輸入輸出模型（request body / response model）
└── models/          # ORM 資料庫模型（如有使用 DB）
```

**分層職責邊界**：

| 層次 | 允許 | 禁止 |
|------|------|------|
| `routers/` | 路由、request 解析、呼叫 service | 直接操作 DB 或外部 API |
| `services/` | 業務邏輯、外部呼叫 | 直接回傳 HTTP Response |
| `schemas/` | Pydantic 欄位定義與驗證 | 含業務邏輯 |

### 2.2 函式與類別規範

**Async 選擇原則**：

- 有 I/O 操作（HTTP、DB、檔案讀寫）→ 使用 `async def`
- 純計算邏輯 → 使用 `def`（避免不必要的 async overhead）
- 在 async context 呼叫同步阻塞函式 → 改用 `asyncio.to_thread()`

**Type Hints 規範**：

```python
# 正確：所有參數與回傳值皆有型別標注
async def get_transcript(task_id: str) -> list[Segment]:
    ...

# 錯誤：缺少型別標注
def process(data):
    ...
```

- 使用 `Optional[X]` 或 `X | None`（Python 3.10+），不用裸 `None` 預設
- 回傳多個值時優先用 Pydantic model 或 `TypedDict`，不用 bare `tuple`
- 函式長度建議不超過 30 行；超過時考慮拆分為子函式

**Pydantic 模型設計**：

```python
# Request schema：嚴格驗證，Field 加 description
class TranscribeRequest(BaseModel):
    language: str = Field(default="zh", description="語言代碼，如 zh、en")

# Response schema：明確欄位，不直接回傳 ORM 物件
class SegmentResponse(BaseModel):
    start: float
    end: float
    text: str
```

### 2.3 錯誤處理

**HTTP 例外格式**：

```python
from fastapi import HTTPException, status

# 正確：使用具名狀態碼 + 有意義的 detail
raise HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail=f"Task {task_id} not found"
)

# 錯誤：Magic number + 模糊訊息
raise HTTPException(status_code=404, detail="not found")
```

**例外捕捉原則**：

```python
# 正確：捕捉具體例外，並記錄 log
try:
    result = await whisper_service.transcribe(path)
except FileNotFoundError as e:
    logger.error("Audio file missing: %s", e)
    raise HTTPException(status_code=404, detail="音檔不存在")

# 錯誤：吞掉所有例外
try:
    ...
except Exception:
    pass
```

- 使用 `logging` 模組，不用 `print`
- Log level 規範：正常流程 `info`、預期外狀況 `warning`、系統錯誤 `error`

---

## 三、React / TypeScript 規範

> **何時適用**：撰寫 `frontend/src/` 目錄下任何 React / TypeScript 程式碼時。

### 3.1 組件設計原則

**單一職責**：

- 每個組件只做一件事；若組件超過 **200 行**，考慮拆分
- 資料取得邏輯放 hook，不放在組件本體
- 純展示組件（Presentational）與容器組件（Container）分離

**Props 規範**：

```tsx
// 正確：獨立 interface，清楚命名
interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

// 錯誤：直接 inline 或使用 any
const Component = ({ data }: { data: any }) => { ... }
```

- Props interface 名稱格式：`{ComponentName}Props`
- 回呼函式以 `on` 開頭：`onSubmit`、`onChange`、`onClose`
- 避免 prop drilling 超過 2 層，改用 Context 或提升狀態

### 3.2 Hooks 使用規範

**目錄與命名**：

```
frontend/src/hooks/
└── useTranscription.ts   # 自訂 hook 一律放此目錄，檔名 camelCase
```

- Hook 名稱必須以 `use` 開頭
- 每個 hook 只管理一個關注點（transcription、audio playback 等分開）

**使用限制**：

```tsx
// 正確：回傳物件，易於擴充
function useTranscription(taskId: string) {
  return { segments, isLoading, error };
}

// 錯誤：回傳陣列（超過 2 個值時難以維護）
function useTranscription(taskId: string) {
  return [segments, isLoading, error];
}
```

- `useEffect` 必須明確列出所有 dependencies，不允許省略
- 避免在 hook 內直接操作 DOM；需要時使用 `useRef`
- 非同步操作需處理 cleanup（取消 fetch、關閉 SSE）

### 3.3 TypeScript 型別規範

**禁止 `any`**：

```tsx
// 正確：明確型別
const handleEvent = (e: React.ChangeEvent<HTMLInputElement>) => { ... }

// 例外：第三方函式庫型別不完整時，加上 TODO 說明
const data = response as unknown as MyType; // TODO: 等待 @types/xxx 更新
```

**型別定義位置**：

| 種類 | 位置 |
|------|------|
| 跨組件共用型別 | `src/types.ts` |
| 單一組件專屬型別 | 組件檔案頂部 |
| API 回應型別 | `src/types.ts` 或 `src/api/types.ts` |

**`type` vs `interface` 選擇**：

```tsx
// 優先用 type（簡潔，支援 union）
type Status = "idle" | "loading" | "done" | "error";
type Segment = { start: number; end: number; text: string };

// 有繼承 / 實作需求時才用 interface
interface AudioPlayerProps extends BasePlayerProps {
  onEnd: () => void;
}
```

---

## 四、AI 輔助開發流程

> **適用對象**：Claude 生成任何程式碼時必須遵守。

### 4.1 生成前檢查清單

在生成程式碼前，Claude 必須確認：

- [ ] 已閱讀 `一、通用規範` 及對應語言章節
- [ ] 已閱讀 `CLAUDE.md` 中的功能設計文件（若正在實作特定功能）
- [ ] 了解現有程式碼風格（讀取相鄰檔案作為參考）

### 4.2 生成後自我 Review

生成程式碼後，Claude 必須自我確認：

| 檢查項目 | 說明 |
|---------|------|
| 命名是否符合規範 | snake_case / camelCase 是否正確 |
| 型別標注是否完整 | Python type hints、TS interface 是否齊全 |
| 有無引入不必要的複雜度 | 是否違反 YAGNI |
| 錯誤處理是否完整 | 有無裸 except / 空 catch |
| 是否有除錯輸出未清除 | print / console.log |

### 4.3 規範衝突處理

若遇到規範與實際情況衝突時：

1. **說明衝突原因**：清楚告知用戶哪條規範與需求衝突
2. **提出替代方案**：給出符合規範精神的變通做法
3. **詢問決策**：讓用戶決定是否允許此次例外，並在程式碼中加上 `# NOTE:` 說明

> 規範是為了提升程式碼品質，不是死板的限制。合理的例外應被明確記錄，而非悄悄繞過。
