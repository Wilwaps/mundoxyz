/**
 * Hook para aprobar solicitudes de pago
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { approvePurchaseRequest } from '../api';

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
      // Usar capa API centralizada para evitar duplicar el prefijo /api/raffles/v2
      const data = await approvePurchaseRequest(code, requestId) as ApproveRequestResponse;
      return data;
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
