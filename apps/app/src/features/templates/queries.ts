import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../lib/providers';

export const templatesKey = ['workout-templates'] as const;

export function useTemplates() {
  const { api, status } = useSession();

  return useQuery({
    queryKey: templatesKey,
    queryFn: () => api.listWorkoutTemplates(),
    enabled: status === 'authenticated',
  });
}
