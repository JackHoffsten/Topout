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
type RecordedSet = NonNullable<WorkoutLogging['log']>['exercises'][number]['sets'][number];
export function draftSetFromActual(actual: RecordedSet | undefined, fallback: DraftSet): DraftSet {
  if (!actual) return fallback;
  const draft = {
    ...fallback,
    reps: String(actual.reps),
    weight: String(actual.weightKg),
    warmup: actual.isWarmup,
    notes: actual.notes ?? '',
    side: actual.side ?? 'Both',
    order: actual.order,
  };
  return { ...draft, saved: signature(draft) };
}
export function restoreWorkoutDraft(workout: WorkoutLogging): DraftExercise[] {
  const recorded = workout.log?.exercises ?? [];
  const replacements = workout.log?.replacements ?? [];
  const templateSources = (workout.template?.exercises ?? [])
    .filter(
      (item) =>
        replacements.some((r) => r.originalExerciseId === item.exercise.id) ||
        !workout.log?.removedExerciseIds?.includes(item.exercise.id),
    )
    .map((item) => {
      const replacement = replacements.find((r) => r.originalExerciseId === item.exercise.id);
      return {
        ...item,
        exercise: replacement?.exercise ?? item.exercise,
      };
    });
  const extras = recorded.filter(
    (e) => !templateSources.some((t) => t.exercise.id === e.exercise.id),
  );
  const sources = (workout.log?.completedAt ? recorded : [...templateSources, ...extras]).filter(
    (item) =>
      replacements.some((r) => r.exercise.id === item.exercise.id) ||
      !workout.log?.removedExerciseIds?.includes(item.exercise.id),
  );
  const ordered = workout.log?.completedAt
    ? sources
    : sources.filter((item) => !replacements.some((r) => r.exercise.id === item.exercise.id));
  if (!workout.log?.completedAt) {
    // Insert replacements at their saved positions; other additions fill the remaining slots.
    // Recorded entry order reflects logging chronology, which may differ from workout order.
    let previousPosition = -1;
    for (const replacement of [...replacements].sort(
      (a, b) =>
        a.order - b.order ||
        sources.findIndex((item) => item.exercise.id === a.exercise.id) -
          sources.findIndex((item) => item.exercise.id === b.exercise.id),
    )) {
      const source = sources.find((item) => item.exercise.id === replacement.exercise.id);
      if (!source) continue;
      const position = Math.min(
        Math.max(replacement.order - 1, previousPosition + 1),
        ordered.length,
      );
      ordered.splice(position, 0, source);
      previousPosition = position;
    }
  }
  const savedOrder = workout.log?.exerciseOrder;
  if (savedOrder?.length) {
    const position = (id: number) => {
      const index = savedOrder.indexOf(id);
      return index < 0 ? savedOrder.length : index;
    };
    ordered.sort((a, b) => position(a.exercise.id) - position(b.exercise.id));
  }
  return ordered.map((item) => {
    const actual = recorded.find((e) => e.exercise.id === item.exercise.id)?.sets ?? [];
    const replacement = replacements.find((r) => r.exercise.id === item.exercise.id);
    const targets = workout.log?.completedAt
      ? []
      : replacement
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
      sets: (replacement && !workout.log?.completedAt
        ? replacement.sets.map((set) => ({
            order: set.order,
            side: set.side,
            warmup: set.isWarmup,
          }))
        : orders.flatMap((order) => {
            const results = actual.filter((s) => s.order === order);
            const planned = targets[order - 1];
            const sides: DraftSet['side'][] =
              results.some((s) => (s.side ?? 'Both') !== 'Both') ||
              (!results.length && !!planned?.rightTarget)
                ? workout.log?.completedAt
                  ? results.map((s) => s.side)
                  : ['Left', 'Right']
                : ['Both'];
            return sides.map((side) => ({ order, side, warmup: planned?.isWarmup ?? false }));
          })
      ).map(({ order, side, warmup }) => {
        const planned = targets[order - 1];
        const target =
          side === 'Right' && planned?.rightTarget
            ? { ...planned, ...planned.rightTarget }
            : planned;
        const set = actual.find((s) => s.order === order && (s.side ?? 'Both') === side);
        return draftSetFromActual(set, { ...blankSet(target, order), side, warmup });
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
