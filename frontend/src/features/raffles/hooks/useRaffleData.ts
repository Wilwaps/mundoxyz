/**
 * Sistema de Rifas V2 - Hook Principal de Datos
 * Single Source of Truth para todo el sistema de rifas
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import * as api from '../api';
import {
  RaffleFilters,
  CreateRaffleForm,
  BuyNumberForm,
  Raffle
} from '../types';
import {
  RAFFLE_QUERY_KEYS,
  SYNC_INTERVALS,
  UI_TEXTS
} from '../constants';

/**
 * Hook para listar rifas con filtros
 */
export const useRaffleList = (filters?: RaffleFilters) => {
  return useQuery({
    queryKey: RAFFLE_QUERY_KEYS.list(filters),
    queryFn: () => api.getRaffles(filters),
    refetchInterval: SYNC_INTERVALS.RAFFLE_REFETCH,
    staleTime: 30000, // 30 segundos
    keepPreviousData: true
  });
};

/**
 * Hook para obtener detalle de rifa
 */
export const useRaffleDetail = (code: string, enabled = true) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: RAFFLE_QUERY_KEYS.detail(code),
    queryFn: () => api.getRaffleDetail(code),
    enabled: enabled && !!code,
    refetchInterval: SYNC_INTERVALS.RAFFLE_REFETCH,
    staleTime: 10000,
    onSuccess: (data) => {
      // Actualizar cache de números también
      queryClient.setQueryData(
        RAFFLE_QUERY_KEYS.numbers(code),
        data.numbers
      );
    }
  });
};

/**
 * Hook para obtener números de rifa
 */
export const useRaffleNumbers = (code: string, refreshTrigger = 0) => {
  return useQuery({
    queryKey: RAFFLE_QUERY_KEYS.numbers(code, refreshTrigger),
    queryFn: () => api.getRaffleNumbers(code),
    enabled: !!code,
    refetchInterval: SYNC_INTERVALS.NUMBERS_REFETCH,
    staleTime: 5000
  });
};

/**
 * Hook para crear rifa
 */
export const useCreateRaffle = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateRaffleForm) => api.createRaffle(data),
    onSuccess: (raffle) => {
      // Invalidar lista de rifas
      queryClient.invalidateQueries(RAFFLE_QUERY_KEYS.lists());
      
      // Invalidar rifas del usuario
      queryClient.invalidateQueries(['user-raffles']);
      
      toast.success(UI_TEXTS.SUCCESS.RAFFLE_CREATED);
      
      return raffle;
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || UI_TEXTS.ERRORS.GENERIC;
      toast.error(message);
    }
  });
};

/**
 * Hook para actualizar rifa
 */
export const useUpdateRaffle = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ code, updates }: { code: string; updates: Partial<CreateRaffleForm> }) =>
      api.updateRaffle(code, updates),
    onSuccess: (raffle, variables) => {
      // Actualizar cache del detalle
      queryClient.setQueryData(
        RAFFLE_QUERY_KEYS.detail(variables.code),
        (old: any) => ({
          ...old,
          raffle: { ...old?.raffle, ...raffle }
        })
      );
      
      // Invalidar lista
      queryClient.invalidateQueries(RAFFLE_QUERY_KEYS.lists());
      
      toast.success(UI_TEXTS.SUCCESS.RAFFLE_UPDATED);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || UI_TEXTS.ERRORS.GENERIC;
      toast.error(message);
    }
  });
};

/**
 * Hook para cancelar rifa
 */
export const useCancelRaffle = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (code: string) => api.cancelRaffle(code),
    onSuccess: (_, code) => {
      // Actualizar cache del detalle
      queryClient.setQueryData(
        RAFFLE_QUERY_KEYS.detail(code),
        (old: any) => ({
          ...old,
          raffle: { ...old?.raffle, status: 'cancelled' }
        })
      );
      
      // Invalidar lista
      queryClient.invalidateQueries(RAFFLE_QUERY_KEYS.lists());
      
      toast.success(UI_TEXTS.SUCCESS.RAFFLE_CANCELLED);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || UI_TEXTS.ERRORS.GENERIC;
      toast.error(message);
    }
  });
};

/**
 * Hook para reservar número
 */
export const useReserveNumber = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ code, idx }: { code: string; idx: number }) =>
      api.reserveNumber(code, idx),
    onSuccess: (data, variables) => {
      // Invalidar números inmediatamente
      queryClient.invalidateQueries(
        RAFFLE_QUERY_KEYS.numbers(variables.code)
      );
      
      // También invalidar detalle de rifa
      queryClient.invalidateQueries(
        RAFFLE_QUERY_KEYS.detail(variables.code)
      );
      
      toast.success(UI_TEXTS.SUCCESS.NUMBER_RESERVED);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || UI_TEXTS.ERRORS.NUMBER_UNAVAILABLE;
      toast.error(message);
    }
  });
};

/**
 * Hook para liberar número
 */
export const useReleaseNumber = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ code, idx }: { code: string; idx: number }) =>
      api.releaseNumber(code, idx),
    onSuccess: (_, variables) => {
      // Invalidar números inmediatamente
      queryClient.invalidateQueries(
        RAFFLE_QUERY_KEYS.numbers(variables.code)
      );
      
      // También invalidar detalle de rifa
      queryClient.invalidateQueries(
        RAFFLE_QUERY_KEYS.detail(variables.code)
      );
    },
    onError: (error: any) => {
      // No mostrar toast en release, es silencioso
      console.error('Error liberando número:', error);
    }
  });
};

/**
 * Hook para comprar número
 */
export const usePurchaseNumber = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ 
      code, 
      idx, 
      form 
    }: { 
      code: string; 
      idx: number; 
      form: BuyNumberForm 
    }) => api.purchaseNumber(code, idx, form),
    onSuccess: (data, variables) => {
      // Invalidar números
      queryClient.invalidateQueries(
        RAFFLE_QUERY_KEYS.numbers(variables.code)
      );
      
      // Invalidar detalle de rifa
      queryClient.invalidateQueries(
        RAFFLE_QUERY_KEYS.detail(variables.code)
      );
      
      // Invalidar balance del usuario
      queryClient.invalidateQueries(['user', 'balance']);
      
      toast.success(UI_TEXTS.SUCCESS.PURCHASE_COMPLETED);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || UI_TEXTS.ERRORS.PAYMENT_FAILED;
      toast.error(message);
    }
  });
};

/**
 * Hook para obtener rifas del usuario
 */
export const useUserRaffles = () => {
  return useQuery({
    queryKey: ['user', 'raffles'],
    queryFn: () => api.getUserRaffles(),
    refetchInterval: SYNC_INTERVALS.STATS_REFETCH,
    staleTime: 60000 // 1 minuto
  });
};

/**
 * Hook para obtener números del usuario en una rifa
 */
export const useUserNumbers = (code: string) => {
  return useQuery({
    queryKey: ['user', 'numbers', code],
    queryFn: () => api.getUserNumbers(code),
    enabled: !!code,
    refetchInterval: SYNC_INTERVALS.NUMBERS_REFETCH,
    staleTime: 30000
  });
};

/**
 * Hook compuesto para manejo completo de rifa
 */
export const useRaffle = (code: string) => {
  const queryClient = useQueryClient();
  
  // Queries
  const raffleQuery = useRaffleDetail(code);
  const numbersQuery = useRaffleNumbers(code);
  const userNumbersQuery = useUserNumbers(code);
  
  // Mutations
  const reserveNumber = useReserveNumber();
  const releaseNumber = useReleaseNumber();
  const purchaseNumber = usePurchaseNumber();
  
  // Función para forzar actualización
  const forceRefresh = useCallback(() => {
    queryClient.invalidateQueries(RAFFLE_QUERY_KEYS.detail(code));
    queryClient.invalidateQueries(RAFFLE_QUERY_KEYS.numbers(code));
  }, [queryClient, code]);
  
  // Función para verificar si un número pertenece al usuario
  const isUserNumber = useCallback(
    (idx: number) => {
      return userNumbersQuery.data?.includes(idx) || false;
    },
    [userNumbersQuery.data]
  );
  
  return {
    // Data
    raffle: raffleQuery.data?.raffle,
    numbers: numbersQuery.data || [],
    userNumbers: userNumbersQuery.data || [],
    stats: raffleQuery.data?.stats,
    
    // Estados de carga
    isLoading: raffleQuery.isLoading || numbersQuery.isLoading,
    isRefetching: raffleQuery.isRefetching || numbersQuery.isRefetching,
    
    // Errores
    error: raffleQuery.error || numbersQuery.error,
    
    // Acciones
    reserveNumber: (idx: number) => reserveNumber.mutate({ code, idx }),
    releaseNumber: (idx: number) => releaseNumber.mutate({ code, idx }),
    purchaseNumber: (idx: number, form: BuyNumberForm) => 
      purchaseNumber.mutate({ code, idx, form }),
    
    // Utilidades
    forceRefresh,
    isUserNumber,
    
    // Estados de mutaciones
    isReserving: reserveNumber.isLoading,
    isReleasing: releaseNumber.isLoading,
    isPurchasing: purchaseNumber.isLoading
  };
};

/**
 * Hook para manejo de filtros y búsqueda
 */
export const useRaffleFilters = (initialFilters?: RaffleFilters) => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<RaffleFilters>(initialFilters || {});
  
  // Actualizar un filtro específico
  const updateFilter = useCallback(
    <K extends keyof RaffleFilters>(key: K, value: RaffleFilters[K]) => {
      setFilters(prev => ({
        ...prev,
        [key]: value
      }));
    },
    []
  );
  
  // Limpiar filtros
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);
  
  // Aplicar filtros (invalida queries)
  const applyFilters = useCallback(() => {
    queryClient.invalidateQueries(RAFFLE_QUERY_KEYS.list(filters));
  }, [queryClient, filters]);
  
  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    applyFilters
  };
};

export default {
  useRaffleList,
  useRaffleDetail,
  useRaffleNumbers,
  useCreateRaffle,
  useUpdateRaffle,
  useCancelRaffle,
  useReserveNumber,
  useReleaseNumber,
  usePurchaseNumber,
  useUserRaffles,
  useUserNumbers,
  useRaffle,
  useRaffleFilters
};
