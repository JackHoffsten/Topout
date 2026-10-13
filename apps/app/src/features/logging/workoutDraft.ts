import type { Exercise, PlannedSet, WorkoutLogging } from '@topout/shared';
export type DraftSet = {
  side: 'Both' | 'Left' | 'Right';
  reps: string;
  weight: string;
  warmup: boolean;
  notes: string;
  target?: PlannedSet;
  order: number;
  saved?: string;
};
export type DraftExercise = { exercise: Exercise; sets: DraftSet[] };
export const blankSet = (target?: PlannedSet, order = 1): DraftSet => ({
  side: 'Both',
  reps: '',
  weight: '',
  warmup: target?.isWarmup ?? false,
  notes: '',
  target,
  order,
});
export const signature = (set: DraftSet) =>
  JSON.stringify([set.reps, set.weight, set.warmup, set.notes, set.side]);
export function restoreWorkoutDraft(workout: WorkoutLogging): DraftExercise[] {
  const recorded = workout.log?.exercises ?? [];
  const sources = workout.log?.completedAt
    ? recorded
    : [
        ...(workout.template?.exercises ?? []),
        ...recorded.filter(
          (e) => !workout.template?.exercises.some((t) => t.exercise.id === e.exercise.id),
        ),
      ];
  return sources
    .filter((item) => !workout.log?.removedExerciseIds?.includes(item.exercise.id))
    .map((item) => {
      const actual = recorded.find((e) => e.exercise.id === item.exercise.id)?.sets ?? [];
      const targets = workout.log?.completedAt
        ? []
        : (workout.template?.exercises.find((e) => e.exercise.id === item.exercise.id)?.sets ?? []);
      const orders = workout.log?.completedAt
        ? [...new Set(actual.map((s) => s.order))]
        : Array.from(
            { length: Math.max(targets.length, ...actual.map((s) => s.order), 1) },
            (_, i) => i + 1,
          );
      return {
        exercise: item.exercise,
        sets: orders.flatMap((order) => {
          const results = actual.filter((s) => s.order === order);
          const planned = targets[order - 1];
          const sides: DraftSet['side'][] =
            results.some((s) => (s.side ?? 'Both') !== 'Both') ||
            (!results.length && !!planned?.rightTarget)
              ? workout.log?.completedAt
                ? results.map((s) => s.side)
                : ['Left', 'Right']
              : ['Both'];
          return sides.map((side) => {
            const target =
              side === 'Right' && planned?.rightTarget
                ? { ...planned, ...planned.rightTarget }
                : planned;
            const set = actual.find((s) => s.order === order && (s.side ?? 'Both') === side);
            const draft = set
              ? {
                  reps: String(set.reps),
                  side,
                  weight: String(set.weightKg),
                  warmup: set.isWarmup,
                  notes: set.notes ?? '',
                  order,
                  target,
                }
              : { ...blankSet(target, order), side };
            return set ? { ...draft, saved: signature(draft) } : draft;
          });
        }),
      };
    });
}
export function draftDefaults(workout: WorkoutLogging, exerciseId: number, set: DraftSet) {
  const previous = workout.previousSets?.find(
    (s) => s.exerciseId === exerciseId && s.order === set.order && (s.side ?? 'Both') === set.side,
  );
  return {
    reps: previous?.reps ?? set.target?.targetRepsMin,
    weight: previous?.weightKg ?? set.target?.targetWeightKg,
  };
}
export const valueOrDefault = (value: string, fallback: number | null | undefined) =>
  value.trim() ? Number(value.replace(',', '.')) : (fallback ?? NaN);

export function reconcileRecordedSet(
  items: DraftExercise[],
  input: {
    exerciseId: number;
    order: number;
    side?: DraftSet['side'];
    reps: number;
    weightKg: number;
  },
) {
  return items.map((item) =>
    item.exercise.id !== input.exerciseId
      ? item
      : {
          ...item,
          sets: item.sets.map((set) => {
            if (set.order !== input.order || set.side !== input.side) return set;
            const logged = { ...set, reps: String(input.reps), weight: String(input.weightKg) };
            return { ...logged, saved: signature(logged) };
          }),
        },
  );
}
export function splitDraftSet(items: DraftExercise[], exerciseId: number, order: number) {
  return items.map((item) =>
    item.exercise.id !== exerciseId
      ? item
      : {
          ...item,
          sets: item.sets.flatMap((set) =>
            set.order === order && set.side === 'Both'
              ? [
                  { ...set, side: 'Left' as const, saved: undefined },
                  { ...set, side: 'Right' as const, saved: undefined },
                ]
              : [set],
          ),
        },
  );
}
export function mergeDraftSet(items: DraftExercise[], exerciseId: number, order: number) {
  return items.map((item) => {
    if (item.exercise.id !== exerciseId) return item;
    const group = item.sets.filter((set) => set.order === order),
      kept = group.find((set) => set.side === 'Left') ?? group[0];
    if (!kept) return item;
    const first = item.sets.findIndex((set) => set.order === order);
    return {
      ...item,
      sets: item.sets.flatMap((set, index) =>
        set.order !== order
          ? [set]
          : index === first
            ? [
                {
                  ...kept,
                  side: 'Both' as const,
                  saved: undefined,
                  target: kept.target ? { ...kept.target, rightTarget: null } : undefined,
                },
              ]
            : [],
      ),
    };
  });
}

export function completionExercises(workout: WorkoutLogging, items: DraftExercise[]) {
  return items
    .map((item) => ({
      exerciseId: item.exercise.id,
      sets: item.sets
        .filter(
          (set) =>
            set.saved ||
            set.reps.trim() ||
            set.weight.trim() ||
            draftDefaults(workout, item.exercise.id, set).reps != null,
        )
        .map((set) => ({
          reps: valueOrDefault(set.reps, draftDefaults(workout, item.exercise.id, set).reps),
          order: set.order,
          side: set.side,
          weightKg: valueOrDefault(
            set.weight,
            draftDefaults(workout, item.exercise.id, set).weight,
          ),
          isWarmup: set.warmup,
          notes: set.notes.trim() || null,
        })),
    }))
    .filter((item) => item.sets.length > 0);
}
