import { useLocalSearchParams } from 'expo-router';
import { WorkoutLogger } from '../../../src/features/logging/WorkoutLogger';

export default function WorkoutRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutLogger scheduleId={Number(id)} />;
}
