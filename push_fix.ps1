git add -A
if ($LASTEXITCODE -eq 0) { Set-Content -Path .git\COMMIT_MSG.txt -Value 'fix: agregar validacion Array.isArray antes de map en Profile y Roles' }
if ($LASTEXITCODE -eq 0) { git commit -F .git\COMMIT_MSG.txt }
if ($LASTEXITCODE -eq 0) { git push -u origin HEAD }
if ($LASTEXITCODE -eq 0) { 
    Remove-Item .git\COMMIT_MSG.txt -ErrorAction SilentlyContinue
    Write-Host 'Fix aplicado - validacion agregada en Profile y Roles' -ForegroundColor Green
}
