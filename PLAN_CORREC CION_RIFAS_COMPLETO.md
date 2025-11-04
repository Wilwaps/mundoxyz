# 📋 PLAN DE CORRECCIÓN COMPLETO - SISTEMA DE RIFAS

**Fecha:** 2025-11-04 11:21 AM  
**Prioridad:** 🔴 CRÍTICA  
**Scope:** Backend + Frontend + Arquitectura

---

## 🚨 PROBLEMAS IDENTIFICADOS

### 1. ❌ Reembolso Incompleto al Cancelar Rifa
**Problema:**
- El modal de cancelación dice "no hay dinero que reembolsar"
- `cancelRaffleWithRefund` SOLO reembolsa a los compradores de números
- NO reembolsa el `creation_cost` (300🔥 o 3000🔥) pagado por el host

**Causa:**
```javascript
// backend/services/RaffleService.js líneas 1672-1687
// Solo reembolsa números vendidos, NO creation_cost del host
const soldNumbers = await client.query(`
    SELECT number_idx, owner_id FROM raffle_numbers 
    WHERE raffle_id = $1 AND state = 'sold'
`, [raffleId]);

// Reembolsar a cada comprador
for (const num of soldNumbers.rows) {
    await client.query(`
        UPDATE wallets SET fires_balance = fires_balance + $1 WHERE user_id = $2
    `, [cost, num.owner_id]);
}
// ❌ FALTA: Reembolsar creation_cost al host
```

**Impacto:**
- Host pierde 300/3000 fuegos al cancelar rifa
- Modal muestra información incorrecta
- Sistema injusto para el host

---

### 2. ❌ Botón de Cancelar en Ubicación Incorrecta
**Problema:**
- Botón ❌ está dentro de `RaffleDetails` (al entrar a una rifa)
- DEBERÍA estar en el LOBBY (lista de rifas)

**Ubicación actual:**
```
/raffles/:code → RaffleDetails.js → Botón ❌ aquí (INCORRECTO)
```

**Ubicación deseada:**
```
/raffles/lobby → RafflesLobby.js → Botón ❌ en cada card (CORRECTO)
```

**Impacto:**
- Usabilidad pobre (hay que entrar a cada rifa)
- Admin no puede cancelar rápidamente desde el lobby
- Inconsistente con sistema de bingo

---

### 3. ❌ Rutas Duplicadas y Confusas
**Problema:**
```javascript
// App.js líneas 118-119
<Route path="raffles" element={<Raffles />} />         // ❌ Viejo, sin uso
<Route path="raffles/lobby" element={<RafflesLobby />} />  // ✅ Completo
```

**Componentes:**
- `Raffles.js`: Componente antiguo, simple, dice "próximamente"
- `RafflesLobby.js`: Componente nuevo, completo, funcional

**Impacto:**
- Confusión de navegación
- Dos puntos de entrada inconsistentes
- Código legacy innecesario
- Dificulta mantenimiento

---

## ✅ SOLUCIÓN INTEGRAL PROPUESTA

### FASE 1: Backend - Reembolso Completo ⭐ CRÍTICO

#### A. Actualizar `cancelRaffleWithRefund`

**Archivo:** `backend/services/RaffleService.js`  
**Método:** `cancelRaffleWithRefund` (líneas 1650-1722)

**Cambios:**
1. **Obtener `creation_cost` de la rifa:**
   ```javascript
   // Calcular creation_cost según configuración
   const isCompanyMode = raffleData.is_company_mode;
   const creationCost = isCompanyMode ? 3000 : (raffleData.mode === 'fires' ? 300 : 0);
   ```

2. **Reembolsar al host:**
   ```javascript
   // Reembolsar creation_cost al host (si corresponde)
   if (creationCost > 0) {
       await client.query(`
           UPDATE wallets 
           SET fires_balance = fires_balance + $1 
           WHERE user_id = $2
       `, [creationCost, raffleData.host_id]);
       
       // Registrar transacción
       await client.query(`
           INSERT INTO wallet_transactions 
           (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
           VALUES (
               (SELECT id FROM wallets WHERE user_id = $1),
               'raffle_creation_refund', 'fires', $2,
               (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
               (SELECT fires_balance FROM wallets WHERE user_id = $1),
               $3, $4
           )
       `, [raffleData.host_id, creationCost, raffleData.code, `Reembolso creación rifa ${raffleData.code}`]);
   }
   ```

3. **Actualizar retorno:**
   ```javascript
   return { 
       success: true, 
       refunded_users: soldNumbers.rows.length,
       refunded_buyers_amount: cost * soldNumbers.rows.length,
       refunded_host_amount: creationCost,
       total_refunded: (cost * soldNumbers.rows.length) + creationCost
   };
   ```

**Resultado esperado:**
- ✅ Host recupera 300/3000 fuegos
- ✅ Compradores recuperan su inversión
- ✅ Transacciones registradas correctamente
- ✅ Modal muestra información completa

---

### FASE 2: Frontend - Botón en Lobby ⭐ CRÍTICO

#### A. Mover botón a `RafflesLobby.js`

**Archivo:** `frontend/src/pages/RafflesLobby.js`  
**Ubicación:** Dentro del `RaffleCard` component (líneas 99-248)

**Cambios:**
1. **Importar CancelRaffleModal y verificación de roles:**
   ```javascript
   import CancelRaffleModal from '../components/raffle/CancelRaffleModal';
   import { useAuth } from '../contexts/AuthContext';
   
   const { user } = useAuth();
   const isAdminOrTote = (user?.roles || []).some(r => r === 'admin' || r === 'tote');
   ```

2. **Agregar estado para modal:**
   ```javascript
   const [cancelModal, setCancelModal] = useState({ isOpen: false, raffle: null });
   ```

3. **Agregar botón en RaffleCard:**
   ```jsx
   {/* Admin/Tote: Botón cancelar - SOLO en cards del lobby */}
   {isAdminOrTote && (raffle.status === 'active' || raffle.status === 'pending') && (
     <button
       onClick={(e) => {
         e.stopPropagation(); // Prevenir navegación
         setCancelModal({ isOpen: true, raffle });
       }}
       className="absolute top-2 left-2 z-10 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg"
       title="Cancelar rifa (Admin/Tote)"
     >
       <XCircle size={18} />
     </button>
   )}
   ```

4. **Renderizar modal fuera del map:**
   ```jsx
   {/* Modal de cancelación */}
   <CancelRaffleModal
     isOpen={cancelModal.isOpen}
     onClose={() => setCancelModal({ isOpen: false, raffle: null })}
     raffle={cancelModal.raffle}
     onCancelled={() => {
       refetch();
       queryClient.invalidateQueries(['raffles']);
       setCancelModal({ isOpen: false, raffle: null });
     }}
   />
   ```

#### B. Remover botón de `RaffleDetails.js`

**Archivo:** `frontend/src/pages/RaffleDetails.js`  
**Acción:** Eliminar líneas 449-467 (botón ❌ y su lógica)

**Resultado esperado:**
- ✅ Botón visible en lobby para cada rifa
- ✅ Admin puede cancelar sin entrar a la rifa
- ✅ UX consistente con bingo
- ✅ No hay botón dentro de RaffleDetails

---

### FASE 3: Frontend - Consolidar Rutas ⭐ IMPORTANTE

#### A. Eliminar componente `Raffles.js`

**Acción:**
1. Eliminar archivo `frontend/src/pages/Raffles.js`
2. Remover import en `App.js`

#### B. Actualizar rutas en `App.js`

**Archivo:** `frontend/src/App.js` (líneas 118-119)

**ANTES:**
```javascript
<Route path="raffles" element={<Raffles />} />
<Route path="raffles/lobby" element={<RafflesLobby />} />
```

**DESPUÉS:**
```javascript
<Route path="raffles" element={<RafflesLobby />} />
<Route path="raffles/lobby" element={<Navigate to="/raffles" replace />} />
```

**Explicación:**
- Ruta principal `/raffles` → `RafflesLobby` (componente completo)
- Ruta legacy `/raffles/lobby` → Redirect a `/raffles`
- Mantiene compatibilidad con links antiguos
- Consolida navegación

#### C. Actualizar navegación en componentes

**Archivos a revisar:**
- `Games.js` (botón "Ver Rifas")
- `Layout.js` (menú navegación)
- `CreateRaffleModal.js` (redirect después de crear)

**Cambios:**
```javascript
// ANTES
navigate('/raffles/lobby');

// DESPUÉS
navigate('/raffles');
```

**Resultado esperado:**
- ✅ Una sola ruta canónica: `/raffles`
- ✅ No hay confusión
- ✅ Código limpio y mantenible
- ✅ Links antiguos siguen funcionando

---

### FASE 4: Frontend - Actualizar Modal de Cancelación

#### A. Actualizar `CancelRaffleModal.js`

**Archivo:** `frontend/src/components/raffle/CancelRaffleModal.js`

**Cambios:**
1. **Calcular creation_cost del host:**
   ```javascript
   const isCompanyMode = raffle?.is_company_mode || false;
   const creationCost = isCompanyMode ? 3000 : (raffle?.mode === 'fires' ? 300 : 0);
   ```

2. **Actualizar sección de reembolso:**
   ```jsx
   {/* Información del reembolso */}
   <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 space-y-2">
     <div className="flex items-center gap-2 text-orange-400 font-semibold mb-2">
       <DollarSign size={20} />
       <span>Reembolso Automático</span>
     </div>
     
     {/* Reembolso a compradores */}
     <div className="flex justify-between text-sm">
       <span className="text-gray-300">Números vendidos:</span>
       <span className="text-white font-semibold">{soldNumbers.length}</span>
     </div>
     <div className="flex justify-between text-sm">
       <span className="text-gray-300">Usuarios afectados:</span>
       <span className="text-white font-semibold">{uniqueBuyers}</span>
     </div>
     <div className="flex justify-between text-sm">
       <span className="text-gray-300">Reembolso compradores:</span>
       <span className="text-white font-semibold">{totalRefund} 🔥</span>
     </div>
     
     {/* Reembolso al host */}
     {creationCost > 0 && (
       <>
         <div className="border-t border-orange-500/20 my-2"></div>
         <div className="flex justify-between text-sm">
           <span className="text-gray-300">Reembolso host (creación):</span>
           <span className="text-white font-semibold">{creationCost} 🔥</span>
         </div>
       </>
     )}
     
     {/* Total */}
     <div className="flex justify-between text-sm pt-2 border-t border-orange-500/20">
       <span className="text-gray-300 font-bold">TOTAL A REEMBOLSAR:</span>
       <span className="text-orange-400 font-bold text-lg">
         {totalRefund + creationCost} 🔥
       </span>
     </div>
   </div>
   ```

**Resultado esperado:**
- ✅ Modal muestra reembolso completo
- ✅ Distingue entre compradores y host
- ✅ Total correcto visible
- ✅ Información transparente

---

## 📊 RESUMEN DE CAMBIOS

### Backend (1 archivo)
| Archivo | Método | Cambio | Líneas |
|---------|--------|--------|--------|
| `RaffleService.js` | `cancelRaffleWithRefund` | Agregar reembolso creation_cost al host | +30 |

### Frontend (4 archivos)
| Archivo | Acción | Cambio | Líneas |
|---------|--------|--------|--------|
| `RafflesLobby.js` | Agregar botón ❌ en cards | Importar modal + botón + estado | +50 |
| `RaffleDetails.js` | Remover botón ❌ | Eliminar sección completa | -20 |
| `CancelRaffleModal.js` | Actualizar cálculos | Mostrar creation_cost | +30 |
| `App.js` | Consolidar rutas | Redirigir /raffles/lobby → /raffles | +1 |
| `Raffles.js` | Eliminar archivo | Legacy component | -141 |

**Total líneas modificadas:** ~230 líneas  
**Archivos afectados:** 5 archivos

---

## 🎯 ORDEN DE EJECUCIÓN

### 1️⃣ **FASE 1: Backend** (15 min)
- ✅ Fix `cancelRaffleWithRefund` en `RaffleService.js`
- ✅ Testing manual con Postman

### 2️⃣ **FASE 2: Frontend - Modal** (10 min)
- ✅ Actualizar `CancelRaffleModal.js`
- ✅ Verificar cálculos

### 3️⃣ **FASE 3: Frontend - Botón** (15 min)
- ✅ Mover botón a `RafflesLobby.js`
- ✅ Remover de `RaffleDetails.js`

### 4️⃣ **FASE 4: Frontend - Rutas** (10 min)
- ✅ Consolidar rutas en `App.js`
- ✅ Eliminar `Raffles.js`
- ✅ Actualizar navegación

### 5️⃣ **FASE 5: Testing** (20 min)
- ✅ Crear rifa modo fires (300🔥)
- ✅ Comprar números
- ✅ Cancelar desde lobby
- ✅ Verificar reembolsos en wallets
- ✅ Verificar transacciones
- ✅ Testing con Chrome DevTools

**Tiempo total estimado:** 70 minutos

---

## 🧪 PLAN DE TESTING

### Test 1: Reembolso Completo
```
1. Crear rifa modo fires (descuenta 300🔥 del host)
2. Comprar 3 números con otro usuario (10🔥 c/u = 30🔥)
3. Admin cancela desde lobby
4. VERIFICAR:
   ✅ Host recibe +300🔥 (creation_cost)
   ✅ Comprador recibe +30🔥 (números)
   ✅ Total reembolsado: 330🔥
   ✅ wallet_transactions registrado
   ✅ Toast: "Rifa cancelada. 1 usuario(s) + host reembolsados"
```

### Test 2: Rifa Sin Ventas
```
1. Crear rifa modo fires (300🔥)
2. NO comprar números
3. Admin cancela
4. VERIFICAR:
   ✅ Host recibe +300🔥
   ✅ Modal muestra: "0 compradores, 300🔥 host"
   ✅ Total: 300🔥
```

### Test 3: Rifa Modo Empresa
```
1. Crear rifa modo empresa (3000🔥)
2. Comprar números
3. Cancelar
4. VERIFICAR:
   ✅ Host recibe +3000🔥
   ✅ Compradores reembolsados
```

### Test 4: Botón en Lobby
```
1. Login como admin
2. Ir a /raffles
3. VERIFICAR:
   ✅ Cada card activa tiene botón ❌ (top-left)
   ✅ Click NO navega a la rifa
   ✅ Modal aparece directamente
   ✅ Cancelación funciona
```

### Test 5: Rutas Consolidadas
```
1. Navegar a /raffles
2. VERIFICAR: ✅ Muestra RafflesLobby
3. Navegar a /raffles/lobby
4. VERIFICAR: ✅ Redirige a /raffles
5. No existe componente Raffles.js
```

---

## ✅ CHECKLIST DE VALIDACIÓN

**Backend:**
- [ ] `cancelRaffleWithRefund` reembolsa creation_cost al host
- [ ] wallet_transactions registra reembolso
- [ ] Response incluye refunded_host_amount
- [ ] No errores en logs de Railway

**Frontend - Modal:**
- [ ] Calcula creation_cost correctamente
- [ ] Muestra reembolso compradores
- [ ] Muestra reembolso host
- [ ] Total es correcto
- [ ] Warning claro sobre irreversibilidad

**Frontend - Botón:**
- [ ] Botón ❌ visible en cada card del lobby
- [ ] Solo para admin/tote
- [ ] Solo rifas active/pending
- [ ] Click NO navega
- [ ] Modal aparece
- [ ] Cancelación funciona

**Frontend - Rutas:**
- [ ] /raffles muestra RafflesLobby
- [ ] /raffles/lobby redirige a /raffles
- [ ] Componente Raffles.js eliminado
- [ ] No errores de navegación
- [ ] Links antiguos funcionan

**Integración:**
- [ ] Flujo completo funciona end-to-end
- [ ] Wallets actualizadas correctamente
- [ ] Transacciones registradas
- [ ] UI consistente
- [ ] No regresiones

---

## 📈 IMPACTO ESPERADO

### Antes
- ❌ Host pierde 300🔥 al cancelar
- ❌ Botón dentro de cada rifa (mala UX)
- ❌ Dos rutas confusas
- ❌ Modal con info incorrecta

### Después
- ✅ Host recupera 300🔥
- ✅ Botón en lobby (UX óptima)
- ✅ Una ruta canónica
- ✅ Modal con info completa y correcta
- ✅ Sistema justo y transparente
- ✅ Consistente con bingo

---

## 🚀 PRÓXIMOS PASOS

1. **Aprobar este plan**
2. **Ejecutar FASE 1 (Backend)**
3. **Ejecutar FASES 2-4 (Frontend)**
4. **Testing exhaustivo**
5. **Commit y deploy**
6. **Validación en producción**

---

*Plan creado el 2025-11-04 a las 11:21 AM*  
*Tiempo estimado: 70 minutos*  
*Prioridad: 🔴 CRÍTICA*
