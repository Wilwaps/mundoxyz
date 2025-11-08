# 🎯 PLAN MAESTRO: Refactorización Sistema de Rifas V2

**Fecha:** 7 Noviembre 2025  
**Objetivo:** Reconstruir sistema de rifas desde cero con arquitectura limpia  
**Duración estimada:** 3-4 sesiones (12-16 horas)  
**Prioridad:** CRÍTICA

---

## 📋 FILOSOFÍA DEL REBUILD

### Principios Core:
1. **Single Source of Truth** - Un solo query controla toda la data
2. **Sincronización Garantizada** - WebSocket + Optimistic Updates
3. **Estado Centralizado** - React Query como estado global
4. **Componentes Puros** - Zero lógica de negocio en componentes
5. **Tipos Explícitos** - PropTypes/TypeScript para contratos claros

### Lecciones Aplicadas:
- ✅ Intervalos sincronizados desde el diseño
- ✅ Query keys consistentes en toda la app
- ✅ WebSocket events tipados y documentados
- ✅ Keys reactivos en componentes complejos
- ✅ Invalidaciones secuenciales (async/await)
- ✅ Zero race conditions por diseño

---

## 🏗️ ARQUITECTURA NUEVA

### Estructura de Carpetas:
```
frontend/src/
├── features/
│   └── raffles/
│       ├── api/              # API calls y endpoints
│       │   ├── raffleApi.js
│       │   ├── numberApi.js
│       │   └── requestApi.js
│       ├── hooks/            # Custom hooks
│       │   ├── useRaffleData.js        # Hook maestro
│       │   ├── useRaffleNumbers.js
│       │   ├── useRaffleSync.js        # WebSocket sync
│       │   └── useNumberActions.js
│       ├── components/       # Componentes presentacionales
│       │   ├── RaffleHeader/
│       │   ├── RaffleInfo/
│       │   ├── NumberGrid/
│       │   ├── BuyNumberModal/
│       │   └── ParticipantsModal/
│       ├── pages/            # Páginas principales
│       │   ├── RaffleRoom.js
│       │   ├── RafflesLobby.js
│       │   └── RafflePublicLanding.js
│       ├── types/            # Type definitions
│       │   └── raffle.types.js
│       ├── utils/            # Utilidades
│       │   ├── raffleHelpers.js
│       │   └── numberHelpers.js
│       └── constants/        # Constantes
│           └── raffleConstants.js
```

---

## 📐 FASE 1: FUNDACIÓN (Sesión 1 - 3 horas)

### 1.1 Crear Estructura Base
- [ ] Crear carpeta `features/raffles/`
- [ ] Crear subcarpetas (api, hooks, components, etc)
- [ ] Crear archivos de tipos
- [ ] Crear constantes compartidas

### 1.2 Definir Tipos y Constantes
**Archivo:** `types/raffle.types.js`
```javascript
export const RaffleStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

export const NumberState = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  SOLD: 'sold'
};

export const SYNC_CONFIG = {
  REFETCH_INTERVAL: 5000,
  STALE_TIME: 3000,
  CACHE_TIME: 300000
};
```

### 1.3 API Layer (Single Responsibility)
**Archivo:** `api/raffleApi.js`
```javascript
import axios from 'axios';
import API_URL from '../../../config/api';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});

export const raffleApi = {
  getByCode: (code) => client.get(`/api/raffles/${code}`),
  getNumbers: (code) => client.get(`/api/raffles/${code}/numbers`),
  getPaymentDetails: (raffleId) => client.get(`/api/raffles/${raffleId}/payment-details`),
  getPublicList: (params) => client.get(`/api/raffles/public`, { params })
};

export const numberApi = {
  reserve: (raffleId, numberIdx) => 
    client.post(`/api/raffles/${raffleId}/reserve-number`, { number_idx: numberIdx }),
  release: (raffleId, numberIdx) => 
    client.post(`/api/raffles/${raffleId}/release-number`, { number_idx: numberIdx }),
  requestPurchase: (raffleId, numberIdx, buyerData) => 
    client.post(`/api/raffles/${raffleId}/request-number`, { 
      number_idx: numberIdx, 
      buyer_profile: buyerData 
    })
};
```

### 1.4 Checkpoint Fase 1
- ✅ Estructura creada y organizada
- ✅ Tipos definidos y exportados
- ✅ API layer con single responsibility
- ✅ Constantes centralizadas

---

## 🔗 FASE 2: HOOKS MAESTROS (Sesión 1 - 2 horas)

### 2.1 Hook Maestro de Rifa
**Archivo:** `hooks/useRaffleData.js`
```javascript
import { useQuery } from '@tanstack/react-query';
import { raffleApi } from '../api/raffleApi';
import { SYNC_CONFIG } from '../constants/raffleConstants';

export const useRaffleData = (code) => {
  const raffleQuery = useQuery({
    queryKey: ['raffle', code],
    queryFn: () => raffleApi.getByCode(code).then(res => res.data.data),
    refetchInterval: SYNC_CONFIG.REFETCH_INTERVAL,
    staleTime: SYNC_CONFIG.STALE_TIME,
    enabled: !!code
  });

  const numbersQuery = useQuery({
    queryKey: ['raffle-numbers', code],
    queryFn: () => raffleApi.getNumbers(code).then(res => res.data.data),
    refetchInterval: SYNC_CONFIG.REFETCH_INTERVAL,
    staleTime: SYNC_CONFIG.STALE_TIME,
    enabled: !!raffleQuery.data
  });

  // Derivar estado combinado
  const combined = {
    raffle: raffleQuery.data,
    numbers: numbersQuery.data || [],
    isLoading: raffleQuery.isLoading || numbersQuery.isLoading,
    error: raffleQuery.error || numbersQuery.error
  };

  return {
    ...combined,
    refetch: () => {
      raffleQuery.refetch();
      numbersQuery.refetch();
    }
  };
};
```

### 2.2 Hook de Sincronización WebSocket
**Archivo:** `hooks/useRaffleSync.js`
```javascript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../../contexts/SocketContext';

export const useRaffleSync = (raffleId, code) => {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !raffleId) return;

    socket.emit('join-raffle', raffleId);

    const handlers = {
      'raffle:number-reserved': async (data) => {
        await queryClient.invalidateQueries(['raffle-numbers', code]);
      },
      'raffle:number-released': async (data) => {
        await queryClient.invalidateQueries(['raffle-numbers', code]);
      },
      'raffle:number-purchased': async (data) => {
        await queryClient.invalidateQueries(['raffle-numbers', code]);
        await queryClient.invalidateQueries(['raffle', code]);
      },
      'raffle:updated': async (data) => {
        await queryClient.invalidateQueries(['raffle', code]);
      }
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach(event => socket.off(event));
      socket.emit('leave-raffle', raffleId);
    };
  }, [socket, raffleId, code, queryClient]);
};
```

### 2.3 Hook de Acciones de Números
**Archivo:** `hooks/useNumberActions.js`
```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { numberApi } from '../api/numberApi';

export const useNumberActions = (raffleId, code) => {
  const queryClient = useQueryClient();

  const reserveMutation = useMutation({
    mutationFn: (numberIdx) => numberApi.reserve(raffleId, numberIdx),
    onSuccess: async () => {
      await queryClient.invalidateQueries(['raffle-numbers', code]);
    }
  });

  const releaseMutation = useMutation({
    mutationFn: (numberIdx) => numberApi.release(raffleId, numberIdx),
    onSuccess: async () => {
      await queryClient.invalidateQueries(['raffle-numbers', code]);
    }
  });

  const purchaseMutation = useMutation({
    mutationFn: ({ numberIdx, buyerData }) => 
      numberApi.requestPurchase(raffleId, numberIdx, buyerData),
    onSuccess: async () => {
      await queryClient.invalidateQueries(['raffle-numbers', code]);
      await queryClient.invalidateQueries(['raffle', code]);
    }
  });

  return {
    reserve: reserveMutation.mutateAsync,
    release: releaseMutation.mutateAsync,
    purchase: purchaseMutation.mutateAsync,
    isReserving: reserveMutation.isLoading,
    isPurchasing: purchaseMutation.isLoading
  };
};
```

### 2.4 Checkpoint Fase 2
- ✅ Hook maestro combina raffle + numbers
- ✅ Hook sync maneja WebSocket limpiamente
- ✅ Hook actions centraliza mutaciones
- ✅ Invalidaciones async/await garantizadas

---

## 🎨 FASE 3: COMPONENTES PUROS (Sesión 2 - 4 horas)

### 3.1 NumberGrid Optimizado
**Archivo:** `components/NumberGrid/NumberGrid.js`
```javascript
import React, { useMemo } from 'react';
import NumberCell from './NumberCell';
import { generateNumbersKey } from '../../utils/numberHelpers';

const NumberGrid = ({ numbers, onNumberClick, user, disabled }) => {
  // Key reactivo para forzar re-render
  const gridKey = useMemo(() => 
    generateNumbersKey(numbers), 
    [numbers]
  );

  return (
    <div key={gridKey} className="number-grid">
      {numbers.map(num => (
        <NumberCell
          key={num.number_idx}
          number={num}
          onClick={() => onNumberClick(num.number_idx)}
          isOwn={num.owner_id === user?.id}
          disabled={disabled}
        />
      ))}
    </div>
  );
};

export default React.memo(NumberGrid);
```

### 3.2 BuyNumberModal Simplificado
**Archivo:** `components/BuyNumberModal/BuyNumberModal.js`
```javascript
import React, { useState, useEffect } from 'react';
import { useNumberActions } from '../../hooks/useNumberActions';

const BuyNumberModal = ({ raffle, numberIdx, onClose, onSuccess }) => {
  const { reserve, release, purchase } = useNumberActions(raffle.id, raffle.code);
  const [buyerData, setBuyerData] = useState({ /* ... */ });

  useEffect(() => {
    reserve(numberIdx);
    return () => release(numberIdx);
  }, [numberIdx, reserve, release]);

  const handleSubmit = async () => {
    await purchase({ numberIdx, buyerData });
    onSuccess();
    onClose();
  };

  return (/* UI */);
};

export default BuyNumberModal;
```

### 3.3 RaffleRoom Refactorizado
**Archivo:** `pages/RaffleRoom.js`
```javascript
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRaffleData } from '../hooks/useRaffleData';
import { useRaffleSync } from '../hooks/useRaffleSync';
import NumberGrid from '../components/NumberGrid';
import BuyNumberModal from '../components/BuyNumberModal';

const RaffleRoom = () => {
  const { code } = useParams();
  const { raffle, numbers, isLoading, refetch } = useRaffleData(code);
  const [selectedNumber, setSelectedNumber] = useState(null);

  // Sincronización automática
  useRaffleSync(raffle?.id, code);

  if (isLoading) return <LoadingSpinner />;
  if (!raffle) return <NotFound />;

  return (
    <div>
      <RaffleHeader raffle={raffle} />
      <RaffleInfo raffle={raffle} />
      <NumberGrid 
        numbers={numbers}
        onNumberClick={setSelectedNumber}
        user={user}
      />
      {selectedNumber && (
        <BuyNumberModal
          raffle={raffle}
          numberIdx={selectedNumber}
          onClose={() => setSelectedNumber(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};

export default RaffleRoom;
```

### 3.4 Checkpoint Fase 3
- ✅ Componentes presentacionales puros
- ✅ Lógica en hooks reutilizables
- ✅ Zero dependencias cruzadas
- ✅ Keys reactivos automáticos

---

## 🧪 FASE 4: TESTING Y VALIDACIÓN (Sesión 3 - 3 horas)

### 4.1 Tests Unitarios
- [ ] Test useRaffleData hook
- [ ] Test useRaffleSync hook
- [ ] Test useNumberActions hook
- [ ] Test NumberGrid rendering
- [ ] Test BuyNumberModal lifecycle

### 4.2 Tests de Integración
- [ ] Test reserva → visual
- [ ] Test compra → sincronización
- [ ] Test WebSocket → invalidación
- [ ] Test navegación lobby → room

### 4.3 Tests E2E (Manual)
- [ ] 2 usuarios simultáneos
- [ ] Reserva competitiva
- [ ] Compra exitosa
- [ ] Sin race conditions

### 4.4 Checkpoint Fase 4
- ✅ Tests passing al 100%
- ✅ Coverage > 80%
- ✅ Zero warnings en console
- ✅ Performance optimizada

---

## 🚀 FASE 5: MIGRACIÓN Y DEPLOY (Sesión 3-4 - 4 horas)

### 5.1 Estrategia de Migración
1. **Branch feature:** `refactor/raffle-system-v2`
2. **Desarrollo paralelo:** Sistema viejo sigue funcionando
3. **Feature flag:** Toggle entre v1 y v2
4. **Deploy incremental:** Por página (Lobby → Room → Public)

### 5.2 Plan de Rollback
```javascript
// frontend/src/config/features.js
export const FEATURES = {
  RAFFLE_SYSTEM_V2: process.env.REACT_APP_RAFFLE_V2 === 'true'
};

// Uso en Router
{FEATURES.RAFFLE_SYSTEM_V2 ? (
  <RaffleRoomV2 />
) : (
  <RaffleRoom />
)}
```

### 5.3 Checklist de Deploy
- [ ] Tests passing en CI/CD
- [ ] Bundle size < 500KB
- [ ] Lighthouse score > 90
- [ ] No memory leaks
- [ ] WebSocket estable
- [ ] Feature flag activo

### 5.4 Monitoreo Post-Deploy
- [ ] Error tracking (Sentry)
- [ ] Performance metrics
- [ ] User feedback
- [ ] A/B testing results

---

## 📊 MÉTRICAS DE ÉXITO

### Performance:
- ✅ Sincronización < 500ms
- ✅ First Paint < 1s
- ✅ Interactive < 2s
- ✅ Zero race conditions

### Código:
- ✅ Líneas reducidas 40%
- ✅ Complejidad ciclomática < 10
- ✅ Test coverage > 80%
- ✅ Zero props drilling

### UX:
- ✅ Sin parpadeos
- ✅ Actualizaciones smooth
- ✅ Feedback inmediato
- ✅ Estados claros

---

## 🎯 CRONOGRAMA DETALLADO

### Sesión 1 (4-5 horas):
- 9:00-10:00: Fase 1.1-1.2 (Estructura + Tipos)
- 10:00-11:00: Fase 1.3-1.4 (API Layer)
- 11:00-13:00: Fase 2 (Hooks Maestros)
- 13:00-13:30: Review + Checkpoint

### Sesión 2 (4-5 horas):
- 14:00-16:00: Fase 3.1-3.2 (Components)
- 16:00-18:00: Fase 3.3-3.4 (Pages + Integration)
- 18:00-18:30: Review + Checkpoint

### Sesión 3 (4-5 horas):
- 9:00-12:00: Fase 4 (Testing)
- 12:00-13:00: Fase 5.1-5.2 (Migración)
- 13:00-13:30: Review + Checkpoint

### Sesión 4 (2-3 horas):
- 14:00-15:00: Fase 5.3 (Deploy)
- 15:00-16:00: Fase 5.4 (Monitoreo)
- 16:00-17:00: Documentación final

**TOTAL:** 14-18 horas

---

## 🔧 HERRAMIENTAS Y SETUP

### Development:
- ESLint + Prettier configurados
- React DevTools
- React Query DevTools
- Redux DevTools (si necesario)

### Testing:
- Jest + React Testing Library
- Cypress (E2E)
- MSW (API mocking)

### Monitoreo:
- Chrome DevTools Performance
- Lighthouse CI
- Bundle Analyzer

---

## 📝 DOCUMENTACIÓN REQUERIDA

### Por Fase:
- [ ] README de arquitectura
- [ ] Guía de hooks
- [ ] Guía de componentes
- [ ] API documentation
- [ ] Migration guide

### Final:
- [ ] Changelog detallado
- [ ] Breaking changes
- [ ] Performance improvements
- [ ] Future roadmap

---

## ⚠️ RIESGOS Y MITIGACIONES

### Riesgo 1: Sistema viejo se rompe
**Mitigación:** Branch separado + feature flag

### Riesgo 2: Performance worse
**Mitigación:** Benchmarks antes/después

### Riesgo 3: Bugs en producción
**Mitigación:** Rollout gradual 10% → 50% → 100%

### Riesgo 4: Usuario confundido
**Mitigación:** UI identical, solo arquitectura cambia

---

## 🎓 PUNTOS CLAVE

1. **NO tocar sistema viejo** hasta que v2 esté 100% listo
2. **Feature flag** para toggle instantáneo
3. **Tests primero** antes de migrar UI
4. **Monitoreo constante** post-deploy
5. **Documentar TODO** para mantenimiento futuro

---

**PRÓXIMO PASO:** Confirmar plan y comenzar Fase 1.1

**¿COMENZAMOS?** ✅
