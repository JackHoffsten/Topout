import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../lib/providers';
export const exercisesKey = ['exercises'] as const;
export function useExercises() {
  const { api, status } = useSession();
  return useQuery({
    queryKey: exercisesKey,
    queryFn: () => api.listExercises(),
    enabled: status === 'authenticated',
  });
}
