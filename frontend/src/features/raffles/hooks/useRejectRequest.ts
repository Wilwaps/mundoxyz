/**
 * Hook para rechazar solicitudes de pago
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../api';

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
      const response = await api.post(
        `/api/raffles/v2/${code}/requests/${requestId}/reject`,
        { reason }
      );
      return response.data;
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
