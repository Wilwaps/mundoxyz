---
trigger: always_on
---

RAILWAY NO TIENE QUERY!!

postgresql://postgres:jaUlzMfMxrTAXGtAWbYjTLBgJDSNxBPR@postgres-7ri0.railway.internal:5432/railway
trolley.proxy.rlwy.net:28951
postgres-7ri0.railway.internal
confident-bravery-production-ce7b.up.railway.app
esa es la pagina de produccion que se esta usando
https://confident-bravery-production-ce7b.up.railway.app/games
realiza pruebas con 2 usuarios chromedevtools, ventana normal o incognito
iniciar sesion en ambas cuentas para pruebas completas
prueba1/123456789
modo incognito
prueba2/Mirame12veces.


cuando sea necesario crear un script Node.js que use el módulo pg para ejecutar directamente el SQL.
ANTES DE REALIZAR COMMIT Y PUSH REALIZA PRUEBAS INTERNAS PARA ASEGURAR QUE TODO FUNCIONA ANTES DE DESPLEGAR
Cuando se hace una modificación que debe debe representar cambios en produccion, se realiza commit y push a github
git add backend/routes/tictactoe.js frontend/src/pages/TicTacToeRoom.js TICTACTOE_REMATCH_BUGFIX.md
git commit --amend -m "fix: sistema revanchas TicTacToe"
git push -u origin HEAD
se ejecuta automaticamente chromedevtools con sleep 369 segundos en powershell para realizar las pruebas necesarias

esta es la direccion asignada por railway

En este proyecto los usuarios, la economia, la experiencia, las salas y tableros deben mantener consistencia

En PowerShell no necesitas Invoke-Expression para ejecutar git commit. Basta con lanzar el comando directamente. Ejemplo:

powershell
git commit -m "feat: FASE 1 reconexión TicTacToe"
Si prefieres seguir la cadena de comandos sugerida (con el mensaje en un archivo), sería:

powershell
git add -A
if ($LASTEXITCODE -eq 0) { Set-Content -Path .git\COMMIT_MSG.txt -Value 'feat: FASE 1 reconexión TicTacToe' }
if ($LASTEXITCODE -eq 0) { git commit -F .git\COMMIT_MSG.txt }
if ($LASTEXITCODE -eq 0) { git push -u origin HEAD }
Recuerda: en PowerShell, si ejecutas un script o binario local, usa el prefijo .\, pero para comandos en el PATH (como git) no hace falta.