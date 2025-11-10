-- Script para obtener el código de la última rifa creada
-- Ejecutar en Railway Query

SELECT 
  code AS "Código de Rifa",
  name AS "Nombre",
  mode AS "Modo",
  visibility AS "Visibilidad",
  status AS "Estado",
  numbers_range AS "Cantidad Números",
  entry_price_fire AS "Precio Fuegos",
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') AS "Fecha Creación"
FROM raffles 
WHERE host_id = (
  SELECT id FROM users WHERE username = 'prueba1'
)
ORDER BY created_at DESC 
LIMIT 1;

-- URL para acceder a la rifa:
-- https://mundoxyz-production.up.railway.app/raffles/[CODIGO]
