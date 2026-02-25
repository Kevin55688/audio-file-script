$pythonExe = "C:\Users\utafy\anaconda3\envs\audio-subtitle\python.exe"
Set-Location (Join-Path $PSScriptRoot "..\backend")
Write-Host "[Backend] Starting uvicorn on http://localhost:8000 ..." -ForegroundColor Cyan

try {
    & $pythonExe -m uvicorn main:app --reload --port 8000
} finally {
    Write-Host "`n[Backend] Cleaning up port 8000..." -ForegroundColor Yellow
    $pids = (netstat -ano) |
        Select-String '(0\.0\.0\.0|127\.0\.0\.1|\[::1?\]):8000' |
        Where-Object { $_ -match 'LISTENING' } |
        ForEach-Object { ($_.ToString().Trim() -split '\s+')[-1] } |
        Sort-Object -Unique

    foreach ($p in $pids) {
        if ($p -match '^\d+$') {
            Write-Host "[Backend] Killing PID $p (+ children)..."
            taskkill /T /F /PID $p 2>$null
        }
    }
    Write-Host "[Backend] Done." -ForegroundColor Green
}
