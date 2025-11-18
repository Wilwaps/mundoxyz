@echo off
REM === Test mundoxyz: backend local usando BD de Railway ===

REM Ir a la carpeta del proyecto
cd /d "C:\Users\pc1\Documents\FOTOS MEGA COMPARTIDAS\MUNDOXYZ"

REM Configuración de entorno solo para esta sesión
set NODE_ENV=development
set PORT=3000
REM Usar la base de datos de Railway (PUBLIC URL)
set DATABASE_URL=postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway
set PGSSLMODE=require

REM Opcional: reducir logs a info
set LOG_LEVEL=info

REM Abrir consola con el servidor y logs activos
start "mundoxyz server" cmd /K "cd /d \"C:\Users\pc1\Documents\FOTOS MEGA COMPARTIDAS\MUNDOXYZ\" && npm run start"

REM Pequeña espera para que levante el servidor
timeout /t 5 /nobreak >nul

REM Abrir navegador apuntando al panel FIAT local
start "" "http://localhost:3000/admin/fiat"

exit /b 0
