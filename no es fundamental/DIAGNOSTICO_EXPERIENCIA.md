# 🔍 DIAGNÓSTICO: Modal de Experiencia Mostrando 0s

## ⚡ **PROBLEMA IDENTIFICADO**

El modal de experiencia muestra todos los valores en 0 después del deploy. Esto indica que **las columnas de experiencia probablemente no existen en la base de datos de Railway**.

---

## 🎯 **CAUSA PROBABLE**

La migración 008 (`008_bingo_v2_complete_rewrite.sql`) que crea las columnas `experience`, `total_games_played` y `total_games_won` **NO se ejecutó correctamente** en Railway, o las columnas fueron eliminadas por alguna migración posterior.

---

## 🔧 **SOLUCIÓN RÁPIDA (6 minutos)**

### **Opción A: Usar Endpoint de Debug (RECOMENDADO)**

Después del deploy (esperar 6 minutos), accede a este endpoint desde tu navegador:

```
https://confident-bravery-production-ce7b.up.railway.app/api/debug-xp/verify/prueba1
```

**Esto te mostrará:**
1. ✅ Si las columnas existen
2. ✅ Datos actuales del usuario
3. ✅ Historial de partidas (TicTacToe + Bingo)
4. ✅ Top usuarios con XP

**Interpretación del resultado:**

```json
{
  "success": true,
  "debug": {
    "columns_exist": [],  // ❌ Si está vacío, las columnas NO EXISTEN
    "user_data": {
      "experience": 0,
      "total_games_played": 0,
      "total_games_won": 0
    },
    "tictactoe_history": {
      "total_partidas": 5,
      "victorias": 2
    }
  }
}
```

**Si `columns_exist` está vacío → las columnas NO EXISTEN**

---

### **Opción B: Ejecutar SQL en Railway (SOLUCIÓN DEFINITIVA)**

1. **Acceder a Railway PostgreSQL:**
   - Ve a tu proyecto en Railway
   - Click en "PostgreSQL"
   - Click en "Query" tab

2. **Ejecutar el script completo:**
   - Abre el archivo `FIX_EXPERIENCE_COLUMNS.sql`
   - Copia TODO el contenido
   - Pégalo en Railway Query
   - Click "Execute"

3. **Verificar resultado:**
   ```sql
   SELECT 
     username,
     experience,
     total_games_played,
     total_games_won
   FROM users
   WHERE username IN ('prueba1', 'prueba2')
   ORDER BY username;
   ```

**Resultado esperado:**
```
username | experience | total_games_played | total_games_won
---------+------------+--------------------+----------------
prueba1  | 5          | 5                  | 2
prueba2  | 3          | 3                  | 1
```

---

## 📊 **SCRIPT SQL RÁPIDO (copiar/pegar)**

Si solo quieres crear las columnas sin poblar datos históricos:

```sql
-- Crear columnas (seguro, no falla si ya existen)
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_games_won INTEGER DEFAULT 0;

-- Actualizar NULLs a 0
UPDATE users SET experience = 0 WHERE experience IS NULL;
UPDATE users SET total_games_played = 0 WHERE total_games_played IS NULL;
UPDATE users SET total_games_won = 0 WHERE total_games_won IS NULL;

-- Verificar
SELECT username, experience, total_games_played, total_games_won 
FROM users 
WHERE username = 'prueba1';
```

---

## 🎮 **POBLAR XP BASADO EN HISTORIAL (BONUS)**

Si quieres dar XP retroactivo por partidas ya jugadas:

```sql
-- Este query cuenta todas las partidas y calcula XP
WITH ttt_stats AS (
  SELECT 
    user_id,
    COUNT(*) as ttt_games,
    COUNT(CASE WHEN is_winner = true THEN 1 END) as ttt_wins
  FROM (
    SELECT 
      player_x_id as user_id,
      CASE WHEN winner_id = player_x_id THEN true ELSE false END as is_winner
    FROM tictactoe_rooms
    WHERE status = 'finished'
    UNION ALL
    SELECT 
      player_o_id as user_id,
      CASE WHEN winner_id = player_o_id THEN true ELSE false END as is_winner
    FROM tictactoe_rooms
    WHERE status = 'finished' AND player_o_id IS NOT NULL
  ) t
  GROUP BY user_id
),
bingo_stats AS (
  SELECT 
    brp.user_id,
    COUNT(DISTINCT br.id) as bingo_games,
    COUNT(CASE WHEN br.winner_id = brp.user_id THEN 1 END) as bingo_wins
  FROM bingo_v2_room_players brp
  JOIN bingo_v2_rooms br ON br.id = brp.room_id
  WHERE br.status = 'finished'
  GROUP BY brp.user_id
)
UPDATE users u
SET 
  total_games_played = COALESCE(t.ttt_games, 0) + COALESCE(b.bingo_games, 0),
  total_games_won = COALESCE(t.ttt_wins, 0) + COALESCE(b.bingo_wins, 0),
  experience = COALESCE(t.ttt_games, 0) + COALESCE(b.bingo_games, 0) + 
               COALESCE(t.ttt_wins, 0) + COALESCE(b.bingo_wins, 0)
FROM ttt_stats t
FULL OUTER JOIN bingo_stats b ON t.user_id = b.user_id
WHERE u.id = COALESCE(t.user_id, b.user_id);
```

---

## ✅ **VERIFICACIÓN FINAL**

Después de ejecutar el script:

1. **Refrescar modal de experiencia:**
   - Recargar la página web
   - Hacer logout/login
   - Click en "⭐ X XP" en el header

2. **Datos esperados para prueba1:**
   ```
   Nivel: Calculado (5 partidas = 10 XP = Nivel 1)
   XP Total: 10 (5 partidas + 2 victorias bonus)
   Partidas: 5
   Victorias: 2
   Win Rate: 40%
   ```

3. **Verificar en consola del navegador:**
   ```javascript
   // F12 → Console
   localStorage.getItem('user')
   // Debería mostrar experience, total_games_played, total_games_won
   ```

---

## 🚨 **SI PERSISTE EL PROBLEMA**

1. **Limpiar caché del navegador:**
   ```
   Ctrl + Shift + Delete (Chrome/Edge)
   Seleccionar "Cookies y datos de sitio"
   Click "Borrar datos"
   ```

2. **Forzar refresh del user:**
   - Hacer logout
   - Cerrar navegador completamente
   - Abrir y hacer login de nuevo

3. **Verificar logs de Railway:**
   ```
   Buscar errores relacionados con:
   - "column experience does not exist"
   - "error fetching profile"
   - Errores en /api/profile
   ```

---

## 📝 **CHECKLIST DE DIAGNÓSTICO**

- [ ] Esperar 6 minutos después del deploy
- [ ] Acceder a `/api/debug-xp/verify/prueba1`
- [ ] Verificar si `columns_exist` tiene valores
- [ ] Si está vacío, ejecutar `FIX_EXPERIENCE_COLUMNS.sql` en Railway
- [ ] Verificar columnas con query de verificación
- [ ] (Opcional) Poblar XP histórico con query de bonus
- [ ] Refrescar página y verificar modal
- [ ] Confirmar que datos se muestran correctamente

---

## 🎯 **RESULTADO FINAL ESPERADO**

```
Modal de Experiencia (prueba1):
┌─────────────────────────┐
│      Nivel 2            │
│      150 XP Total       │
│                         │
│  📈 15 Partidas         │
│  🏆 7 Victorias         │
│  🎯 46.7% Win Rate      │
│                         │
│  Milestones:            │
│  ✓ Novato              │
│  ✗ Autocanto (400 XP)  │
└─────────────────────────┘
```

---

## 📞 **SIGUIENTE PASO**

Una vez ejecutado el script SQL, dime el resultado del endpoint:
```
https://confident-bravery-production-ce7b.up.railway.app/api/debug-xp/verify/prueba1
```

Y te confirmaré si todo está correcto o necesitamos hacer ajustes adicionales.
