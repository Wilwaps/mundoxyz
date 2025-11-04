Write-Host "======================================" -ForegroundColor Cyan
Write-Host "DIAGNÓSTICO COMPLETO RAILWAY DEPLOY" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Función para verificar estado
function Test-Endpoint($name, $url, $description) {
    Write-Host "🔍 $name" -ForegroundColor Yellow
    Write-Host "   URL: $url" -ForegroundColor Gray
    Write-Host "   Desc: $description" -ForegroundColor Gray
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -TimeoutSec 15
        $stopwatch.Stop()
        
        Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "   ⏱️  Time: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Green
        
        # Analizar contenido para errores específicos
        if ($response.Content -match "TypeError.*entry_price_fire") {
            Write-Host "   ❌ ERROR: Frontend aún usando código antiguo con entry_price_fire" -ForegroundColor Red
            return "FRONTEND_ERROR"
        }
        
        if ($response.Content -match "Cannot resolve.*LoadingSpinner") {
            Write-Host "   ❌ ERROR: Problema con importación LoadingSpinner" -ForegroundColor Red
            return "IMPORT_ERROR"
        }
        
        if ($response.Content -match "MUNDOXYZ") {
            Write-Host "   ✅ Título de aplicación encontrado" -ForegroundColor Green
        }
        
        return "SUCCESS"
        
    } catch [System.Net.WebException] {
        $stopwatch.Stop()
        $statusCode = $_.Exception.Response.StatusCode
        $statusDescription = $_.Exception.Response.StatusDescription
        
        Write-Host "   ❌ Status: $statusCode ($statusDescription)" -ForegroundColor Red
        Write-Host "   ⏱️  Time: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Red
        
        if ($statusCode -eq "502") {
            Write-Host "   📋 Causa: Application failed to respond (deploy en proceso o error)" -ForegroundColor Yellow
            return "DEPLOY_IN_PROGRESS"
        }
        
        if ($statusCode -eq "503") {
            Write-Host "   📋 Causa: Service unavailable (reiniciando contenedores)" -ForegroundColor Yellow
            return "SERVICE_UNAVAILABLE"
        }
        
        if ($statusCode -eq "404") {
            Write-Host "   📋 Causa: Route not found (rutas incorrectas)" -ForegroundColor Red
            return "ROUTE_NOT_FOUND"
        }
        
        return "HTTP_ERROR"
        
    } catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        return "CONNECTION_ERROR"
    }
    
    Write-Host ""
}

# 1. Verificar Backend Health
$result1 = Test-Endpoint "Backend Health API" "https://confident-bravery-production-ce7b.up.railway.app/api/health" "Endpoint de salud del backend"

# 2. Verificar Frontend Principal
$result2 = Test-Endpoint "Frontend Principal" "https://confident-bravery-production-ce7b.up.railway.app/" "Página principal de la aplicación"

# 3. Verificar Login Page
$result3 = Test-Endpoint "Login Page" "https://confident-bravery-production-ce7b.up.railway.app/login" "Página de login"

# 4. Verificar Games Page
$result4 = Test-Endpoint "Games Page" "https://confident-bravery-production-ce7b.up.railway.app/games" "Página de juegos"

# 5. Verificar Raffles Lobby (endpoint crítico)
$result5 = Test-Endpoint "Raffles Lobby" "https://confident-bravery-production-ce7b.up.railway.app/raffles/lobby" "Lobby de rifas (donde estaba el error)"

# 6. Verificar API de Raffles
$result6 = Test-Endpoint "Raffles API" "https://confident-bravery-production-ce7b.up.railway.app/api/raffles/public" "API endpoint para rifas públicas"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "RESUMEN DEL DIAGNÓSTICO" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$results = @($result1, $result2, $result3, $result4, $result5, $result6)
$successCount = ($results | Where-Object { $_ -eq "SUCCESS" }).Count
$deployCount = ($results | Where-Object { $_ -eq "DEPLOY_IN_PROGRESS" -or $_ -eq "SERVICE_UNAVAILABLE" }).Count
$errorCount = ($results | Where-Object { $_ -ne "SUCCESS" -and $_ -ne "DEPLOY_IN_PROGRESS" -and $_ -ne "SERVICE_UNAVAILABLE" }).Count

Write-Host "✅ Exitosos: $successCount" -ForegroundColor Green
Write-Host "🔄 En Deploy/Progreso: $deployCount" -ForegroundColor Yellow
Write-Host "❌ Errores: $errorCount" -ForegroundColor Red
Write-Host ""

if ($errorCount -eq 0 -and $deployCount -eq 0) {
    Write-Host "🎉 ¡DEPLOY EXITOSO! Todos los endpoints funcionan correctamente." -ForegroundColor Green
} elseif ($deployCount -gt 0) {
    Write-Host "⏳ DEPLOY EN PROGRESO - Algunos servicios aún están iniciando." -ForegroundColor Yellow
    Write-Host "   Recomendación: Esperar 2-3 minutos más y reintentar." -ForegroundColor Gray
} elseif ($errorCount -gt 0) {
    Write-Host "🚨 ERRORES DETECTADOS - Requiere intervención manual." -ForegroundColor Red
    Write-Host "   Recomendación: Verificar Railway Dashboard y logs de build." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Próxima recomendación:" -ForegroundColor Cyan
if ($result5 -eq "FRONTEND_ERROR") {
    Write-Host "  - El frontend aún usa código antiguo. Necesita más tiempo para caché." -ForegroundColor Red
} elseif ($result5 -eq "SUCCESS") {
    Write-Host "  - ¡El error de LoadingSpinner está solucionado!" -ForegroundColor Green
    Write-Host "  - Probar navegación a /raffles/lobby y crear una rifa." -ForegroundColor Green
} else {
    Write-Host "  - Esperar más tiempo o verificar Railway Dashboard." -ForegroundColor Yellow
}
