/**
 * Sistema de Rifas V2 - Backend Types
 * Definiciones y esquemas para el módulo de rifas
 */

// Estados de rifa
const RaffleStatus = {
  DRAFT: 'draft',
  PENDING: 'pending',
  ACTIVE: 'active',
  FINISHED: 'finished',
  CANCELLED: 'cancelled'
};

// Modos de rifa
const RaffleMode = {
  FIRES: 'fires',
  COINS: 'coins',
  PRIZE: 'prize'
};

// Visibilidad
const RaffleVisibility = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  COMPANY: 'company'
};

// Estados de número
const NumberState = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  SOLD: 'sold',
  LOCKED: 'locked'
};

// Estados de pago
const PaymentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

// Métodos de pago
const PaymentMethod = {
  CASH: 'cash',
  MOBILE: 'mobile',
  BANK: 'bank',
  FIRES: 'fires'
};

// Eventos de Socket
const SocketEvents = {
  // Cliente -> Servidor
  JOIN_RAFFLE: 'raffle:join',
  LEAVE_RAFFLE: 'raffle:leave',
  RESERVE_NUMBER: 'number:reserve',
  RELEASE_NUMBER: 'number:release',
  
  // Servidor -> Cliente
  RAFFLE_UPDATED: 'raffle:updated',
  NUMBER_RESERVED: 'number:reserved',
  NUMBER_RELEASED: 'number:released',
  NUMBER_PURCHASED: 'number:purchased',
  RAFFLE_COMPLETED: 'raffle:completed',
  REQUEST_RECEIVED: 'request:received',
  REQUEST_UPDATED: 'request:updated'
};

// Límites del sistema
const SystemLimits = {
  MIN_NUMBERS: 10,
  MAX_NUMBERS: 1000,
  DEFAULT_NUMBERS: 100,
  MIN_PRICE_FIRES: 1,
  MAX_PRICE_FIRES: 10000,
  MIN_PRICE_COINS: 1,
  MAX_PRICE_COINS: 1000,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  RESERVATION_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutos
  MAX_NUMBERS_PER_USER: 50,
  COMMISSION_RATE: 0.05 // 5%
};

// Configuración de cache
const CacheConfig = {
  RAFFLE_TTL: 60, // 1 minuto
  NUMBERS_TTL: 30, // 30 segundos
  STATS_TTL: 120, // 2 minutos
  USER_RAFFLES_TTL: 60 // 1 minuto
};

// Códigos de error personalizados
const ErrorCodes = {
  // Generales
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Rifas
  RAFFLE_NOT_FOUND: 'RAFFLE_NOT_FOUND',
  RAFFLE_NOT_ACTIVE: 'RAFFLE_NOT_ACTIVE',
  RAFFLE_EXPIRED: 'RAFFLE_EXPIRED',
  RAFFLE_FULL: 'RAFFLE_FULL',
  
  // Números
  NUMBER_NOT_FOUND: 'NUMBER_NOT_FOUND',
  NUMBER_NOT_AVAILABLE: 'NUMBER_NOT_AVAILABLE',
  NUMBER_ALREADY_RESERVED: 'NUMBER_ALREADY_RESERVED',
  NUMBER_ALREADY_SOLD: 'NUMBER_ALREADY_SOLD',
  RESERVATION_EXPIRED: 'RESERVATION_EXPIRED',
  MAX_NUMBERS_EXCEEDED: 'MAX_NUMBERS_EXCEEDED',
  
  // Pagos
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_PAYMENT_METHOD: 'INVALID_PAYMENT_METHOD',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  DUPLICATE_PAYMENT: 'DUPLICATE_PAYMENT',
  
  // Límites
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED'
};

// Mensajes de error
const ErrorMessages = {
  [ErrorCodes.INVALID_INPUT]: 'Datos de entrada inválidos',
  [ErrorCodes.NOT_FOUND]: 'Recurso no encontrado',
  [ErrorCodes.UNAUTHORIZED]: 'No autorizado',
  [ErrorCodes.FORBIDDEN]: 'Acceso prohibido',
  
  [ErrorCodes.RAFFLE_NOT_FOUND]: 'Rifa no encontrada',
  [ErrorCodes.RAFFLE_NOT_ACTIVE]: 'La rifa no está activa',
  [ErrorCodes.RAFFLE_EXPIRED]: 'La rifa ha expirado',
  [ErrorCodes.RAFFLE_FULL]: 'Todos los números han sido vendidos',
  
  [ErrorCodes.NUMBER_NOT_FOUND]: 'Número no encontrado',
  [ErrorCodes.NUMBER_NOT_AVAILABLE]: 'El número no está disponible',
  [ErrorCodes.NUMBER_ALREADY_RESERVED]: 'El número ya está reservado',
  [ErrorCodes.NUMBER_ALREADY_SOLD]: 'El número ya ha sido vendido',
  [ErrorCodes.RESERVATION_EXPIRED]: 'Tu reserva ha expirado',
  [ErrorCodes.MAX_NUMBERS_EXCEEDED]: 'Has alcanzado el límite máximo de números',
  
  [ErrorCodes.WALLET_NOT_FOUND]: 'Wallet no encontrado',
  [ErrorCodes.INSUFFICIENT_BALANCE]: 'Saldo insuficiente',
  [ErrorCodes.INVALID_PAYMENT_METHOD]: 'Método de pago inválido',
  [ErrorCodes.PAYMENT_FAILED]: 'El pago no pudo ser procesado',
  [ErrorCodes.DUPLICATE_PAYMENT]: 'Este pago ya fue procesado',
  
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Demasiadas solicitudes, intenta más tarde',
  [ErrorCodes.QUOTA_EXCEEDED]: 'Has excedido tu cuota'
};

// Roles y permisos
const Permissions = {
  // Públicos
  VIEW_PUBLIC_RAFFLES: 'raffles.view.public',
  
  // Usuario autenticado
  CREATE_RAFFLE: 'raffles.create',
  BUY_NUMBER: 'raffles.buy',
  VIEW_OWN_RAFFLES: 'raffles.view.own',
  
  // Host de rifa
  EDIT_OWN_RAFFLE: 'raffles.edit.own',
  CANCEL_OWN_RAFFLE: 'raffles.cancel.own',
  APPROVE_PAYMENTS: 'raffles.payments.approve',
  
  // Admin
  VIEW_ALL_RAFFLES: 'raffles.view.all',
  EDIT_ANY_RAFFLE: 'raffles.edit.any',
  CANCEL_ANY_RAFFLE: 'raffles.cancel.any',
  MANAGE_PAYMENTS: 'raffles.payments.manage',
  VIEW_REPORTS: 'raffles.reports.view'
};

// Mapeo de notificaciones
const NotificationTypes = {
  // Para el host
  NEW_PURCHASE: 'raffle.purchase.new',
  PAYMENT_PENDING: 'raffle.payment.pending',
  RAFFLE_COMPLETED: 'raffle.completed',
  
  // Para participantes
  NUMBER_RESERVED: 'number.reserved',
  RESERVATION_EXPIRING: 'reservation.expiring',
  PURCHASE_CONFIRMED: 'purchase.confirmed',
  WINNER_SELECTED: 'raffle.winner',
  
  // Sistema
  RAFFLE_STARTING: 'raffle.starting',
  RAFFLE_ENDING_SOON: 'raffle.ending.soon'
};

// Configuración de trabajos programados
const JobConfig = {
  CLEAN_EXPIRED_RESERVATIONS: {
    interval: 60000, // 1 minuto
    enabled: true
  },
  PROCESS_PENDING_PAYMENTS: {
    interval: 300000, // 5 minutos
    enabled: true
  },
  CHECK_RAFFLE_EXPIRY: {
    interval: 60000, // 1 minuto
    enabled: true
  },
  GENERATE_DAILY_REPORT: {
    cron: '0 0 * * *', // Medianoche
    enabled: false
  }
};

module.exports = {
  RaffleStatus,
  RaffleMode,
  RaffleVisibility,
  NumberState,
  PaymentStatus,
  PaymentMethod,
  SocketEvents,
  SystemLimits,
  CacheConfig,
  ErrorCodes,
  ErrorMessages,
  Permissions,
  NotificationTypes,
  JobConfig
};
