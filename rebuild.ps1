git add -A
if ($LASTEXITCODE -eq 0) { Set-Content -Path .git\COMMIT_MSG.txt -Value 'fix: force frontend rebuild - React not loading' }
if ($LASTEXITCODE -eq 0) { git commit --allow-empty -F .git\COMMIT_MSG.txt }
if ($LASTEXITCODE -eq 0) { git push -u origin HEAD }
if ($LASTEXITCODE -eq 0) { 
    Remove-Item .git\COMMIT_MSG.txt -ErrorAction SilentlyContinue
    Write-Host 'Rebuild iniciado' -ForegroundColor Green
}
