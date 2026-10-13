import { workoutLoggingKey } from './queries';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Button } from '../../ui/components/Button';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Heading } from '../../ui/components/Heading';
import { Loading } from '../../ui/components/Loading';
import { Page } from '../../ui/components/Page';
import { WorkoutLoggingForm } from './WorkoutLoggingForm';

export function WorkoutLogger({ scheduleId }: { scheduleId: number }) {
  const { api } = useSession();
  const query = useQuery({
    queryKey: workoutLoggingKey(scheduleId),
    queryFn: () => api.getWorkoutLogging(scheduleId),
    enabled: Number.isSafeInteger(scheduleId) && scheduleId > 0,
  });
  const router = useRouter();
  if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0)
    return (
      <Page>
        <Heading>Workout not found</Heading>
        <Button title="Back to Calendar" onPress={() => router.replace('/calendar')} />
      </Page>
    );
  if (query.isPending) return <Loading text="Loading workout…" />;
  if (query.isError)
    return (
      <Page>
        <ErrorNotice message={errorMessage(query.error)} />
        <Button
          title="Try again"
          onPress={() => {
            void query.refetch();
          }}
        />
        <Button title="Back to Calendar" onPress={() => router.replace('/calendar')} />
      </Page>
    );
  return <WorkoutLoggingForm key={scheduleId} workout={query.data} />;
}
