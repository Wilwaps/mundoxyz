git add -A
if ($LASTEXITCODE -eq 0) { 
    Set-Content -Path .git\COMMIT_MSG.txt -Value 'fix: configurar correctamente REACT_APP_API_URL para produccion - debe ser URL del backend' 
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
}
