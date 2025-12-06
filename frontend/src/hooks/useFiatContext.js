import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const useFiatContext = () => {
  return useQuery({
    queryKey: ['fiat-context'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const response = await axios.get('/api/economy/fiat-context');
      return response.data;
    },
  });
};

export default useFiatContext;
