Write-Host "🔧 Forzando rebuild completo del frontend..." -ForegroundColor Yellow
Write-Host ""

# Commit vacío para forzar redeploy
git commit --allow-empty -m "fix: force complete frontend rebuild - React not loading"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit creado" -ForegroundColor Green
    
    # Push
    git push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Push exitoso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "⏰ Ahora espera 3-5 minutos..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📋 Pasos siguientes:" -ForegroundColor Cyan
        Write-Host "  1. Ve a Railway Dashboard" -ForegroundColor White
        Write-Host "  2. Frontend Service → Deployments" -ForegroundColor White
        Write-Host "  3. Espera a que el build esté 'Active'" -ForegroundColor White
        Write-Host "  4. Recarga el navegador (Ctrl+Shift+R)" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ Error en push" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Error en commit" -ForegroundColor Red
}
