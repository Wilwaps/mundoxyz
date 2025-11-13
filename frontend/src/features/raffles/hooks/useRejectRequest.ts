/**
 * Hook para rechazar solicitudes de pago
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { rejectPurchaseRequest } from '../api';

interface RejectRequestParams {
  code: string;
  requestId: number;
  reason?: string;
}

interface RejectRequestResponse {
  success: boolean;
  message: string;
  numberIdx: number;
}

export const useRejectRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<RejectRequestResponse, Error, RejectRequestParams>({
    mutationFn: async ({ code, requestId, reason }) => {
      // Usar capa API centralizada para evitar duplicar el prefijo /api/raffles/v2
      const data = await rejectPurchaseRequest(code, requestId, reason) as RejectRequestResponse;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['raffle', variables.code] });
      queryClient.invalidateQueries({ queryKey: ['raffle-numbers', variables.code] });
      queryClient.invalidateQueries({ queryKey: ['raffle-participants', variables.code] });
      
      toast.success(data.message || 'Solicitud rechazada');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al rechazar solicitud');
    }
  });
};
