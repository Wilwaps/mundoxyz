Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  FIX CRITICO - CARTON BINGO" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

Write-Host "[PROBLEMA]" -ForegroundColor Yellow
Write-Host "Carton mostraba numeros invalidos (155, 209, etc.)" -ForegroundColor White
Write-Host ""

Write-Host "[CAUSA]" -ForegroundColor Yellow
Write-Host "Iteracion incorrecta: trataba filas como columnas" -ForegroundColor White
Write-Host ""

Write-Host "[SOLUCION]" -ForegroundColor Yellow
Write-Host "Corregida iteracion del grid en BingoCard.js" -ForegroundColor White
Write-Host "- grid.map((row, rowIndex) => row.map((cellData, colIndex) =>)" -ForegroundColor Green
Write-Host ""

Write-Host "Commit: 78e0f90" -ForegroundColor White
Write-Host ""

Write-Host "Esperando deploy (6 minutos)..." -ForegroundColor Gray
Start-Sleep -Seconds 360
Write-Host ""

Write-Host "[VERIFICACION]" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health" -TimeoutSec 10
    Write-Host "Server OK" -ForegroundColor Green
} catch {
    Write-Host "Server no responde" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PRUEBA DEL CARTON" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Crear sala de Bingo" -ForegroundColor Yellow
Write-Host ""

Write-Host "2. VERIFICAR CARTON:" -ForegroundColor Yellow
Write-Host ""

Write-Host "   Columna B: numeros del 1 al 15" -ForegroundColor White
Write-Host "   Columna I: numeros del 16 al 30" -ForegroundColor White
Write-Host "   Columna N: numeros del 31 al 45 (con FREE en centro)" -ForegroundColor White
Write-Host "   Columna G: numeros del 46 al 60" -ForegroundColor White
Write-Host "   Columna O: numeros del 61 al 75" -ForegroundColor White
Write-Host ""

Write-Host "3. CONFIRMAR:" -ForegroundColor Yellow
Write-Host "   - NO hay numeros mayores a 75" -ForegroundColor Green
Write-Host "   - NO hay numeros negativos" -ForegroundColor Green
Write-Host "   - FREE esta en el centro (fila 2, columna 2)" -ForegroundColor Green
Write-Host "   - Todos los numeros son validos" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
