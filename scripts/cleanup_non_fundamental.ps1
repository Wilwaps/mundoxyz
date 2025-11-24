param(
    [switch]$DryRun
)

Write-Host "=== Limpieza de archivos NO fundamentales del repositorio ===" -ForegroundColor Cyan
Write-Host "Este script solo los quita del índice de Git (GitHub)," -ForegroundColor Yellow
Write-Host "NO borra archivos del disco local." -ForegroundColor Yellow

# 1) Quitar del índice todo lo que esté dentro de "no es fundamental/"
$trackedNonFundamental = git ls-files "no es fundamental/*"

if (-not $trackedNonFundamental) {
    Write-Host "No hay archivos versionados bajo 'no es fundamental/'." -ForegroundColor Green
} else {
    Write-Host "Archivos actualmente versionados en 'no es fundamental/':" -ForegroundColor White
    $trackedNonFundamental | ForEach-Object { Write-Host "  $_" }

    if ($DryRun) {
        Write-Host "Dry-run activado: no se harán cambios en el índice de Git." -ForegroundColor Yellow
    } else {
        Write-Host "Ejecutando: git rm --cached -r 'no es fundamental'" -ForegroundColor Cyan
        git rm --cached -r "no es fundamental"
        Write-Host "Listo. Los archivos siguen en tu carpeta local pero dejaron de estar en Git." -ForegroundColor Green
    }
}

Write-Host "\nRevisa el estado del repo con 'git status' y haz commit para aplicar los cambios." -ForegroundColor Cyan
