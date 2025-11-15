/**
 * Sistema de Rifas V2 - Constantes y Configuración
 */

// Límites del sistema
export const RAFFLE_LIMITS = {
  MIN_NUMBERS: 10,
  MAX_NUMBERS: 10000,
  DEFAULT_NUMBERS: 100,
  MAX_NUMBERS_NORMAL: 1000,
  MAX_NUMBERS_COMPANY: 10000,
  MIN_PRICE_FIRES: 1,
  MAX_PRICE_FIRES: 10000,
  MIN_PRICE_COINS: 1,
  MAX_PRICE_COINS: 1000,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  RESERVATION_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutos
  MAX_NUMBERS_PER_USER: 50,
  COMMISSION_RATE: 0.05, // 5% comisión plataforma
} as const;

// Intervalos de sincronización (en ms)
// ⚠️ DESACTIVADOS: El refetch agresivo causa parpadeo de datos
export const SYNC_INTERVALS = {
  RAFFLE_REFETCH: false,   // ❌ Desactivado - solo refetch manual vía sockets
  NUMBERS_REFETCH: false,  // ❌ Desactivado - actualización vía eventos socket
  STATS_REFETCH: false,    // ❌ Desactivado - invalidación manual post-acción
  RESERVATION_CHECK: false, // ❌ Desactivado - socket notifica cambios
} as const;

// Query Keys para React Query
export const RAFFLE_QUERY_KEYS = {
  all: ['raffles'] as const,
  lists: () => [...RAFFLE_QUERY_KEYS.all, 'list'] as const,
  list: (filters?: Record<string, any>) => 
    [...RAFFLE_QUERY_KEYS.lists(), filters] as const,
  details: () => [...RAFFLE_QUERY_KEYS.all, 'detail'] as const,
  detail: (code: string) => 
    [...RAFFLE_QUERY_KEYS.details(), code] as const,
  numbers: (code: string, refreshTrigger?: number) => 
    [...RAFFLE_QUERY_KEYS.detail(code), 'numbers', refreshTrigger] as const,
  stats: (code: string) => 
    [...RAFFLE_QUERY_KEYS.detail(code), 'stats'] as const,
  userRaffles: (userId: string) => 
    [...RAFFLE_QUERY_KEYS.all, 'user', userId] as const,
} as const;

// Colores por estado
export const STATUS_COLORS = {
  draft: '#6B7280',      // gray
  pending: '#F59E0B',    // amber
  active: '#10B981',     // emerald
  finished: '#3B82F6',   // blue
  cancelled: '#EF4444',  // red
} as const;

// Colores por estado de número
export const NUMBER_STATE_COLORS = {
  available: '#10B981',  // emerald
  reserved: '#F59E0B',   // amber
  sold: '#EF4444',       // red
  locked: '#6B7280',     // gray
} as const;

// Mensajes de estado
export const STATUS_MESSAGES = {
  draft: 'Borrador - No publicada',
  pending: 'Pendiente - Esperando inicio',
  active: 'Activa - Compra disponible',
  finished: 'Finalizada - Sorteo completado',
  cancelled: 'Cancelada',
} as const;

// Textos de UI
export const UI_TEXTS = {
  BUTTONS: {
    CREATE_RAFFLE: 'Crear Rifa',
    BUY_NUMBER: 'Comprar Número',
    RESERVE_NUMBER: 'Reservar',
    CONFIRM_PURCHASE: 'Confirmar Compra',
    CANCEL_RESERVATION: 'Cancelar Reserva',
    VIEW_DETAILS: 'Ver Detalles',
    SHARE: 'Compartir',
    CLOSE: 'Cerrar',
  },
  PLACEHOLDERS: {
    SEARCH: 'Buscar rifa por nombre o código...',
    PAYMENT_REFERENCE: 'Número de referencia',
    NAME: 'Nombre completo',
    EMAIL: 'correo@ejemplo.com',
    PHONE: '+58 412 1234567',
  },
  ERRORS: {
    GENERIC: 'Ocurrió un error inesperado',
    NETWORK: 'Error de conexión',
    NOT_FOUND: 'Rifa no encontrada',
    UNAUTHORIZED: 'No tienes permisos para esta acción',
    INSUFFICIENT_BALANCE: 'Saldo insuficiente',
    NUMBER_UNAVAILABLE: 'Este número ya no está disponible',
    RESERVATION_EXPIRED: 'Tu reserva ha expirado',
    MAX_NUMBERS_REACHED: 'Has alcanzado el límite de números',
    PAYMENT_FAILED: 'Error al procesar el pago',
  },
  SUCCESS: {
    RAFFLE_CREATED: 'Rifa creada exitosamente',
    NUMBER_RESERVED: 'Número reservado exitosamente',
    PURCHASE_COMPLETED: 'Compra completada exitosamente',
    RAFFLE_UPDATED: 'Rifa actualizada',
    RAFFLE_CANCELLED: 'Rifa cancelada',
  },
} as const;

// Configuración de validación
export const VALIDATION_RULES = {
  RAFFLE_CODE: /^[0-9]{6}$/,
  PAYMENT_REFERENCE: /^[A-Z0-9]{6,20}$/,
  PHONE: /^(\+58)?[0-9]{10}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  DOCUMENT: /^[VE]?[0-9]{6,9}$/,
} as const;

// Opciones de filtrado
export const FILTER_OPTIONS = {
  STATUS: [
    { value: 'active', label: 'Activas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'finished', label: 'Finalizadas' },
  ],
  MODE: [
    { value: 'fires', label: 'Fuegos 🔥' },
    { value: 'coins', label: 'Monedas 🪙' },
    { value: 'prize', label: 'Premio 🎁' },
  ],
  SORT_BY: [
    { value: 'created', label: 'Más recientes' },
    { value: 'ending', label: 'Por finalizar' },
    { value: 'pot', label: 'Mayor pote' },
    { value: 'sold', label: 'Más vendidas' },
  ],
} as const;

// Configuración de paginación
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  LIMITS: [10, 20, 50, 100],
} as const;

// WebSocket eventos
export const SOCKET_EVENTS = {
  // Emisión
  JOIN_RAFFLE: 'raffle:join',
  LEAVE_RAFFLE: 'raffle:leave',
  RESERVE_NUMBER: 'number:reserve',
  RELEASE_NUMBER: 'number:release',
  
  // Recepción
  RAFFLE_UPDATED: 'raffle:updated',
  NUMBER_RESERVED: 'number:reserved',
  NUMBER_RELEASED: 'number:released',
  NUMBER_PURCHASED: 'number:purchased',
  RAFFLE_COMPLETED: 'raffle:completed',
} as const;

// Rutas de API
export const API_ENDPOINTS = {
  // Base
  BASE: '/api/raffles/v2',
  
  // CRUD
  LIST: '',
  CREATE: '',
  DETAIL: (code: string) => `/${code}`,
  UPDATE: (code: string) => `/${code}`,
  DELETE: (code: string) => `/${code}`,
  SETTINGS: '/settings',
  
  // Números
  NUMBERS: (code: string) => `/${code}/numbers`,
  RESERVE: (code: string, idx: number) => `/${code}/numbers/${idx}/reserve`,
  RELEASE: (code: string, idx: number) => `/${code}/numbers/${idx}/release`,
  PURCHASE: (code: string, idx: number) => `/${code}/numbers/${idx}/purchase`,
  PARTICIPANTS: (code: string) => `/${code}/participants`,
  
  // Estadísticas
  STATS: (code: string) => `/${code}/stats`,
  
  // Usuario
  USER_RAFFLES: '/my-raffles',
  USER_NUMBERS: (code: string) => `/${code}/my-numbers`,
  
  // Admin
  ADMIN_APPROVE: (code: string, requestId: number) => 
    `/${code}/requests/${requestId}/approve`,
  ADMIN_REJECT: (code: string, requestId: number) => 
    `/${code}/requests/${requestId}/reject`,
} as const;

// Configuración de números especiales
export const SPECIAL_NUMBERS = {
  LUCKY: [7, 13, 21, 77],
  PREMIUM: [1, 100, 500, 999, 1000],
  MULTIPLIER: 1.5, // Precio multiplicado para números especiales
} as const;

// Feature flags
export const FEATURES = {
  ENABLE_COMPANY_MODE: true,
  ENABLE_PRIZE_MODE: true,
  ENABLE_RESERVATIONS: true,
  ENABLE_PARTIAL_PAYMENTS: false,
  ENABLE_AUTO_DRAW: false,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_SHARE: true,
} as const;
