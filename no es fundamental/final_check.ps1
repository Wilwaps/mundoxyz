$url = "https://confident-bravery-production-ce7b.up.railway.app/api/health"
Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 | ForEach-Object { Write-Output "Backend Status: $($_.StatusCode)" }

$url2 = "https://confident-bravery-production-ce7b.up.railway.app/" 
Invoke-WebRequest -Uri $url2 -UseBasicParsing -TimeoutSec 10 | ForEach-Object { 
    Write-Output "Frontend Status: $($_.StatusCode)"
    if ($_.Content -match "entry_price_fire") {
        Write-Output "ERROR: Frontend con código antiguo detectado"
    } else {
        Write-Output "OK: No hay errores de entry_price_fire"
    }
}
