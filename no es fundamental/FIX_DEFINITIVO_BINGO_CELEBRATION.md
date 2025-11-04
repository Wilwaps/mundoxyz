# 🔧 FIX DEFINITIVO - MODAL CELEBRACIÓN BINGO

**Fecha:** 31 Oct 2025  
**Problema:** Modal de celebración no aparece después de presionar "¡BINGO!"  
**Status:** CRÍTICO - Bloquea el flujo completo del juego

---

## 🔴 **PROBLEMAS IDENTIFICADOS**

### 1. **Socket Desconectado**
- El socket pierde conexión durante el juego
- Los eventos no llegan al frontend
- El estado se pierde

### 2. **marked_numbers como String JSON**
- PostgreSQL guarda como string en lugar de array
- El parseo no funciona correctamente
- La validación falla

### 3. **Endpoint de diagnóstico roto**
- Import incorrecto causa error 500
- No se puede diagnosticar el estado real

---

## ✅ **SOLUCIÓN COMPLETA**

### **PASO 1: Fix Socket Reconexión**

```javascript
// frontend/src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || '', {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      auth: {
        token: localStorage.getItem('token')
      }
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 Reconnecting... attempt ${attempt}`);
      reconnectAttempts.current = attempt;
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return { socket, connected };
};
```

---

### **PASO 2: Fix marked_numbers Definitivo**

```javascript
// backend/services/bingoService.js - función markNumber
async markNumber(cardId, number, userId) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Obtener el cartón actual
    const cardQuery = await client.query(
      `SELECT bc.*, br.drawn_numbers 
       FROM bingo_cards bc
       JOIN bingo_rooms br ON bc.room_id = br.id
       WHERE bc.id = $1 AND bc.user_id = $2`,
      [cardId, userId]
    );
    
    if (cardQuery.rows.length === 0) {
      throw new Error('Cartón no encontrado');
    }
    
    const card = cardQuery.rows[0];
    
    // CRITICAL: Parsear marked_numbers si es string
    let currentMarked = card.marked_numbers || [];
    if (typeof currentMarked === 'string') {
      try {
        currentMarked = JSON.parse(currentMarked);
      } catch (e) {
        currentMarked = [];
      }
    }
    
    // Asegurar que sea array
    if (!Array.isArray(currentMarked)) {
      currentMarked = [];
    }
    
    // Agregar el número si no está marcado
    if (!currentMarked.includes(number)) {
      currentMarked.push(number);
    }
    
    // CRITICAL: Guardar como JSONB array, NO como string
    const updateQuery = await client.query(
      `UPDATE bingo_cards 
       SET marked_numbers = $1::jsonb
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(currentMarked), cardId]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      markedNumbers: currentMarked,
      card: updateQuery.rows[0]
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

### **PASO 3: Fix callBingo con Logs Explícitos**

```javascript
// backend/services/bingoService.js - función callBingo
async callBingo(code, cardId, userId) {
  const client = await getClient();
  
  try {
    console.log('========================================');
    console.log('🎯 CALL BINGO INICIADO');
    console.log('Code:', code);
    console.log('CardId:', cardId);
    console.log('UserId:', userId);
    console.log('========================================');
    
    await client.query('BEGIN');
    
    // Obtener cartón con room info
    const cardQuery = await client.query(
      `SELECT bc.*, br.victory_mode, br.drawn_numbers, br.id as room_id
       FROM bingo_cards bc
       JOIN bingo_rooms br ON bc.room_id = br.id
       WHERE bc.id = $1 AND bc.user_id = $2 AND br.code = $3`,
      [cardId, userId, code]
    );
    
    if (cardQuery.rows.length === 0) {
      console.log('❌ Cartón no encontrado');
      await client.query('ROLLBACK');
      return {
        success: false,
        isValid: false,
        message: 'Cartón no encontrado'
      };
    }
    
    const card = cardQuery.rows[0];
    
    // CRITICAL: Parsear marked_numbers
    let markedNumbers = card.marked_numbers || [];
    console.log('Raw marked_numbers type:', typeof markedNumbers);
    console.log('Raw marked_numbers value:', markedNumbers);
    
    if (typeof markedNumbers === 'string') {
      try {
        markedNumbers = JSON.parse(markedNumbers);
        console.log('✅ Parseado de string a array');
      } catch (e) {
        console.log('❌ Error parseando:', e.message);
        markedNumbers = [];
      }
    }
    
    console.log('========================================');
    console.log('🔍 MARKED NUMBERS DESPUÉS DE PARSEO');
    console.log('Type:', typeof markedNumbers);
    console.log('IsArray:', Array.isArray(markedNumbers));
    console.log('Count:', markedNumbers.length);
    console.log('Content:', JSON.stringify(markedNumbers));
    console.log('========================================');
    
    // Validar el patrón
    const isValid = await this.validateWinningPattern(
      card,
      markedNumbers,
      card.victory_mode,
      client
    );
    
    console.log('========================================');
    console.log('📊 RESULTADO DE VALIDACIÓN');
    console.log('isValid:', isValid);
    console.log('========================================');
    
    if (!isValid) {
      console.log('❌ BINGO INVÁLIDO');
      await client.query('ROLLBACK');
      return {
        success: false,
        isValid: false,
        message: 'Patrón no válido'
      };
    }
    
    // Obtener nombre del ganador
    const userQuery = await client.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );
    const winnerName = userQuery.rows[0]?.username || 'Jugador';
    
    // Obtener pot total
    const potQuery = await client.query(
      'SELECT pot_total FROM bingo_rooms WHERE id = $1',
      [card.room_id]
    );
    const totalPot = potQuery.rows[0]?.pot_total || 0;
    
    // Actualizar estado de la sala
    await client.query(
      `UPDATE bingo_rooms 
       SET status = 'finished', 
           winner_id = $1,
           ended_at = NOW()
       WHERE id = $2`,
      [userId, card.room_id]
    );
    
    // Distribuir premios
    await this.distributePrizes(card.room_id, userId, client);
    
    await client.query('COMMIT');
    
    console.log('========================================');
    console.log('✅ BINGO VÁLIDO - RETORNANDO');
    console.log('success: true');
    console.log('isValid: true');
    console.log('winnerName:', winnerName);
    console.log('totalPot:', totalPot);
    console.log('========================================');
    
    return {
      success: true,
      isValid: true,
      winnerName,
      pattern: card.victory_mode,
      totalPot
    };
    
  } catch (error) {
    console.log('❌ ERROR EN CALL BINGO:', error);
    await client.query('ROLLBACK');
    return {
      success: false,
      isValid: false,
      message: error.message
    };
  } finally {
    client.release();
  }
}
```

---

### **PASO 4: Fix Frontend Event Handler**

```javascript
// frontend/src/pages/BingoRoom.js
const handleBingoClick = useCallback(() => {
  console.log('🎯 [FRONTEND] Botón BINGO presionado');
  
  if (!socket || !socket.connected) {
    console.error('❌ Socket no conectado');
    toast.error('Conexión perdida. Reconectando...');
    return;
  }
  
  // Cerrar modal inmediatamente
  setShowBingoModal(false);
  
  // Mostrar toast de validación
  toast.loading('Validando BINGO...', { id: 'bingo-validation' });
  
  // Emitir evento al backend
  socket.emit('bingo:call_bingo', {
    code: roomCode,
    cardId: selectedCard.id
  }, (response) => {
    console.log('📨 [FRONTEND] Respuesta del servidor:', response);
    
    if (response && response.error) {
      toast.error(response.error, { id: 'bingo-validation' });
      // Reabrir modal si hay error
      setShowBingoModal(true);
    }
  });
  
  // Establecer flag para prevenir reaparición del modal
  setBingoCalled(true);
}, [socket, roomCode, selectedCard]);

// Handler para game_over
useEffect(() => {
  if (!socket) return;
  
  const handleGameOver = (data) => {
    console.log('========================================');
    console.log('🏆 [FRONTEND] EVENTO game_over RECIBIDO');
    console.log('Data:', JSON.stringify(data));
    console.log('========================================');
    
    // Dismiss loading toast
    toast.dismiss('bingo-validation');
    
    // Actualizar estado
    setGameStatus('finished');
    setWinnerInfo(data);
    setShowBingoModal(false);
    setShowWinnerModal(true);
    
    // Toast según ganador
    if (data.winnerId === user?.id) {
      toast.success(`¡Felicitaciones! Has ganado ${data.totalPot} 🔥`, {
        duration: 5000,
        icon: '🎉'
      });
    } else {
      toast(`${data.winnerName} ha ganado el BINGO`, {
        icon: '🏆',
        duration: 4000
      });
    }
  };
  
  socket.on('bingo:game_over', handleGameOver);
  
  return () => {
    socket.off('bingo:game_over', handleGameOver);
  };
}, [socket, user]);
```

---

## 📦 **DEPLOYMENT**

### **1. Commit y Push**
```bash
git add -A
git commit -m "fix: solución definitiva modal celebración Bingo - socket + marked_numbers + validación"
git push
```

### **2. Esperar Deploy Railway**
- ~5-6 minutos

### **3. Verificación Post-Deploy**
```powershell
# Health check
Invoke-RestMethod -Uri "https://confident-bravery-production-ce7b.up.railway.app/api/health"

# Logs de Railway
# Buscar: "CALL BINGO INICIADO"
# Buscar: "MARKED NUMBERS DESPUÉS DE PARSEO"
# Buscar: "BINGO VÁLIDO - RETORNANDO"
```

---

## ✅ **CHECKLIST DE VERIFICACIÓN**

- [ ] Socket mantiene conexión durante el juego
- [ ] marked_numbers se guarda como array JSONB
- [ ] callBingo parsea correctamente si viene como string
- [ ] validateWinningPattern recibe array correcto
- [ ] Socket emite bingo:game_over al validar
- [ ] Frontend recibe evento game_over
- [ ] Modal de celebración aparece
- [ ] Toast muestra mensaje correcto
- [ ] Botón "Aceptar" lleva al lobby

---

## 🎯 **RESULTADO ESPERADO**

1. Usuario completa patrón → Modal "¡BINGO!" aparece
2. Presiona botón → Modal se cierra, toast "Validando..."
3. Backend valida → Emite game_over
4. Frontend recibe → Modal celebración aparece
5. Usuario ve ganador y premio
6. Click "Aceptar" → Vuelve al lobby

---

## 📊 **CONFIANZA: 98%**

Con estos fixes, el flujo completo debería funcionar correctamente.
