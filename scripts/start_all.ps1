$root = Split-Path $PSScriptRoot -Parent
$pythonExe = "C:\Users\utafy\anaconda3\envs\audio-subtitle\python.exe"

Write-Host "=== Audio Subtitle Player ===" -ForegroundColor Magenta
Write-Host "[1/2] Backend  → http://localhost:8000" -ForegroundColor Cyan
Write-Host "[2/2] Frontend → http://localhost:5173" -ForegroundColor Cyan
Write-Host "Close this window to stop all services." -ForegroundColor Yellow
Write-Host ""

$backend = Start-Process $pythonExe -ArgumentList "-m", "uvicorn", "main:app", "--reload", "--port", "8000" `
    -WorkingDirectory "$root\backend" -PassThru -NoNewWindow

$frontend = Start-Process cmd -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory "$root\frontend" -PassThru -NoNewWindow

try {
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:5173"

    while (-not $backend.HasExited -and -not $frontend.HasExited) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`nStopping all services..." -ForegroundColor Yellow

    foreach ($p in @($backend, $frontend)) {
        if ($p -and -not $p.HasExited) {
            taskkill /T /F /PID $p.Id 2>$null
        }
    }

    foreach ($port in @(8000, 5173)) {
        $pids = (netstat -ano) |
            Select-String ":$port" |
            Where-Object { $_ -match 'LISTENING' } |
            ForEach-Object { ($_.ToString().Trim() -split '\s+')[-1] }
        foreach ($p in $pids) {
            if ($p -match '^\d+$') { taskkill /T /F /PID $p 2>$null }
        }
    }

    Write-Host "All stopped." -ForegroundColor Green
}
