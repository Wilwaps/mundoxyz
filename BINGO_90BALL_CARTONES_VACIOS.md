# BUG: Cartones Vacíos en Modo 90 Bolas

**Fecha:** 9 Nov 2025 10:37am  
**Modo afectado:** Bingo 90 números  
**Síntoma:** Los cartones se muestran vacíos en el frontend  
**Estado:** En diagnóstico  

---

## 🔴 PROBLEMA REPORTADO

En el modo de juego de Bingo con 90 números, los cartones aparecen completamente vacíos en el frontend. Los cartones se cargan (tienen número de cartón visible), pero el grid no muestra ningún número.

**Evidencia visual:**
- Cartón dice "Cartón #1", "Cartón #2", etc.
- Grid del cartón está completamente vacío (no muestra celdas con números)
- Ocurre solo en modo 90 bolas
- Modo 75 bolas funciona correctamente

---

## 🔍 ANÁLISIS INICIAL

### Arquitectura del Sistema:

```
Backend (generate90BallCard)
├─ Genera grid 3x9 (3 filas, 9 columnas)
├─ Cada fila tiene 5 números aleatorios
├─ Celdas restantes: { value: null, marked: false }
├─ Rangos por columna:
│   ├─ Col 0: 1-9
│   ├─ Col 1: 10-19
│   ├─ Col 2: 20-29
│   ...
│   └─ Col 8: 80-90
├─ JSON.stringify(grid)
└─ INSERT con ::jsonb cast

Database (PostgreSQL)
├─ Tabla: bingo_v2_cards
├─ Campo: grid (JSONB)
└─ Almacena estructura de objetos

Backend (getRoomDetails)
├─ SELECT grid FROM bingo_v2_cards
├─ Si es string → JSON.parse(grid)
└─ Retorna parsedGrid

Frontend (BingoV2Card)
├─ Recibe card.grid
├─ Mapea grid.map(row => row.map(cell))
└─ renderCell para cada celda
```

---

## 🕵️ HIPÓTESIS

### Hipótesis 1: Grid se genera vacío
**Probabilidad:** Baja  
**Razón:** El código de `generate90BallCard()` se ve correcto y similar a `generate75BallCard()` que funciona.

### Hipótesis 2: JSON no se parsea correctamente
**Probabilidad:** Alta  
**Razón:** Puede haber diferencia en cómo PostgreSQL retorna JSONB para estructuras complejas como grids 3x9 vs 5x5.

**Detalles:**
```javascript
// ANTES (sin logs detallados)
grid: typeof card.grid === 'string' ? JSON.parse(card.grid) : card.grid

// Problema potencial:
// - ¿Y si card.grid es string pero JSON.parse retorna {}?
// - ¿Y si card.grid es objeto pero está vacío?
// - ¿Y si hay error en JSON.parse que no se captura?
```

### Hipótesis 3: Frontend no renderiza estructuras 3x9
**Probabilidad:** Media  
**Razón:** El CSS está configurado para 9 columnas, pero puede haber problema con altura/aspecto.

**Código frontend:**
```css
.bingo-card-90 .card-row {
  grid-template-columns: repeat(9, 1fr);
  gap: 2px;
}

.bingo-card-90 .bingo-cell {
  min-height: 40px;  /* Solo mínimo, no aspect-ratio */
  font-size: 1rem;
}
```

**Vs 75-ball:**
```css
.card-row {
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
}

.bingo-cell {
  aspect-ratio: 1;  /* Aspecto cuadrado forzado */
  ...
}
```

**Diferencia clave:** 90-ball no tiene `aspect-ratio`, lo que podría causar celdas colapsadas a 0 altura.

### Hipótesis 4: Problema con celdas null
**Probabilidad:** Media  
**Razón:** 90-ball tiene muchas celdas `{ value: null }` que deben renderizarse como vacías.

**Código renderizado:**
```javascript
// BingoV2Card.js línea 91-97
if (value === null) {
  return (
    <div 
      key={posKey}
      className="bingo-cell empty"
    />
  );
}
```

**Problema potencial:** Si TODAS las celdas son null, el grid se vería vacío.

---

## ✅ ACCIONES TOMADAS

### 1. Logs de Debug Mejorados (Commit 935b770)

**Archivo:** `backend/services/bingoV2Service.js` (líneas 473-525)

**Logs agregados:**
```javascript
logger.info(`🎟️ Card ${card.id}:`, {
  gridType: typeof card.grid,              // ¿Es string u object?
  parsedGridType: typeof parsedGrid,       // ¿Parseo exitoso?
  isArray: Array.isArray(parsedGrid),      // ¿Es array válido?
  gridLength: parsedGrid?.length,          // ¿Cuántas filas?
  firstRow: parsedGrid?.[0],               // ¿Primera fila tiene datos?
  sampleCell: parsedGrid?.[0]?.[0]         // ¿Celda ejemplo tiene estructura?
});
```

**Errores capturados:**
```javascript
try {
  parsedGrid = JSON.parse(card.grid);
} catch (e) {
  logger.error(`❌ Error parsing grid for card ${card.id}:`, e);
  parsedGrid = null;
}
```

---

## 🧪 PLAN DE DIAGNÓSTICO

### Paso 1: Revisar Logs de Railway (Post-Deploy)

**Qué buscar:**
1. Log de creación de cartón:
   ```
   ✅ Card created with FREE pre-marked: { cardId: X, mode: '90', hasFreePre: false }
   ```

2. Log de carga de cartón:
   ```
   🎟️ Card X: {
     gridType: 'object' o 'string',
     parsedGridType: 'object',
     isArray: true,
     gridLength: 3,                         // ✅ Debe ser 3
     firstRow: [...],                       // ✅ Debe tener 9 elementos
     sampleCell: { value: X, marked: false } // ✅ Debe tener estructura
   }
   ```

3. Errores de parseo:
   ```
   ❌ Error parsing grid for card X: ...
   ```

### Paso 2: Verificar en Base de Datos Directamente

**Query SQL:**
```sql
-- Ver un cartón de 90 bolas
SELECT 
  id,
  card_number,
  room_id,
  grid,
  pg_typeof(grid) as grid_type,
  jsonb_array_length(grid) as num_rows
FROM bingo_v2_cards
WHERE room_id = (
  SELECT id FROM bingo_v2_rooms 
  WHERE mode = '90' 
  LIMIT 1
)
LIMIT 1;

-- Inspeccionar estructura del grid
SELECT 
  id,
  card_number,
  grid->0 as first_row,
  grid->0->0 as first_cell,
  jsonb_array_length(grid->0) as num_cols_first_row
FROM bingo_v2_cards
WHERE room_id = (
  SELECT id FROM bingo_v2_rooms 
  WHERE mode = '90' 
  LIMIT 1
)
LIMIT 1;
```

### Paso 3: Test en Frontend Console

**Abrir DevTools en sala de Bingo 90:**
```javascript
// Ver datos crudos
console.log('My cards:', myCards);
console.log('First card grid:', myCards[0]?.grid);
console.log('Grid is array?', Array.isArray(myCards[0]?.grid));
console.log('Grid length:', myCards[0]?.grid?.length);
console.log('First row:', myCards[0]?.grid?.[0]);
console.log('First cell:', myCards[0]?.grid?.[0]?.[0]);

// Ver estructura esperada
myCards[0]?.grid?.forEach((row, i) => {
  console.log(`Row ${i} (${row.length} cells):`, row);
});
```

---

## 🔧 POSIBLES SOLUCIONES

### Solución 1: Forzar aspect-ratio para 90-ball (si es problema CSS)

**Archivo:** `frontend/src/components/bingo/BingoV2Card.css`

```css
.bingo-card-90 .bingo-cell {
  min-height: 40px;
  aspect-ratio: 1;  /* ✅ Agregar esto */
  font-size: 0.9rem; /* Reducir fuente por espacio */
}
```

### Solución 2: Agregar logs en frontend (si parseo está mal)

**Archivo:** `frontend/src/components/bingo/BingoV2Card.js`

```javascript
const render90BallCard = () => {
  console.log('🎰 Rendering 90-ball card:', {
    hasGrid: !!card.grid,
    gridIsArray: Array.isArray(card.grid),
    gridLength: card.grid?.length,
    firstRow: card.grid?.[0]
  });
  
  return (
    <div className="bingo-card-90">
      <div className="card-grid">
        {card.grid?.map((row, rowIdx) => (
          <div key={rowIdx} className="card-row">
            {row.map((cell, colIdx) => renderCell(cell, rowIdx, colIdx))}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Solución 3: Validar grid antes de guardar (si generación falla)

**Archivo:** `backend/services/bingoV2Service.js`

```javascript
static async generateCardsForPlayer(roomId, playerId, count, mode, dbQuery) {
  const cards = [];
  
  for (let i = 0; i < count; i++) {
    const grid = mode === '75' ? this.generate75BallCard() : this.generate90BallCard();
    
    // ✅ VALIDAR grid antes de guardar
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
      logger.error(`❌ Invalid grid generated for mode ${mode}`);
      throw new Error('Failed to generate valid card grid');
    }
    
    logger.info(`🎯 Generated grid for ${mode}-ball:`, {
      rows: grid.length,
      cols: grid[0]?.length,
      firstCell: grid[0]?.[0],
      hasNulls: grid.some(row => row.some(cell => cell.value === null))
    });
    
    // Continuar con INSERT...
  }
}
```

### Solución 4: Re-parsear explícitamente en frontend (workaround)

**Archivo:** `frontend/src/pages/BingoV2GameRoom.js`

```javascript
const loadRoomAndCards = async () => {
  try {
    const response = await fetch(`${API_URL}/api/bingo/v2/rooms/${code}`);
    const data = await response.json();
    
    if (data.success) {
      setRoom(data.room);
      setDrawnNumbers(data.room.drawn_numbers || []);
      
      const myPlayer = data.room.players?.find(p => p.user_id === user?.id);
      
      if (myPlayer) {
        // ✅ FORZAR parseo de grid en frontend
        const cards = myPlayer.cards.map(card => ({
          ...card,
          grid: typeof card.grid === 'string' 
            ? JSON.parse(card.grid) 
            : card.grid
        }));
        
        console.log('🎟️ Cards after parsing:', cards);
        setMyCards(cards);
      }
    }
  } catch (err) {
    console.error('Error loading room:', err);
  }
};
```

---

## 📊 COMPARACIÓN 75-BALL VS 90-BALL

| Aspecto | 75-Ball (✅ Funciona) | 90-Ball (❌ No funciona) |
|---------|----------------------|-------------------------|
| **Dimensiones** | 5x5 grid | 3x9 grid |
| **Tamaño JSON** | ~500 caracteres | ~400 caracteres |
| **Celdas totales** | 25 | 27 |
| **Celdas NULL** | 0 (FREE en centro) | ~12 (4 por fila) |
| **aspect-ratio CSS** | Sí (1:1) | No (solo min-height) |
| **Validación** | FREE siempre existe | Todas las celdas pueden ser null |

---

## 📝 NEXT STEPS

1. ✅ Deploy completado (~6 min)
2. ⏳ Revisar logs de Railway con Chrome DevTools
3. ⏳ Identificar causa exacta del problema
4. ⏳ Aplicar solución apropiada
5. ⏳ Test en producción
6. ⏳ Commit final con fix

---

## 🎯 RESULTADO ESPERADO

Después del fix:
- Cartones de 90-ball muestran grid completo
- 15 números visibles (5 por fila)
- 12 celdas vacías (4 por fila)
- Celdas vacías con fondo gris claro (`.empty`)
- Números se pueden marcar al ser cantados
- UX consistente con cartones de 75-ball

---

**Status:** Esperando deploy + análisis de logs  
**ETA Fix:** ~15-30 minutos después de identificar causa  
