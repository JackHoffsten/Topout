import {
  workoutTemplateInputSchema,
  type WorkoutLogging,
  type WorkoutTemplateInput,
} from '@topout/shared';

export type TemplateSetSelection = {
  exerciseId: number;
  order: number;
  side: 'Both' | 'Left' | 'Right';
};

export function templateFromLoggedSet(
  workout: WorkoutLogging,
  selection: TemplateSetSelection,
): WorkoutTemplateInput | null {
  const { template, log } = workout;
  if (!template || !log) return null;
  const exercise = template.exercises.find((item) => item.exercise.id === selection.exerciseId);
  const target = exercise?.sets[selection.order - 1];
  const result = log.exercises
    .find((item) => item.exercise.id === selection.exerciseId)
    ?.sets.find((set) => set.order === selection.order && (set.side ?? 'Both') === selection.side);
  if (!target || !result || !!target.rightTarget !== (selection.side !== 'Both')) return null;
  const values = {
    targetRepsMin: result.reps,
    targetRepsMax: null,
    targetWeightKg: result.weightKg,
  };
  const parsed = workoutTemplateInputSchema.safeParse({
    name: template.name,
    exercises: template.exercises.map((item) => ({
      exerciseId: item.exercise.id,
      sets: item.sets.map((set, index) => {
        if (item.exercise.id !== selection.exerciseId || index + 1 !== selection.order) return set;
        return selection.side === 'Right' ? { ...set, rightTarget: values } : { ...set, ...values };
      }),
    })),
  });
  return parsed.success ? parsed.data : null;
}

// Match by exercise identity and logical set position, preserving template ordering.
export function templateFromLog(workout: WorkoutLogging): WorkoutTemplateInput | null {
  const { template, log } = workout;
  if (!template || !log?.completedAt || !template.exercises.length) return null;
  if (template.exercises.length !== log.exercises.length) return null;
  const exercises = [];
  for (const planned of template.exercises) {
    const actual = log.exercises.find((item) => item.exercise.id === planned.exercise.id);
    if (!actual || !planned.sets.length) return null;
    const expectedCount = planned.sets.reduce((n, set) => n + (set.rightTarget ? 2 : 1), 0);
    if (actual.sets.length !== expectedCount) return null;
    const sets = [];
    for (const [index, target] of planned.sets.entries()) {
      const results = actual.sets.filter((set) => set.order === index + 1);
      const left = results.find(
        (set) => (set.side ?? 'Both') === (target.rightTarget ? 'Left' : 'Both'),
      );
      const right = results.find((set) => set.side === 'Right');
      if (
        !left ||
        results.length !== (target.rightTarget ? 2 : 1) ||
        (target.rightTarget && !right)
      )
        return null;
      sets.push({
        targetRepsMin: left.reps,
        targetRepsMax: null,
        targetWeightKg: left.weightKg,
        isWarmup: target.isWarmup,
        isAmrap: target.isAmrap,
        rightTarget:
          target.rightTarget && right
            ? { targetRepsMin: right.reps, targetRepsMax: null, targetWeightKg: right.weightKg }
            : null,
      });
    }
    exercises.push({ exerciseId: planned.exercise.id, sets });
  }
  const parsed = workoutTemplateInputSchema.safeParse({ name: template.name, exercises });
  return parsed.success ? parsed.data : null;
}
