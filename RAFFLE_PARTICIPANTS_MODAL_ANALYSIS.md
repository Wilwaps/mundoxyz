# ANÁLISIS: Modal de Participantes en Rifas V2

**Fecha:** 11 Nov 2025 17:08 UTC-4
**Feature:** Cambiar "Vendidos" por "Participantes" con modal informativo

---

## 📋 REQUERIMIENTO DEL USUARIO

### Cambios Visuales
1. **Grid "Vendidos" → "Participantes"**
   - Cambiar etiqueta de "Vendidos" a "Participantes"
   - Al hacer click → abrir modal con información de participantes

### Modal de Participantes

#### 🔥 **Modo FUEGOS (fires) - Vista General**
**Todos los usuarios ven:**
- Nombre de usuario del participante
- Números comprados por ese participante
- Ejemplo: "prueba1" → Números: 1, 2, 5, 7

#### 🏆 **Modo PREMIO (prize) - Vista por Rol**

**Host puede ver:**
- ✅ Información completa cargada por el usuario
- ✅ Botón "Aprobar" compra
- ✅ Botón "Rechazar" compra
- ✅ Datos de pago/transferencia subidos

**Resto de usuarios ven:**
- ✅ Solo nombre de usuario
- ✅ Números con los que participa

#### 🏢 **Modo EMPRESA (company) - Vista por Rol**

**Funciona igual que modo PREMIO, adicionalmente:**
- ✅ Grid/Botón para abrir Landing de la empresa
- ✅ Link a la página pública de la rifa con branding

---

## 🔍 ANÁLISIS DEL CÓDIGO ACTUAL

### ✅ Backend - Lo que YA tenemos

#### 1. Tabla `raffle_numbers`
```sql
CREATE TABLE raffle_numbers (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER REFERENCES raffles(id),
  number_idx INTEGER NOT NULL,
  state VARCHAR(20) DEFAULT 'available',
  owner_id UUID REFERENCES users(id),
  reserved_by UUID REFERENCES users(id),
  reserved_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Columnas relevantes:**
- `owner_id`: Usuario que compró el número (cuando state='sold')
- `number_idx`: Número comprado (1, 2, 3, etc.)
- `state`: 'available' | 'reserved' | 'sold'

#### 2. Tabla `users`
```sql
-- Columnas relevantes:
- id UUID
- username VARCHAR
- display_name VARCHAR
- telegram_username VARCHAR
```

#### 3. Tabla `raffle_requests` (Para modo PREMIO y EMPRESA)
```sql
CREATE TABLE raffle_requests (
  id SERIAL PRIMARY KEY,
  raffle_id INTEGER REFERENCES raffles(id),
  number_idx INTEGER,
  buyer_id UUID REFERENCES users(id),
  buyer_profile JSONB,
  request_data JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Columnas relevantes:**
- `buyer_profile`: Datos del comprador (nombre, teléfono, etc.)
- `request_data`: Información de pago/transferencia
- `status`: 'pending' | 'approved' | 'rejected'

---

### ✅ Backend - Endpoints Existentes

#### GET `/api/raffles/v2/:code/numbers`
**Devuelve:** Todos los números de la rifa con su estado
```javascript
{
  success: true,
  data: [
    {
      number_idx: 1,
      state: 'sold',
      owner_id: 'uuid-aqui',
      reserved_by: null,
      reserved_until: null
    },
    // ...
  ]
}
```

#### GET `/api/raffles/v2/:code`
**Devuelve:** Detalle completo de la rifa
```javascript
{
  success: true,
  raffle: {
    id: 123,
    code: '636823',
    mode: 'fires' | 'prize' | 'company',
    host_id: 'uuid-host',
    // ...
  }
}
```

---

### ❌ Backend - Lo que FALTA implementar

#### 1. **GET `/api/raffles/v2/:code/participants`**
**Propósito:** Obtener lista de participantes con números

**Respuesta esperada (Modo FUEGOS):**
```javascript
{
  success: true,
  data: [
    {
      user_id: 'uuid-1',
      username: 'prueba1',
      display_name: 'Prueba Uno',
      numbers: [1, 2, 5, 7],
      total_numbers: 4
    },
    {
      user_id: 'uuid-2',
      username: 'usuario2',
      display_name: 'Usuario Dos',
      numbers: [3, 4, 6],
      total_numbers: 3
    }
  ],
  total_participants: 2
}
```

**Respuesta esperada (Modo PREMIO/EMPRESA - Host):**
```javascript
{
  success: true,
  data: [
    {
      request_id: 1,
      user_id: 'uuid-1',
      username: 'prueba1',
      display_name: 'Prueba Uno',
      buyer_profile: {
        full_name: 'Juan Pérez',
        phone: '+58 412 123 4567',
        email: 'juan@example.com',
        id_number: 'V-12345678'
      },
      numbers: [1, 2],
      request_data: {
        payment_method: 'bank',
        bank_code: '0102',
        reference: '123456789',
        proof_image_url: 'https://...'
      },
      status: 'pending',
      created_at: '2025-11-11T21:00:00Z'
    }
  ],
  total_participants: 1
}
```

**Respuesta esperada (Modo PREMIO/EMPRESA - Usuario normal):**
```javascript
{
  success: true,
  data: [
    {
      display_name: 'Prueba Uno',
      numbers: [1, 2],
      total_numbers: 2
    }
  ],
  total_participants: 1
}
```

---

#### 2. **POST `/api/raffles/v2/:code/requests/:requestId/approve`**
**Propósito:** Aprobar solicitud de compra (solo host)

**Request:**
```javascript
{
  // Sin body, solo autenticación
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Solicitud aprobada exitosamente',
  number_idx: 1
}
```

---

#### 3. **POST `/api/raffles/v2/:code/requests/:requestId/reject`**
**Propósito:** Rechazar solicitud de compra (solo host)

**Request:**
```javascript
{
  reason: 'Datos de pago incorrectos' // Opcional
}
```

**Response:**
```javascript
{
  success: true,
  message: 'Solicitud rechazada',
  number_idx: 1
}
```

---

### ✅ Frontend - Lo que YA tenemos

#### 1. Componente `RaffleRoom.tsx`
- Grid de estadísticas en línea 502-538
- Sistema de tabs (números, info, winners)
- Socket events configurados
- Hook `useRaffleData` para refetch

#### 2. Componente `NumberGrid` (backup)
- Grilla de números disponible en backup
- Sistema de selección de números

#### 3. Componente `ParticipantsModal` (backup)
- Modal existente en backup/frontend/components/raffles/
- Lista de participantes con números
- Avatar con inicial
- Contador de números por participante

---

### ❌ Frontend - Lo que FALTA implementar

#### 1. **Componente `ParticipantsModal.tsx` (Nuevo)**
**Ubicación:** `frontend/src/features/raffles/components/`

**Props:**
```typescript
interface ParticipantsModalProps {
  raffleCode: string;
  raffleMode: 'fires' | 'prize' | 'company';
  isHost: boolean;
  onClose: () => void;
}
```

**Estados necesarios:**
```typescript
- participants: Participant[]
- loading: boolean
- error: string | null
- selectedRequest: Request | null (para modo premio/empresa)
```

---

#### 2. **Componente `RequestApprovalModal.tsx` (Nuevo)**
**Ubicación:** `frontend/src/features/raffles/components/`

**Props:**
```typescript
interface RequestApprovalModalProps {
  request: Request;
  onApprove: () => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  onClose: () => void;
}
```

**Muestra:**
- Información completa del comprador
- Datos de pago/transferencia
- Imagen de comprobante (si existe)
- Botones Aprobar/Rechazar

---

#### 3. **Hook `useParticipants.ts`**
**Ubicación:** `frontend/src/features/raffles/hooks/`

```typescript
export const useParticipants = (raffleCode: string) => {
  return useQuery({
    queryKey: ['raffle-participants', raffleCode],
    queryFn: () => raffleApi.getParticipants(raffleCode)
  });
};

export const useApproveRequest = () => {
  return useMutation({
    mutationFn: ({code, requestId}) => 
      raffleApi.approveRequest(code, requestId)
  });
};

export const useRejectRequest = () => {
  return useMutation({
    mutationFn: ({code, requestId, reason}) => 
      raffleApi.rejectRequest(code, requestId, reason)
  });
};
```

---

#### 4. **API Client `raffles/api/index.ts`**
Agregar funciones:

```typescript
export const getParticipants = async (code: string) => {
  const response = await api.get(`/api/raffles/v2/${code}/participants`);
  return response.data;
};

export const approveRequest = async (code: string, requestId: number) => {
  const response = await api.post(
    `/api/raffles/v2/${code}/requests/${requestId}/approve`
  );
  return response.data;
};

export const rejectRequest = async (
  code: string, 
  requestId: number, 
  reason?: string
) => {
  const response = await api.post(
    `/api/raffles/v2/${code}/requests/${requestId}/reject`,
    { reason }
  );
  return response.data;
};
```

---

## 🎨 DISEÑO UI/UX

### Modal de Participantes - Modo FUEGOS

```
┌─────────────────────────────────────────┐
│  👥 Participantes (9)           ✕      │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [P] prueba1                    │   │
│  │  #️⃣ 1, 2, 5, 7, 9 (5 números)   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [U] usuario2                   │   │
│  │  #️⃣ 3, 4, 6 (3 números)         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [J] jugador3                   │   │
│  │  #️⃣ 8, 10 (2 números)           │   │
│  └─────────────────────────────────┘   │
│                                         │
│              [ Cerrar ]                 │
└─────────────────────────────────────────┘
```

---

### Modal de Participantes - Modo PREMIO (Host)

```
┌─────────────────────────────────────────┐
│  👥 Solicitudes Pendientes (2)    ✕    │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Juan Pérez (@prueba1)          │   │
│  │  📱 +58 412 123 4567            │   │
│  │  🆔 V-12345678                  │   │
│  │  #️⃣ Números: 1, 2               │   │
│  │  💰 Pago Móvil: 0102            │   │
│  │  📄 Ref: 123456789              │   │
│  │  🖼️ [Ver Comprobante]           │   │
│  │                                 │   │
│  │  [✅ Aprobar] [❌ Rechazar]     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  María González (@usuario2)     │   │
│  │  ... (datos similares)          │   │
│  └─────────────────────────────────┘   │
│                                         │
│              [ Cerrar ]                 │
└─────────────────────────────────────────┘
```

---

### Modal de Participantes - Modo PREMIO (Usuario Normal)

```
┌─────────────────────────────────────────┐
│  👥 Participantes (2)           ✕      │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [J] Juan Pérez                 │   │
│  │  #️⃣ 1, 2 (2 números)            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [M] María González             │   │
│  │  #️⃣ 3, 4, 5 (3 números)         │   │
│  └─────────────────────────────────┘   │
│                                         │
│              [ Cerrar ]                 │
└─────────────────────────────────────────┘
```

---

### Modal de Participantes - Modo EMPRESA

**Igual que modo PREMIO + botón adicional:**

```
┌─────────────────────────────────────────┐
│  👥 Participantes           ✕          │
│  🏢 [Ver Landing Empresa]              │
├─────────────────────────────────────────┤
│  ... (contenido igual a modo premio)   │
└─────────────────────────────────────────┘
```

---

## ❓ PREGUNTAS PARA EL USUARIO

### 1. **Modo FUEGOS - Información Visible**
**¿Qué nombre queremos mostrar en el modal?**
- [ ] Opción A: `username` (@prueba1)
- [ ] Opción B: `display_name` (Prueba Uno)
- [ ] Opción C: Ambos: "Prueba Uno (@prueba1)"

**Propuesta:** Opción C para claridad

---

### 2. **Modo PREMIO - Flujo de Aprobación**
**Cuando el host aprueba una solicitud, ¿qué sucede?**
- [ ] A: El número se marca como 'sold' automáticamente
- [ ] B: El usuario recibe notificación y debe confirmar
- [ ] C: Se genera una transacción en wallet_transactions

**Pregunta adicional:** ¿El host acredita manualmente el premio o es automático?

---

### 3. **Modo PREMIO - Información Requerida del Comprador**
**¿Qué datos MÍNIMOS debe proporcionar el comprador?**
- [ ] Nombre completo
- [ ] Teléfono
- [ ] Email
- [ ] Cédula/ID
- [ ] Dirección (para premios físicos)

**¿Estos datos se validan o son opcionales?**

---

### 4. **Modo PREMIO - Comprobante de Pago**
**¿Cómo sube el usuario la imagen del comprobante?**
- [ ] A: Upload directo al servidor
- [ ] B: URL externa (ej: imagen en Telegram)
- [ ] C: Ambas opciones

**Pregunta:** ¿Dónde almacenamos las imágenes? (S3, local, CDN)

---

### 5. **Modo EMPRESA - Landing**
**¿Qué información tiene la landing?**
- [ ] Logo de la empresa
- [ ] Colores de branding
- [ ] Descripción de la empresa
- [ ] Link a redes sociales
- [ ] Información de contacto

**¿La landing es la misma que `/public/:code` o es diferente?**

---

### 6. **Modo EMPRESA - Permisos**
**¿Quién puede crear rifas modo EMPRESA?**
- [ ] A: Solo usuarios con rol 'company'
- [ ] B: Cualquier usuario que tenga una empresa registrada
- [ ] C: Solo admins crean empresas y asignan hosts

---

### 7. **Notificaciones**
**¿Qué notificaciones enviamos?**
- [ ] Usuario compra número → Host recibe notificación
- [ ] Host aprueba → Usuario recibe notificación
- [ ] Host rechaza → Usuario recibe notificación + razón
- [ ] Todos los participantes → Notificación cuando se sortea

**¿Notificaciones por socket, email, o ambas?**

---

### 8. **Ordenamiento de Participantes**
**¿Cómo ordenamos la lista de participantes?**
- [ ] A: Por orden de compra (primero en comprar, primero en lista)
- [ ] B: Por cantidad de números (más números primero)
- [ ] C: Alfabético por nombre
- [ ] D: Aleatorio (para no mostrar favoritos)

---

### 9. **Límites y Restricciones**
**¿Cuántos números puede comprar un usuario en modo PREMIO/EMPRESA?**
- [ ] A: Sin límite
- [ ] B: Máximo definido por el host (ej: 5 números por persona)
- [ ] C: Solo 1 número por persona

---

### 10. **Búsqueda y Filtros en Modal**
**Si hay muchos participantes, ¿agregamos búsqueda?**
- [ ] Sí, campo de búsqueda por nombre
- [ ] No necesario por ahora
- [ ] Agregar después si hay más de 20 participantes

---

## 📦 ESTIMACIÓN DE IMPLEMENTACIÓN

### Backend (4-5 horas)
1. ✅ Endpoint `GET /participants` (1h)
2. ✅ Endpoint `POST /approve` (1h)
3. ✅ Endpoint `POST /reject` (0.5h)
4. ✅ Service methods en RaffleServiceV2.js (1h)
5. ✅ Tests y validaciones (0.5h)
6. ✅ Socket events para notificaciones (1h)

### Frontend (5-6 horas)
1. ✅ Componente ParticipantsModal.tsx (2h)
2. ✅ Componente RequestApprovalModal.tsx (1.5h)
3. ✅ Hook useParticipants (0.5h)
4. ✅ API client functions (0.5h)
5. ✅ Integración en RaffleRoom.tsx (1h)
6. ✅ Estilos y animaciones (1h)

### Testing (2-3 horas)
1. ✅ Tests unitarios backend (1h)
2. ✅ Tests E2E con diferentes roles (1h)
3. ✅ Tests de permisos y seguridad (1h)

**TOTAL ESTIMADO:** 11-14 horas de desarrollo

---

## 🚀 PLAN DE IMPLEMENTACIÓN SUGERIDO

### Fase 1: Modo FUEGOS (Más simple)
1. ✅ Backend: Endpoint `/participants` para modo fires
2. ✅ Frontend: ParticipantsModal básico
3. ✅ Cambiar "Vendidos" → "Participantes" en RaffleRoom
4. ✅ Testing básico

### Fase 2: Modo PREMIO
1. ✅ Backend: Endpoints approve/reject
2. ✅ Backend: Manejo de raffle_requests
3. ✅ Frontend: Modal con vista diferente para host
4. ✅ Frontend: RequestApprovalModal
5. ✅ Notificaciones socket

### Fase 3: Modo EMPRESA
1. ✅ Agregar botón "Ver Landing"
2. ✅ Verificar branding en landing pública
3. ✅ Testing con empresas reales

---

## 📝 DECISIONES PENDIENTES

Necesito tus respuestas a las 10 preguntas anteriores para:
1. Definir estructura exacta de datos
2. Implementar lógica de aprobación/rechazo
3. Diseñar flujo de notificaciones
4. Configurar permisos y roles
5. Crear validaciones correctas

**¿Empezamos con Fase 1 (Modo FUEGOS) mientras defines las respuestas para Fases 2-3?**
