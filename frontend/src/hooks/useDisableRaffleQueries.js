import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const RAFFLE_ROOT_KEY = ['raffles'];

const isRaffleQueryKey = (queryKey) => {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
  return String(queryKey[0]) === 'raffles';
};

const useDisableRaffleQueries = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!queryClient) return undefined;

    // Cancel and remove any active raffle queries immediately
    queryClient.cancelQueries({ queryKey: RAFFLE_ROOT_KEY, exact: false });
    queryClient.removeQueries({ queryKey: RAFFLE_ROOT_KEY, exact: false });

    // Subscribe to query cache to intercept new raffle queries created while the store views are active
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const queryKey = event?.query?.queryKey;
      if (!queryKey || !isRaffleQueryKey(queryKey)) return;

      // Ensure raffle queries don't keep running in background while operator usa la tienda
      queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.removeQueries({ queryKey, exact: true });
    });

    return () => {
      unsubscribe?.();
    };
  }, [queryClient]);
};

export default useDisableRaffleQueries;
