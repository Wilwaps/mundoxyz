Write-Host "FIX APLICADO - Esperando deploy Railway..." -ForegroundColor Yellow
Write-Host "Commit: 98085e8 fix columna owner_id" -ForegroundColor White
Write-Host ""
Write-Host "Esperando 6 minutos..." -ForegroundColor Gray
Start-Sleep -Seconds 360
Write-Host ""
Write-Host "Verificando servidor..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -TimeoutSec 10
    Write-Host "SERVIDOR RESPONDIENDO" -ForegroundColor Green
    Write-Host "Status: $($health.status)" -ForegroundColor White
} catch {
    Write-Host "SERVIDOR NO RESPONDE - Revisar Railway logs" -ForegroundColor Red
}
Write-Host ""
Write-Host "BUSCAR EN RAILWAY LOGS:" -ForegroundColor Cyan
Write-Host "  - '007_fix_marked_numbers_type.sql completed successfully'" -ForegroundColor Green
Write-Host "  - 'All migrations completed successfully'" -ForegroundColor Green
Write-Host "  - 'BingoAbandonmentJob iniciado'" -ForegroundColor Green
