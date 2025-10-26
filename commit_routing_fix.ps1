git add -A
if ($LASTEXITCODE -eq 0) { Set-Content -Path .git\COMMIT_MSG.txt -Value 'fix: agregar prefijo /api a TODAS las rutas del frontend - soluciona error map() HTML vs JSON' }
if ($LASTEXITCODE -eq 0) { git commit -F .git\COMMIT_MSG.txt }
if ($LASTEXITCODE -eq 0) { git push -u origin HEAD }
if ($LASTEXITCODE -eq 0) { 
    Remove-Item .git\COMMIT_MSG.txt -ErrorAction SilentlyContinue
    Write-Host 'ROUTING FIX COMPLETO - Todas las rutas ahora usan /api prefix' -ForegroundColor Green
}
