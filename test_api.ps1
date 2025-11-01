$url = "https://confident-bravery-production-ce7b.up.railway.app/api/health"
$response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing
Write-Output "Backend Status: $($response.StatusCode)"
