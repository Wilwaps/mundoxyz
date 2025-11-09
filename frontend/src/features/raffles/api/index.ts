/**
 * Sistema de Rifas V2 - API Layer
 * Single Source of Truth para todas las operaciones HTTP
 */

import axios from 'axios';
import API_URL from '../../../config/api';
import { 
  Raffle, 
  RaffleFilters, 
  RaffleListResponse, 
  RaffleDetailResponse,
  CreateRaffleForm,
  BuyNumberForm,
  PurchaseResponse,
  RaffleNumber,
  PurchaseRequest,
  RaffleStats
} from '../types';
import { API_ENDPOINTS } from '../constants';

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: `${API_URL}${API_ENDPOINTS.BASE}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * OPERACIONES CRUD PRINCIPALES
 */

// Listar rifas con filtros
export const getRaffles = async (filters?: RaffleFilters): Promise<RaffleListResponse> => {
  const { data } = await api.get<RaffleListResponse>(API_ENDPOINTS.LIST, {
    params: filters,
  });
  return data;
};

// Obtener detalle de rifa
export const getRaffleDetail = async (code: string): Promise<RaffleDetailResponse> => {
  const { data } = await api.get<RaffleDetailResponse>(
    API_ENDPOINTS.DETAIL(code)
  );
  return data;
};

// Crear nueva rifa
export const createRaffle = async (form: CreateRaffleForm): Promise<Raffle> => {
  const { data } = await api.post<{ success: boolean; raffle: Raffle; message: string }>(API_ENDPOINTS.CREATE, form);
  return data.raffle;
};

// Actualizar rifa
export const updateRaffle = async (
  code: string, 
  updates: Partial<CreateRaffleForm>
): Promise<Raffle> => {
  const { data } = await api.patch<Raffle>(
    API_ENDPOINTS.UPDATE(code), 
    updates
  );
  return data;
};

// Cancelar rifa
export const cancelRaffle = async (code: string): Promise<{ success: boolean }> => {
  const { data } = await api.delete(API_ENDPOINTS.DELETE(code));
  return data;
};

/**
 * OPERACIONES DE NÚMEROS
 */

// Obtener grilla de números
export const getRaffleNumbers = async (code: string): Promise<RaffleNumber[]> => {
  const { data } = await api.get<{ numbers: RaffleNumber[] }>(
    API_ENDPOINTS.NUMBERS(code)
  );
  return data.numbers;
};

// Reservar número
export const reserveNumber = async (
  code: string, 
  idx: number
): Promise<{ success: boolean; expiresAt: Date }> => {
  const { data } = await api.post(API_ENDPOINTS.RESERVE(code, idx));
  return data;
};

// Liberar reserva
export const releaseNumber = async (
  code: string, 
  idx: number
): Promise<{ success: boolean }> => {
  const { data } = await api.post(API_ENDPOINTS.RELEASE(code, idx));
  return data;
};

// Comprar número
export const purchaseNumber = async (
  code: string,
  idx: number,
  form: BuyNumberForm
): Promise<PurchaseResponse> => {
  const { data } = await api.post<PurchaseResponse>(
    API_ENDPOINTS.PURCHASE(code, idx),
    form
  );
  return data;
};

/**
 * OPERACIONES DE USUARIO
 */

// Obtener rifas del usuario
export const getUserRaffles = async (): Promise<Raffle[]> => {
  const { data } = await api.get<{ raffles: Raffle[] }>(
    API_ENDPOINTS.USER_RAFFLES
  );
  return data.raffles;
};

// Obtener números del usuario en una rifa
export const getUserNumbers = async (code: string): Promise<number[]> => {
  const { data } = await api.get<{ numbers: number[] }>(
    API_ENDPOINTS.USER_NUMBERS(code)
  );
  return data.numbers;
};

/**
 * OPERACIONES ADMINISTRATIVAS
 */

// Aprobar solicitud de compra
export const approvePurchaseRequest = async (
  code: string,
  requestId: number
): Promise<{ success: boolean }> => {
  const { data } = await api.post(
    API_ENDPOINTS.ADMIN_APPROVE(code, requestId)
  );
  return data;
};

// Rechazar solicitud de compra
export const rejectPurchaseRequest = async (
  code: string,
  requestId: number,
  reason?: string
): Promise<{ success: boolean }> => {
  const { data } = await api.post(
    API_ENDPOINTS.ADMIN_REJECT(code, requestId),
    { reason }
  );
  return data;
};

/**
 * OPERACIONES DE ESTADÍSTICAS
 */

// Obtener estadísticas de rifa
export const getRaffleStats = async (code: string): Promise<RaffleStats> => {
  const { data } = await api.get<RaffleStats>(
    API_ENDPOINTS.STATS(code)
  );
  return data;
};

/**
 * UTILIDADES
 */

// Validar código de rifa
export const validateRaffleCode = async (code: string): Promise<boolean> => {
  try {
    await api.head(API_ENDPOINTS.DETAIL(code));
    return true;
  } catch {
    return false;
  }
};

// Subir imagen de premio
export const uploadPrizeImage = async (
  file: File
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('image', file);
  
  const { data } = await api.post<{ url: string }>(
    '/upload/prize',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return data;
};

// Subir logo de empresa
export const uploadCompanyLogo = async (
  file: File
): Promise<{ url: string }> => {
  const formData = new FormData();
  formData.append('logo', file);
  
  const { data } = await api.post<{ url: string }>(
    '/upload/logo',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return data;
};

// Generar reporte de rifa
export const generateRaffleReport = async (
  code: string
): Promise<Blob> => {
  const { data } = await api.get(
    `/reports/${code}`,
    {
      responseType: 'blob',
    }
  );
  return data;
};

/**
 * BATCH OPERATIONS
 */

// Comprar múltiples números
export const purchaseMultipleNumbers = async (
  code: string,
  numbers: number[],
  form: BuyNumberForm
): Promise<PurchaseResponse> => {
  const { data } = await api.post<PurchaseResponse>(
    `/${code}/numbers/batch-purchase`,
    {
      numbers,
      ...form,
    }
  );
  return data;
};

// Reservar múltiples números
export const reserveMultipleNumbers = async (
  code: string,
  numbers: number[]
): Promise<{ success: boolean; reserved: number[]; failed: number[] }> => {
  const { data } = await api.post(
    `/${code}/numbers/batch-reserve`,
    { numbers }
  );
  return data;
};

export default api;
