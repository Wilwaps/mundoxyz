/**
 * Sistema de Rifas V2 - Hook Principal de Datos
 * Single Source of Truth para todo el sistema de rifas
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from '../../../contexts/SocketContext';
import { useAuth } from '../../../contexts/AuthContext';
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
    staleTime: 30000 // 30 segundos
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
    staleTime: 10000
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
      queryClient.invalidateQueries({ queryKey: RAFFLE_QUERY_KEYS.lists() });
      
      // Invalidar rifas del usuario
      queryClient.invalidateQueries({ queryKey: ['user', 'raffles'] });
      
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
      queryClient.invalidateQueries({ queryKey: RAFFLE_QUERY_KEYS.lists() });
      
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
      queryClient.invalidateQueries({ queryKey: RAFFLE_QUERY_KEYS.lists() });
      
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
      queryClient.invalidateQueries({
        queryKey: RAFFLE_QUERY_KEYS.numbers(variables.code)
      });
      
      // También invalidar detalle de rifa
      queryClient.invalidateQueries({
        queryKey: RAFFLE_QUERY_KEYS.detail(variables.code)
      });
      
      toast.success(UI_TEXTS.SUCCESS.NUMBER_RESERVED);
    },
    onError: (error: any) => {
      console.error('[useReserveNumber] Error reservando:', error);
      
      // Mensajes específicos según el código de error
      if (error.response?.status === 404) {
        toast.error('Esta rifa no existe o fue eliminada');
        // Redirigir al lobby después de un momento
        setTimeout(() => {
          window.location.href = '/raffles';
        }, 2000);
      } else {
        const message = error.response?.data?.message || UI_TEXTS.ERRORS.NUMBER_UNAVAILABLE;
        toast.error(message);
      }
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
      queryClient.invalidateQueries({
        queryKey: RAFFLE_QUERY_KEYS.numbers(variables.code)
      });
      
      // También invalidar detalle de rifa
      queryClient.invalidateQueries({
        queryKey: RAFFLE_QUERY_KEYS.detail(variables.code)
      });
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
      queryClient.invalidateQueries({
        queryKey: RAFFLE_QUERY_KEYS.numbers(variables.code)
      });
      
      // Invalidar detalle de rifa
      queryClient.invalidateQueries({
        queryKey: RAFFLE_QUERY_KEYS.detail(variables.code)
      });
      
      // Invalidar balance del usuario
      queryClient.invalidateQueries({ queryKey: ['user', 'balance'] });
      
      toast.success(UI_TEXTS.SUCCESS.PURCHASE_COMPLETED);
    },
    onError: (error: any) => {
      console.error('[usePurchaseNumber] Error comprando:', error);
      
      // Mensajes específicos según el código de error
      if (error.response?.status === 404) {
        toast.error('Esta rifa no existe o fue eliminada');
        // Redirigir al lobby después de un momento
        setTimeout(() => {
          window.location.href = '/raffles';
        }, 2000);
      } else {
        const message = error.response?.data?.message || UI_TEXTS.ERRORS.PAYMENT_FAILED;
        toast.error(message);
      }
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
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  
  // Queries
  const raffleQuery = useRaffleDetail(code);
  const numbersQuery = useRaffleNumbers(code);
  const userNumbersQuery = useUserNumbers(code);
  const winner = raffleQuery.data?.winner || (raffleQuery.data?.raffle?.winnerId ? {
    userId: raffleQuery.data.raffle.winnerId,
    username: raffleQuery.data.raffle.winnerUsername,
    displayName: raffleQuery.data.raffle.winnerDisplayName,
    winningNumber: raffleQuery.data.raffle.winnerNumber,
    prizeAmount: raffleQuery.data.raffle.mode === 'fires' ? raffleQuery.data.raffle.potFires : raffleQuery.data.raffle.potCoins,
    currency: raffleQuery.data.raffle.mode === 'fires' ? 'fires' : 'coins'
  } : undefined);
  
  // Mutations
  const reserveNumber = useReserveNumber();
  const releaseNumber = useReleaseNumber();
  const purchaseNumber = usePurchaseNumber();
  
  // Función para forzar actualización
  const forceRefresh = useCallback(() => {
    queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.detail(code) });
    queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.numbers(code) });
  }, [queryClient, code]);
  
  // Función para verificar si un número pertenece al usuario
  const isUserNumber = useCallback(
    (idx: number) => {
      return userNumbersQuery.data?.includes(idx) || false;
    },
    [userNumbersQuery.data]
  );
  
  // WebSocket: Unirse a sala y escuchar eventos
  useEffect(() => {
    if (!socket || !connected || !code || !user) return;
    
    // Unirse a la sala de la rifa
    socket.emit('raffle:join', { raffleCode: code });
    
    // Escuchar eventos de actualización
    const handleStateUpdate = (data: any) => {
      if (data.raffle) {
        queryClient.setQueryData(RAFFLE_QUERY_KEYS.detail(code), (prev: any) => {
          const prevRaffle = prev?.raffle || {};
          const prevStats = prev?.stats || {};
          return {
            ...prev,
            raffle: {
              ...prevRaffle,
              numbersSold: data.raffle.soldNumbers ?? prevRaffle.numbersSold,
              numbersReserved: data.raffle.reservedNumbers ?? prevRaffle.numbersReserved
            },
            stats: {
              ...prevStats,
              participants: data.raffle.participants ?? prevStats.participants,
              soldNumbers: data.raffle.soldNumbers ?? prevStats.soldNumbers,
              reservedNumbers: data.raffle.reservedNumbers ?? prevStats.reservedNumbers
            }
          };
        });
      }
      
      // Evitar sobreescribir la cache de números con un payload con diferente forma
      if (data.numbers) {
        queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.numbers(code) });
      }
    };
    
    const handleNumberReserved = (data: any) => {
      if (data.raffleCode === code) {
        // Usar refetch para mantener datos previos mientras actualiza
        queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.numbers(code) });
      }
    };
    
    const handleNumberPurchased = (data: any) => {
      if (data.raffleCode === code) {
        // Usar refetch para mantener datos previos mientras actualiza
        queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.numbers(code) });
        queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.detail(code) });
        
        // Mostrar notificación si no es el usuario actual
        if (data.userId !== user.id) {
          toast(`Número ${data.numberIdx} vendido`, { icon: '🎫' });
        }
      }
    };
    
    const handleNumberReleased = (data: any) => {
      if (data.raffleCode === code) {
        // Usar refetch para mantener datos previos mientras actualiza
        queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.numbers(code) });
      }
    };
    
    const handleStatusChanged = (data: any) => {
      if (data.raffleCode === code) {
        // Usar refetch para mantener datos previos mientras actualiza
        queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.detail(code) });
        toast(`Estado de rifa cambiado a: ${data.newStatus}`, { icon: '📢' });
      }
    };
    
    const handleWinnerEvent = (data: any) => {
      if (data.raffleCode !== code) return;
      queryClient.refetchQueries({ queryKey: RAFFLE_QUERY_KEYS.detail(code) });
      const isCurrentUserWinner = data.winner?.id === user?.id || data.winnerId === user?.id;
      const winnerName = data.winner?.displayName || data.winner?.username || data.winnerDisplayName || data.winnerUsername;
      const winningNumber = data.winningNumber;

      if (isCurrentUserWinner) {
        toast.success('🎉 ¡FELICIDADES! ¡Has ganado la rifa! 🎉', { duration: 10000 });
      } else if (winnerName || winningNumber !== undefined) {
        const message = winnerName
          ? `Ganador: ${winnerName}${winningNumber !== undefined ? ` (#${winningNumber})` : ''}`
          : `Número ganador: ${winningNumber}`;
        toast.success(message, { icon: '🏆' });
      }
    };
    
    // Registrar event listeners
    socket.on('raffle:state_update', handleStateUpdate);
    socket.on('raffle:number_reserved', handleNumberReserved);
    socket.on('raffle:number_purchased', handleNumberPurchased);
    socket.on('raffle:number_released', handleNumberReleased);
    socket.on('raffle:status_changed', handleStatusChanged);
    socket.on('raffle:winner_drawn', handleWinnerEvent);
    socket.on('raffle:finished', handleWinnerEvent);
    
    // Cleanup
    return () => {
      socket.emit('raffle:leave', { raffleCode: code });
      socket.off('raffle:state_update', handleStateUpdate);
      socket.off('raffle:number_reserved', handleNumberReserved);
      socket.off('raffle:number_purchased', handleNumberPurchased);
      socket.off('raffle:number_released', handleNumberReleased);
      socket.off('raffle:status_changed', handleStatusChanged);
      socket.off('raffle:winner_drawn', handleWinnerEvent);
      socket.off('raffle:finished', handleWinnerEvent);
    };
  }, [socket, connected, code, user, queryClient]);
  
  return {
    // Data
    raffle: raffleQuery.data?.raffle,
    numbers: numbersQuery.data || [],
    userNumbers: (raffleQuery.data?.userNumbers && raffleQuery.data.userNumbers.length > 0)
      ? raffleQuery.data.userNumbers
      : (userNumbersQuery.data || []),
    stats: raffleQuery.data?.stats,
    winner,
    
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
    isReserving: reserveNumber.isPending,
    isReleasing: releaseNumber.isPending,
    isPurchasing: purchaseNumber.isPending
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
    queryClient.invalidateQueries({ queryKey: RAFFLE_QUERY_KEYS.list(filters) });
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
