/**
 * Sistema de Rifas V2 - Definiciones de Tipos
 * Arquitectura limpia con TypeScript
 */

// Estados de rifa
export enum RaffleStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  FINISHED = 'finished',
  CANCELLED = 'cancelled'
}

// Modos de rifa
export enum RaffleMode {
  FIRES = 'fires',
  COINS = 'coins',
  PRIZE = 'prize'
}

// Tipos de visibilidad
export enum RaffleVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  COMPANY = 'company'
}

// Estados de número
export enum NumberState {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  SOLD = 'sold',
  LOCKED = 'locked'
}

// Estados de pago
export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

// Métodos de pago
export enum PaymentMethod {
  CASH = 'cash',
  MOBILE = 'mobile',
  BANK = 'bank',
  FIRES = 'fires'
}

// Modos de sorteo/victoria ✨ NUEVO
export enum DrawMode {
  AUTOMATIC = 'automatic',  // 10 segundos después de vender último número
  SCHEDULED = 'scheduled',  // Fecha y hora específica
  MANUAL = 'manual'         // Host decide cuándo sortear
}

// Interfaz principal de Rifa
export interface Raffle {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: RaffleStatus;
  mode: RaffleMode;
  visibility: RaffleVisibility;
  
  // Host
  hostId: string;
  hostUsername: string;
  
  // Números
  numbersRange: number;
  numbersSold: number;
  numbersReserved: number;
  
  // Precios
  entryPriceFire?: number;
  entryPriceCoin?: number;
  
  // Potes
  potFires: number;
  potCoins: number;
  
  // Timestamps
  createdAt: Date;
  startsAt?: Date;
  endsAt?: Date;
  finishedAt?: Date;
  winnerNumber?: number;
  winnerId?: string;
  winnerUsername?: string;
  winnerDisplayName?: string;
  
  // Configuración empresa
  companyConfig?: CompanyConfig;
  
  // Premio
  prizeMeta?: PrizeMeta;
  
  // Términos
  termsConditions?: string;
  
  // Nuevos campos
  allowFiresPayment?: boolean; // ✨ Toggle pago con fuegos en modo Premio
  prizeImageBase64?: string; // ✨ Imagen del premio en base64
  drawMode?: DrawMode; // ✨ Modo de sorteo
  scheduledDrawAt?: Date; // ✨ Fecha programada para sorteo (si modo = scheduled)
}

// Configuración de empresa
export interface CompanyConfig {
  companyName: string;
  rifNumber: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  logoBase64?: string; // ✨ Logo en base64
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
}

// Información bancaria para rifas con premio
export interface BankingInfo {
  accountHolder: string;
  bankCode: string;  // Código del banco (ej: 0102, 0134)
  bankName: string;
  accountNumber: string;
  accountType: 'ahorro' | 'corriente';
  idNumber: string;  // Cédula/ID del titular
  phone: string;
}

// Información del premio
export interface PrizeMeta {
  prizeType?: string;
  prizeDescription: string;
  prizeValue?: number;
  prizeImages?: string[];
  category?: string;
  bankingInfo?: BankingInfo;
}

// Número de rifa
export interface RaffleNumber {
  idx: number;
  state: NumberState;
  ownerId?: string;
  ownerUsername?: string;
  reservedAt?: Date;
  purchasedAt?: Date;
  paymentReference?: string;
}

// Solicitud de compra
export interface PurchaseRequest {
  id: number;
  raffleId: number;
  userId: string;
  numberIdx: number;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  status: PaymentStatus;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

// Participante
export interface RaffleParticipant {
  userId: string;
  username: string;
  email?: string;
  numbersCount: number;
  numbers: number[];
  totalSpentFires: number;
  totalSpentCoins: number;
  joinedAt: Date;
}

// Ganador
export interface RaffleWinner {
  userId: string;
  username: string;
  displayName?: string;
  winningNumber: number;
  prizeAmount: number;
  currency?: 'fires' | 'coins';
  claimedAt?: Date;
}

// Estadísticas
export interface RaffleStats {
  totalParticipants: number;
  totalNumbersSold: number;
  totalRevenueFires: number;
  totalRevenueCoins: number;
  averageNumbersPerUser: number;
  completionRate: number;
  popularNumbers: number[];
}

// Filtros de búsqueda
export interface RaffleFilters {
  status?: RaffleStatus[];
  mode?: RaffleMode[];
  visibility?: RaffleVisibility[];
  hostId?: string;
  minPot?: number;
  maxPot?: number;
  search?: string;
  sortBy?: 'created' | 'ending' | 'pot' | 'sold';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Respuestas de API
export interface RaffleListResponse {
  raffles: Raffle[];
  total: number;
  page: number;
  totalPages: number;
}

export interface RaffleDetailResponse {
  raffle: Raffle;
  numbers: RaffleNumber[];
  userNumbers?: number[];
  winner?: RaffleWinner;
  stats?: RaffleStats;
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  transaction?: {
    id: string;
    amount: number;
    currency: 'fires' | 'coins';
    numberIdx: number;
  };
}

// WebSocket Events
export interface RaffleSocketEvents {
  'raffle:updated': (data: { raffleId: number; changes: Partial<Raffle> }) => void;
  'number:reserved': (data: { raffleId: number; numberIdx: number; userId: string }) => void;
  'number:released': (data: { raffleId: number; numberIdx: number }) => void;
  'number:purchased': (data: { raffleId: number; numberIdx: number; userId: string }) => void;
  'raffle:completed': (data: { raffleId: number; winner: RaffleWinner }) => void;
}

// Form Types
export interface RaffleSettings {
  prizeModeCostFires: number;
  companyModeCostFires: number;
}

export interface CreateRaffleForm {
  name: string;
  description: string;
  mode: RaffleMode;
  visibility: RaffleVisibility;
  numbersRange: number;
  entryPrice: number;
  startsAt?: string;
  endsAt?: string;
  termsConditions?: string;
  prizeMeta?: PrizeMeta;
  companyConfig?: CompanyConfig;
  drawMode?: DrawMode; // ✨ Modo de sorteo
  scheduledDrawAt?: string; // ✨ Fecha programada (ISO string)
}

export interface BuyNumberForm {
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  buyerName?: string;
}

// ✨ NUEVOS TIPOS PARA SISTEMA DE APROBACIÓN

// Perfil del comprador (datos opcionales)
export interface BuyerProfile {
  displayName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  idNumber?: string;
}

// Datos de solicitud de pago
export interface PaymentRequestData {
  reference?: string;
  paymentMethod?: string;
  bankCode?: string;
  paymentProofBase64?: string; // ✨ Comprobante en base64
  notes?: string;
  rejectionReason?: string; // Si fue rechazado
}

// Solicitud completa (vista del host)
export interface PaymentRequestDetail {
  requestId: number;
  buyerProfile: BuyerProfile;
  requestData: PaymentRequestData;
  status: PaymentStatus;
  numbers: number[];
  telegramUsername?: string;
  createdAt: string;
}

// Participante público (modo FIRES/COINS)
export interface PublicParticipant {
  displayName: string;
  telegramUsername: string;
  numbers: number[];
}

// Participante aprobado (modo PRIZE - vista usuario)
export interface ApprovedParticipant {
  displayName: string;
  numbers: number[];
}

// Respuesta de participantes
export interface ParticipantsResponse {
  // Para modo FIRES/COINS
  participants?: PublicParticipant[];
  totalParticipants?: number;
  
  // Para modo PRIZE (host)
  requests?: PaymentRequestDetail[];
  totalRequests?: number;
}

// Form para crear rifa actualizado
export interface CreateRaffleFormExtended extends CreateRaffleForm {
  allowFiresPayment?: boolean; // ✨ Toggle pago con fuegos
  prizeImageBase64?: string; // ✨ Imagen del premio
  buyerEmail?: string;
  buyerPhone?: string;
  buyerDocument?: string;
}
