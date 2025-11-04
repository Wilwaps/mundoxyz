# Script para verificar estado del deploy en Railway

Write-Host "=== VERIFICACIÓN DEPLOY RAILWAY ===" -ForegroundColor Cyan
Write-Host ""

# 1. Último commit local
Write-Host "1. Último commit local:" -ForegroundColor Yellow
$lastCommit = git log -1 --oneline
Write-Host "   $lastCommit" -ForegroundColor White
Write-Host ""

# 2. Hora del commit
Write-Host "2. Fecha del último commit:" -ForegroundColor Yellow
$commitDate = git log -1 --date=format:'%Y-%m-%d %H:%M:%S' --format='%ad'
Write-Host "   $commitDate" -ForegroundColor White
Write-Host ""

# 3. Verificar si está pusheado
Write-Host "3. Estado de push:" -ForegroundColor Yellow
$status = git status -sb
Write-Host "   $status" -ForegroundColor White
Write-Host ""

# 4. Verificar salud del servidor
Write-Host "4. Verificando servidor..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -Method Get
    Write-Host "   Status: $($health.status)" -ForegroundColor Green
    Write-Host "   Timestamp: $($health.timestamp)" -ForegroundColor White
    Write-Host "   Version: $($health.version)" -ForegroundColor White
} catch {
    Write-Host "   ERROR: No se pudo conectar al servidor" -ForegroundColor Red
}
Write-Host ""

# 5. Verificar archivo crítico
Write-Host "5. Verificando fix en código local:" -ForegroundColor Yellow
$fixLine = Select-String -Path "backend/services/bingoService.js" -Pattern "if \(typeof markedNumbers === 'string'\)" -Context 0,3
if ($fixLine) {
    Write-Host "   ✅ FIX PRESENTE en código local" -ForegroundColor Green
    Write-Host "   Línea: $($fixLine.LineNumber)" -ForegroundColor White
} else {
    Write-Host "   ❌ FIX NO ENCONTRADO" -ForegroundColor Red
}
Write-Host ""

# 6. Hora actual
Write-Host "6. Hora actual:" -ForegroundColor Yellow
$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "   $now" -ForegroundColor White
Write-Host ""

# 7. Tiempo transcurrido
Write-Host "7. Tiempo desde último commit:" -ForegroundColor Yellow
$commitDateObj = git log -1 --date=iso --format='%ad' | ForEach-Object { [DateTime]::Parse($_) }
$timeElapsed = (Get-Date) - $commitDateObj
Write-Host "   $($timeElapsed.Hours) horas, $($timeElapsed.Minutes) minutos" -ForegroundColor White
Write-Host ""

Write-Host "=== INSTRUCCIONES ===" -ForegroundColor Cyan
Write-Host "Si el servidor esta up pero el fix no funciona:" -ForegroundColor Yellow
Write-Host "1. Railway puede tener el deploy antiguo" -ForegroundColor White
Write-Host "2. Puede haber cache del navegador" -ForegroundColor White
Write-Host "3. Puede haber otro bug ademas del parseo" -ForegroundColor White
Write-Host ""
Write-Host "Para forzar redeploy:" -ForegroundColor Yellow
Write-Host "1. Ir a Railway dashboard" -ForegroundColor White
Write-Host "2. Ver Deployments" -ForegroundColor White
Write-Host "3. Verificar que el hash sea f7c3340" -ForegroundColor White
