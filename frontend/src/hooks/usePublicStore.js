import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const usePublicStore = (slug) => {
  return useQuery({
    queryKey: ['public-store', slug],
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await axios.get(`/api/store/public/${slug}`);
      return response.data;
    },
  });
};

export default usePublicStore;
