---
trigger: always_on
---

RAILWAY NO TIENE QUERY!!
https://railway.com/project/9ed64502-9a9f-4129-8cb5-00a50f074995/service/68a15835-82a9-4897-ad6f-fa55a2ec9326?environmentId=dc0d6ff4-7c00-435c-89d8-d6433b4f598d
Esta es la direccion del proyecto para analizarlo con chromedevtools

te daré la ubicacion postgres y railway
DATABASE_PUBLIC_URL
postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@shuttle.proxy.rlwy.net:10199/railway
DATABASE_URL
postgresql://postgres:gUUCiUgVwQOOoERDqqGTzNkJTLlsJeWG@postgres.railway.internal:5432/railway
ubicacion en railway
https://mundoxyz-production.up.railway.app

prueba1/Mirame12veces.
en la carpeta local /no es fundamental existe documentacion que tal vez sea de utilidad para saber de donde hemos evolucionado

cuando sea necesario crear un script Node.js que use el módulo pg para ejecutar directamente el SQL.
REALIZA PRUEBAS INTERNAS (npm run build) PARA ASEGURAR QUE TODO FUNCIONA ANTES DE DESPLEGAR COMMIT Y PUSH 
Cuando se hace una modificación que debe debe representar cambios en produccion, se realiza commit y push a github
git add backend/routes/tictactoe.js frontend/src/pages/TicTacToeRoom.js TICTACTOE_REMATCH_BUGFIX.md
git commit --amend -m "fix: sistema revanchas TicTacToe"
git push -u origin HEAD
se ejecuta automaticamente chromedevtools en railway para hacer seguimiento del deploy acto seguido de realizado el deploy realizar las pruebas en el proyecto para asegurar que las implementaciones realizadas fueros desplegadas correctamente

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