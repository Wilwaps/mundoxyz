Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FIX MODAL CELEBRACION BINGO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[CAMBIOS APLICADOS]" -ForegroundColor Yellow
Write-Host "1. Socket backend con callbacks" -ForegroundColor White
Write-Host "2. Frontend maneja respuestas" -ForegroundColor White
Write-Host "3. Modal con timeout de 100ms" -ForegroundColor White
Write-Host ""

Write-Host "Esperando deploy (6 minutos)..." -ForegroundColor Gray
$startTime = Get-Date
Start-Sleep -Seconds 360
$endTime = Get-Date
$duration = $endTime - $startTime
Write-Host "Tiempo transcurrido: $($duration.TotalMinutes) minutos" -ForegroundColor Gray
Write-Host ""

Write-Host "[VERIFICACION]" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -TimeoutSec 10
    Write-Host "✅ Servidor respondiendo" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor White
} catch {
    Write-Host "❌ Servidor no responde" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PRUEBA COMPLETA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Crear sala de Bingo" -ForegroundColor Yellow
Write-Host "   - 2 jugadores, modo línea" -ForegroundColor White
Write-Host ""

Write-Host "2. Jugar hasta completar línea" -ForegroundColor Yellow
Write-Host ""

Write-Host "3. Al aparecer modal BINGO:" -ForegroundColor Yellow
Write-Host "   - Presionar botón ¡BINGO!" -ForegroundColor White
Write-Host ""

Write-Host "4. VERIFICAR:" -ForegroundColor Yellow
Write-Host "   ✅ Modal se cierra" -ForegroundColor Green
Write-Host "   ✅ Toast 'Validando...'" -ForegroundColor Green
Write-Host "   ✅ Modal celebración aparece (después de 100ms)" -ForegroundColor Green
Write-Host "   ✅ Muestra ganador y premio" -ForegroundColor Green
Write-Host "   ✅ Botón Aceptar funciona" -ForegroundColor Green
Write-Host ""

Write-Host "[EN CONSOLA F12]" -ForegroundColor Cyan
Write-Host "Buscar estos logs:" -ForegroundColor Yellow
Write-Host "  - [FRONTEND] Emitiendo bingo:call_bingo" -ForegroundColor White
Write-Host "  - [FRONTEND] Respuesta de bingo:call_bingo" -ForegroundColor White
Write-Host "  - [FRONTEND] Evento bingo:game_over recibido" -ForegroundColor White
Write-Host "  - [FRONTEND] Modal de celebración activado" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FIN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
