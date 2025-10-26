git add -A
if ($LASTEXITCODE -eq 0) { Set-Content -Path .git\COMMIT_MSG.txt -Value 'fix: agregar Error Boundary para capturar y mostrar errores de React' }
if ($LASTEXITCODE -eq 0) { git commit -F .git\COMMIT_MSG.txt }
if ($LASTEXITCODE -eq 0) { git push -u origin HEAD }
if ($LASTEXITCODE -eq 0) { 
    Remove-Item .git\COMMIT_MSG.txt -ErrorAction SilentlyContinue
    Write-Host 'Error Boundary agregado - rebuild iniciado' -ForegroundColor Green
}
