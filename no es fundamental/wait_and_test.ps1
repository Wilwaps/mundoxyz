Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DEPLOY CON LOGS EXHAUSTIVOS - RASTREO COMPLETO" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "[COMMIT]" -ForegroundColor Yellow
Write-Host "a4f6772 - logs exhaustivos para rastrear flujo completo" -ForegroundColor White
Write-Host ""

Write-Host "[OBJETIVO]" -ForegroundColor Yellow
Write-Host "Identificar EXACTAMENTE donde falla el modal de celebracion" -ForegroundColor White
Write-Host ""

Write-Host "Esperando deploy (6 minutos)..." -ForegroundColor Gray
$start = Get-Date
Start-Sleep -Seconds 360
$end = Get-Date
$duration = ($end - $start).TotalMinutes
Write-Host "Tiempo transcurrido: $([Math]::Round($duration, 2)) minutos" -ForegroundColor Gray
Write-Host ""

Write-Host "[SERVIDOR]" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -TimeoutSec 10
    Write-Host "✅ Respondiendo" -ForegroundColor Green
    Write-Host "   Status: $($response.status)" -ForegroundColor White
} catch {
    Write-Host "❌ No responde" -ForegroundColor Red
}
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  INSTRUCCIONES PARA LA PRUEBA" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. PREPARACION:" -ForegroundColor Yellow
Write-Host "   - Abrir F12 en el navegador" -ForegroundColor White
Write-Host "   - Abrir Railway logs" -ForegroundColor White
Write-Host "   - Limpiar ambas consoles" -ForegroundColor White
Write-Host ""

Write-Host "2. PRUEBA:" -ForegroundColor Yellow
Write-Host "   - Crear sala de Bingo" -ForegroundColor White
Write-Host "   - Jugar hasta completar linea" -ForegroundColor White
Write-Host "   - Presionar boton BINGO" -ForegroundColor White
Write-Host ""

Write-Host "3. LOGS A BUSCAR EN CONSOLE (F12):" -ForegroundColor Yellow
Write-Host ""
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "   📤 EMITIENDO CALL_BINGO" -ForegroundColor White
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "   📨 RESPUESTA DE CALL_BINGO" -ForegroundColor White
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "   🏆🏆🏆 GAME_OVER RECIBIDO EN FRONTEND" -ForegroundColor Green
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "   🎉 MODAL DE CELEBRACION ACTIVADO" -ForegroundColor Green
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

Write-Host "4. LOGS A BUSCAR EN RAILWAY:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "   🏆 PREPARANDO EMISION DE GAME_OVER" -ForegroundColor White
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host "   ✅ GAME_OVER EMITIDO" -ForegroundColor Green
Write-Host "   ════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

Write-Host "5. SI FALLA:" -ForegroundColor Red
Write-Host "   - Capturar pantalla de Console (F12)" -ForegroundColor White
Write-Host "   - Capturar pantalla de Railway logs" -ForegroundColor White
Write-Host "   - Reportar donde se detuvo el flujo" -ForegroundColor White
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Lee PRUEBA_CON_LOGS_EXHAUSTIVOS.md para mas detalles" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
