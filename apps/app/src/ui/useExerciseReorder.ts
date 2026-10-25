import { useRef, useState } from 'react';
import { errorMessage } from '@topout/shared';
import { useSaveFeedback } from './saveFeedback';

// Serialize moves before React rerenders, so rapid input cannot race a pending save.
export function useExerciseReorder<T extends { exercise: { id: number } }>(
  items: T[],
  setItems: (items: T[]) => void,
  save: (ids: number[]) => Promise<unknown>,
  persisted = true,
) {
  const { feedback, run } = useSaveFeedback('Exercise order');
  const [movedId, setMovedId] = useState<number>();
  const [reveal, setReveal] = useState<{ id: number; revision: number }>();
  const revision = useRef(0);
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const move = async (from: number, to: number) => {
    if (locked.current || from === to || !items[from] || !items[to]) return;
    locked.current = true;
    setPending(true);
    setError(undefined);
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setItems(next);
    setMovedId(item!.exercise.id);
    setReveal({ id: item!.exercise.id, revision: ++revision.current });
    try {
      const action = () => save(next.map((entry) => entry.exercise.id));
      if (persisted) await run(action);
      else await action();
    } catch (cause) {
      setItems(items);
      setReveal({ id: item!.exercise.id, revision: ++revision.current });
      setError(
        `Could not save exercise order. ${errorMessage(cause)} Try moving the exercise again.`,
      );
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return { pending, error, move, feedback, movedId, reveal };
}
