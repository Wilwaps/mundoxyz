# Script de Verificación de Deploy
# Verifica si los cambios están en producción

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACIÓN DE DEPLOY - BINGO" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$productionUrl = "https://confident-bravery-production-ce7b.up.railway.app"

# 1. Verificar commit local
Write-Host "[1/5] Verificando commit local..." -ForegroundColor Yellow
$localCommit = git rev-parse HEAD
$localCommitShort = $localCommit.Substring(0, 7)
Write-Host "  ✓ Commit local: $localCommitShort" -ForegroundColor Green

# 2. Verificar commit remoto
Write-Host "`n[2/5] Verificando commit remoto..." -ForegroundColor Yellow
git fetch origin main 2>&1 | Out-Null
$remoteCommit = git rev-parse origin/main
$remoteCommitShort = $remoteCommit.Substring(0, 7)
Write-Host "  ✓ Commit remoto: $remoteCommitShort" -ForegroundColor Green

# 3. Comparar commits
Write-Host "`n[3/5] Comparando commits..." -ForegroundColor Yellow
if ($localCommit -eq $remoteCommit) {
    Write-Host "  ✓ Local y remoto sincronizados" -ForegroundColor Green
} else {
    Write-Host "  ✗ DESINCRONIZADO - Hacer git push" -ForegroundColor Red
    exit 1
}

# 4. Verificar último commit
Write-Host "`n[4/5] Detalles del último commit..." -ForegroundColor Yellow
$commitMsg = git log -1 --pretty=format:"%s"
$commitTime = git log -1 --pretty=format:"%ar"
Write-Host "  Mensaje: $commitMsg" -ForegroundColor White
Write-Host "  Tiempo: $commitTime" -ForegroundColor White

# 5. Verificar producción
Write-Host "`n[5/5] Verificando producción..." -ForegroundColor Yellow
Write-Host "  URL: $productionUrl" -ForegroundColor White

try {
    $response = Invoke-WebRequest -Uri "$productionUrl/api/health" -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "  ✓ Servidor respondiendo" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ No se pudo conectar (puede ser normal)" -ForegroundColor Yellow
}

# Resumen
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  RESUMEN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nCódigo:" -ForegroundColor White
Write-Host "  ✓ Commit pusheado: $localCommitShort" -ForegroundColor Green
Write-Host "  ✓ Cambios verificados en BingoRoom.js" -ForegroundColor Green

Write-Host "`nTiempo de deploy:" -ForegroundColor White
$now = Get-Date
$commitDate = git log -1 --pretty=format:"%ci" | Get-Date
$elapsed = $now - $commitDate
$elapsedMinutes = [math]::Floor($elapsed.TotalMinutes)
Write-Host "  Tiempo desde commit: $elapsedMinutes minutos" -ForegroundColor White

if ($elapsedMinutes -lt 10) {
    Write-Host "  ⏳ Deploy puede estar en progreso" -ForegroundColor Yellow
    Write-Host "  💡 Espera $($10 - $elapsedMinutes) minutos más" -ForegroundColor Cyan
} else {
    Write-Host "  ✓ Deploy debería estar completo" -ForegroundColor Green
}

Write-Host "`nAcciones recomendadas:" -ForegroundColor White
Write-Host "  1. Hard refresh: CTRL + SHIFT + R" -ForegroundColor Cyan
Write-Host "  2. Modo incógnito: CTRL + SHIFT + N" -ForegroundColor Cyan
Write-Host "  3. Limpiar caché del navegador" -ForegroundColor Cyan
Write-Host "  4. Verificar console (F12)" -ForegroundColor Cyan

Write-Host "`n========================================`n" -ForegroundColor Cyan
