import { test, expect } from '@jest/globals';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { refreshTraining } from '../features/training/queries';

test('a workout write refreshes combined progress location suggestions', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let locations = ['Old gym'];
  const observer = new QueryObserver(cache, {
    queryKey: ['log-locations', 'progress', ''],
    queryFn: async () => locations,
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  await observer.refetch();
  locations = ['New gym'];
  await refreshTraining(cache, 'workout');
  expect(observer.getCurrentResult().data).toEqual(['New gym']);
  unsubscribe();
  cache.clear();
});
