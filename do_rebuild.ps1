git add -A
if ($LASTEXITCODE -eq 0) { 
    Set-Content -Path .git\COMMIT_MSG.txt -Value 'fix: force complete frontend rebuild - React not loading' 
}
if ($LASTEXITCODE -eq 0) { 
    git commit --allow-empty -F .git\COMMIT_MSG.txt 
}
if ($LASTEXITCODE -eq 0) { 
    git push -u origin HEAD 
}
if ($LASTEXITCODE -eq 0) { 
    Remove-Item .git\COMMIT_MSG.txt -ErrorAction SilentlyContinue
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Rebuild iniciado en Railway!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "⏰ Espera 3-5 minutos para el build" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Luego:" -ForegroundColor Cyan
    Write-Host "   1. Recarga navegador (Ctrl+Shift+R)" -ForegroundColor White
    Write-Host "   2. Verifica que React carga" -ForegroundColor White
    Write-Host ""
}
