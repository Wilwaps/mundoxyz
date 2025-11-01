Write-Host ""
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "  FIX DEFINITIVO - validateWinningPattern" -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "[FIX APLICADO]" -ForegroundColor Yellow
Write-Host "Commit: 2c4e32d" -ForegroundColor Green
Write-Host "Corregido acceso grid[row][col] en validateWinningPattern" -ForegroundColor Green
Write-Host ""

Write-Host "Esperando deploy (6 minutos)..." -ForegroundColor Gray
Start-Sleep -Seconds 360
Write-Host ""

Write-Host "[VERIFICACION]" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -TimeoutSec 10
    Write-Host "Servidor OK" -ForegroundColor Green
} catch {
    Write-Host "Servidor no responde" -ForegroundColor Red
}
Write-Host ""

Write-Host "PRUEBA:" -ForegroundColor Yellow
Write-Host "1. Crear sala Bingo" -ForegroundColor White
Write-Host "2. Completar linea" -ForegroundColor White
Write-Host "3. Presionar BINGO" -ForegroundColor White
Write-Host "4. VERIFICAR: Modal de celebracion aparece" -ForegroundColor Green
Write-Host ""

Write-Host "========================================================" -ForegroundColor Magenta
