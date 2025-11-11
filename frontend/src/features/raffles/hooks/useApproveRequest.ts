/**
 * Hook para aprobar solicitudes de pago
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import api from '../api';

interface ApproveRequestParams {
  code: string;
  requestId: number;
}

interface ApproveRequestResponse {
  success: boolean;
  message: string;
  numberIdx: number;
}

export const useApproveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation<ApproveRequestResponse, Error, ApproveRequestParams>({
    mutationFn: async ({ code, requestId }) => {
      const response = await api.post(
        `/api/raffles/v2/${code}/requests/${requestId}/approve`
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['raffle', variables.code] });
      queryClient.invalidateQueries({ queryKey: ['raffle-numbers', variables.code] });
      queryClient.invalidateQueries({ queryKey: ['raffle-participants', variables.code] });
      
      toast.success(data.message || 'Solicitud aprobada exitosamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al aprobar solicitud');
    }
  });
};
