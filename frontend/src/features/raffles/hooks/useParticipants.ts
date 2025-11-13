/**
 * Hook para obtener participantes de una rifa
 */

import { useQuery } from '@tanstack/react-query';
import api from '../api';
import type { ParticipantsResponse } from '../types';
import { API_ENDPOINTS } from '../constants';

export const useParticipants = (raffleCode: string, enabled = true) => {
  return useQuery<ParticipantsResponse>({
    queryKey: ['raffle-participants', raffleCode],
    queryFn: async () => {
      const response = await api.get(API_ENDPOINTS.PARTICIPANTS(raffleCode));
      return response.data;
    },
    enabled: enabled && !!raffleCode,
    staleTime: 30000, // 30 segundos
    refetchInterval: false // ❌ Desactivado - actualización vía socket events
  });
};
