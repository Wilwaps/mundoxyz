Write-Host "=== DIAGNÓSTICO RAILWAY ===" -ForegroundColor Cyan

# Test Backend
try {
    $backend = Invoke-WebRequest -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -UseBasicParsing -TimeoutSec 10
    Write-Host "Backend: $($backend.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Backend: ERROR - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Frontend
try {
    $frontend = Invoke-WebRequest -Uri "https://confident-bravery-production-ce7b.up.railway.app/" -UseBasicParsing -TimeoutSec 10
    Write-Host "Frontend: $($frontend.StatusCode)" -ForegroundColor Green
    
    if ($frontend.Content -match "entry_price_fire") {
        Write-Host "ERROR: Frontend con código antiguo" -ForegroundColor Red
    } else {
        Write-Host "OK: No hay errores de entry_price_fire" -ForegroundColor Green
    }
} catch {
    Write-Host "Frontend: ERROR - $($_.Exception.Message)" -ForegroundColor Red
}

# Test Raffles Lobby
try {
    $raffles = Invoke-WebRequest -Uri "https://confident-bravery-production-ce7b.up.railway.app/raffles/lobby" -UseBasicParsing -TimeoutSec 10
    Write-Host "Raffles Lobby: $($raffles.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Raffles Lobby: ERROR - $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "=== FIN DIAGNÓSTICO ===" -ForegroundColor Cyan
