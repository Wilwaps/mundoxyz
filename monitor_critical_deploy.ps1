# Script para monitorear el deploy crítico de Bingo
# Fecha: 31 Oct 2025

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MONITOREO DEPLOY CRITICO BINGO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Información del último commit
Write-Host "[1] Ultimo commit pusheado:" -ForegroundColor Yellow
$lastCommit = git log -1 --oneline
Write-Host "    $lastCommit" -ForegroundColor White
Write-Host ""

# Timer de espera
Write-Host "[2] Esperando deploy de Railway (6 minutos)..." -ForegroundColor Yellow
Write-Host "    Hora inicio: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray

# Esperar 360 segundos (6 minutos)
Start-Sleep -Seconds 360

Write-Host "    Hora fin: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

# Verificar health check
Write-Host "[3] Verificando servidor..." -ForegroundColor Yellow
$healthUrl = "https://confident-bravery-production-ce7b.up.railway.app/api/health"

try {
    $response = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "    Server respondiendo OK" -ForegroundColor Green
        $health = $response.Content | ConvertFrom-Json
        Write-Host "    Status: $($health.status)" -ForegroundColor White
        Write-Host "    Timestamp: $($health.timestamp)" -ForegroundColor White
    }
} catch {
    Write-Host "    ERROR: Servidor no responde" -ForegroundColor Red
    Write-Host "    Verifica Railway dashboard" -ForegroundColor Yellow
}
Write-Host ""

# Instrucciones para verificación manual
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACION EN RAILWAY LOGS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Busca estas lineas en Railway logs:" -ForegroundColor Yellow
Write-Host ""

Write-Host "[MIGRACIONES]" -ForegroundColor Cyan
Write-Host "  - 'Found X migration files'" -ForegroundColor White
Write-Host "  - 'Already executed: Y'" -ForegroundColor White
Write-Host "  - 'Pending: Z'" -ForegroundColor White
Write-Host "  - '000_create_migrations_table.sql completed successfully'" -ForegroundColor Green
Write-Host "  - '007_fix_marked_numbers_type.sql completed successfully'" -ForegroundColor Green
Write-Host "  - 'All migrations completed successfully'" -ForegroundColor Green
Write-Host ""

Write-Host "[JOBS]" -ForegroundColor Cyan
Write-Host "  - 'BingoRefundJob iniciado'" -ForegroundColor White
Write-Host "  - 'BingoCleanupJob iniciado'" -ForegroundColor White
Write-Host "  - 'BingoAbandonmentJob iniciado - cada 60 segundos'" -ForegroundColor Green
Write-Host ""

Write-Host "[CRITICAL]" -ForegroundColor Cyan
Write-Host "  - NO debe aparecer: 'BingoAbandonmentJob deshabilitado'" -ForegroundColor Red
Write-Host "  - NO debe aparecer: 'Error in 006_bingo_host_abandonment'" -ForegroundColor Red
Write-Host ""

# Instrucciones para prueba completa
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PRUEBA COMPLETA DEL FLUJO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Crear sala de Bingo:" -ForegroundColor Yellow
Write-Host "   - 2 jugadores, 1 carton, 1 fuego, linea" -ForegroundColor White
Write-Host ""

Write-Host "2. Iniciar partida y cantar numeros" -ForegroundColor Yellow
Write-Host ""

Write-Host "3. Marcar numeros hasta completar linea" -ForegroundColor Yellow
Write-Host ""

Write-Host "4. Al aparecer modal BINGO, presionar boton" -ForegroundColor Yellow
Write-Host ""

Write-Host "5. VERIFICAR:" -ForegroundColor Yellow
Write-Host "   - Modal de celebracion aparece" -ForegroundColor Green
Write-Host "   - Muestra ganador y premio" -ForegroundColor Green
Write-Host "   - Boton Aceptar funciona" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LOGS A BUSCAR SI FALLA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "En Railway logs buscar:" -ForegroundColor Yellow
Write-Host "  - 'CALL BINGO INICIADO'" -ForegroundColor White
Write-Host "  - 'DATOS DEL CARTON'" -ForegroundColor White
Write-Host "  - 'Marked Numbers IsArray: true'" -ForegroundColor Green
Write-Host "  - 'Marked Numbers Count: 5'" -ForegroundColor Green
Write-Host "  - 'VALIDACION Resultado: VALIDO'" -ForegroundColor Green
Write-Host "  - 'BINGO VALIDO - GANADOR'" -ForegroundColor Green
Write-Host "  - '[SOCKET] Emitiendo bingo:game_over'" -ForegroundColor Green
Write-Host ""

Write-Host "En Console del navegador (F12):" -ForegroundColor Yellow
Write-Host "  - '[FRONTEND] Evento game_over RECIBIDO'" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FIN DEL MONITOREO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
