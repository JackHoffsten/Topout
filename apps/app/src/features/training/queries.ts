import type { QueryClient } from '@tanstack/react-query';

// Mutation owners describe the training data that committed; this boundary owns
// the dependent views, including suggestions combining both activities.
export async function refreshTraining(
  cache: QueryClient,
  activity: 'workout' | 'climb',
  deletedClimbId?: number,
) {
  const keys =
    activity === 'workout'
      ? [
          ['progress'],
          ['workout-schedule'],
          ['log-locations', 'workout'],
          ['log-locations', 'progress'],
        ]
      : [
          ['progress'],
          ['climb-logs'],
          ['climb-projects'],
          ['climb-photo'],
          ['log-locations', 'climb'],
          ['log-locations', 'progress'],
        ];
  await Promise.all(
    keys.map((queryKey) =>
      cache.invalidateQueries({
        queryKey,
        predicate: (query) =>
          !(
            query.queryKey[0] === 'climb-logs' &&
            query.queryKey[1] === 'detail' &&
            query.queryKey[2] === deletedClimbId
          ),
      }),
    ),
  );
}
