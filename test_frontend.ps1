$url = "https://confident-bravery-production-ce7b.up.railway.app/"
try {
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing
    Write-Output "Frontend Status: $($response.StatusCode)"
    if ($response.Content -match "main\.[a-f0-9]+\.js") {
        Write-Output "Bundle JavaScript encontrado"
    } else {
        Write-Output "Bundle JavaScript NO encontrado"
    }
} catch {
    Write-Output "Error: $_"
}
