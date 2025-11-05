# Script para eliminar líneas duplicadas del archivo raffles.js
$inputFile = "backend\routes\raffles.js"
$outputFile = "backend\routes\raffles_cleaned.js"

# Leer todas las líneas
$lines = Get-Content $inputFile

# Crear array nuevo sin las líneas duplicadas (605-736)
$newLines = @()
$newLines += $lines[0..604]  # Líneas 1-605
$newLines += $lines[737..($lines.Count-1)]  # Líneas 738 al final

# Escribir archivo limpio
$newLines | Set-Content $outputFile

Write-Host "Archivo limpiado exitosamente"
Write-Host "Original: $($lines.Count) líneas"
Write-Host "Limpio: $($newLines.Count) líneas"
Write-Host "Eliminadas: $(($lines.Count) - ($newLines.Count)) líneas"
