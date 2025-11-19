@echo off
setlocal

REM Cambia el puerto del servidor Gemini (debe coincidir con index.html)
set "PORT=5050"

REM Ir a la carpeta del proyecto
cd /d "C:\Users\pc1\Documents\FOTOS MEGA COMPARTIDAS\MUNDOXYZ\backend\games\cards\caida"

REM Lanzar el servidor en una nueva ventana de consola
start "gemini-server" cmd /k "npm start"

REM Pequeña pausa para dar tiempo a que el servidor arranque
timeout /t 3 /nobreak >nul

REM Abrir el index.html en el navegador por defecto
start "" "C:\Users\pc1\Documents\FOTOS MEGA COMPARTIDAS\MUNDOXYZ\backend\games\cards\caida\index.html"

endlocal
