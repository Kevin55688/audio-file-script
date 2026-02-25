Set-Location (Join-Path $PSScriptRoot "..\frontend")
Write-Host "[Frontend] Starting Vite on http://localhost:5173 ..." -ForegroundColor Cyan

try {
    npm run dev
} finally {
    Write-Host "`n[Frontend] Cleaning up port 5173..." -ForegroundColor Yellow
    $pids = (netstat -ano) |
        Select-String ':5173' |
        Where-Object { $_ -match 'LISTENING' } |
        ForEach-Object { ($_.ToString().Trim() -split '\s+')[-1] } |
        Sort-Object -Unique

    foreach ($p in $pids) {
        if ($p -match '^\d+$') {
            Write-Host "[Frontend] Killing PID $p (+ children)..."
            taskkill /T /F /PID $p 2>$null
        }
    }
    Write-Host "[Frontend] Done." -ForegroundColor Green
}
