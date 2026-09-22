import { useLocalSearchParams } from 'expo-router';
import { ExerciseEditor } from '../../../../src/features/exercises/ExerciseEditor';
export default function EditExercise() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseEditor id={Number(id)} />;
}
