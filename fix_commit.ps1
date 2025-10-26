git add -A
if ($LASTEXITCODE -eq 0) { 
    Set-Content -Path .git\COMMIT_MSG.txt -Value 'fix: agregar prefix /api a todas las rutas de auth - resolver 404 en login' 
}
if ($LASTEXITCODE -eq 0) { 
    git commit -F .git\COMMIT_MSG.txt 
}
if ($LASTEXITCODE -eq 0) { 
    git push -u origin HEAD 
}
if ($LASTEXITCODE -eq 0) { 
    Remove-Item .git\COMMIT_MSG.txt -ErrorAction SilentlyContinue
    Write-Host "✅ Commit y push exitoso!" -ForegroundColor Green
    Write-Host "🚀 Deploy iniciado en Railway - esperar 2-3 minutos" -ForegroundColor Yellow
}
