import { workoutTemplateInputSchema, type Exercise, type PlannedSet } from '@topout/shared';

export type DraftSet = {
  key: number;
  min: string;
  max: string;
  weight: string;
  warmup: boolean;
  amrap: boolean;
  right?: { min: string; max: string; weight: string };
};

export type DraftExercise = { exercise: Exercise; sets: DraftSet[] };

export function moveDraftItem<T>(items: T[], index: number, direction: number): T[] {
  const result = [...items];
  const target = index + direction;
  if (target < 0 || target >= result.length) return result;
  [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
}

export function createDraftSet(key: number, set?: PlannedSet): DraftSet {
  return {
    key,
    min: set?.targetRepsMin == null ? '' : String(set.targetRepsMin),
    max: set?.targetRepsMax == null ? '' : String(set.targetRepsMax),
    weight: set?.targetWeightKg == null ? '' : String(set.targetWeightKg),
    warmup: set?.isWarmup ?? false,
    amrap: set?.isAmrap ?? false,
    right: set?.rightTarget
      ? {
          min: set.rightTarget.targetRepsMin == null ? '' : String(set.rightTarget.targetRepsMin),
          max: set.rightTarget.targetRepsMax == null ? '' : String(set.rightTarget.targetRepsMax),
          weight:
            set.rightTarget.targetWeightKg == null ? '' : String(set.rightTarget.targetWeightKg),
        }
      : undefined,
  };
}

export function parseTemplateDraft(name: string, items: DraftExercise[]) {
  const number = (value: string) => (value.trim() === '' ? NaN : Number(value.replace(',', '.')));
  return workoutTemplateInputSchema.safeParse({
    name,
    exercises: items.map((e) => ({
      exerciseId: e.exercise.id,
      sets: e.sets.map((s) => ({
        targetRepsMin: s.min.trim() === '' ? null : number(s.min),
        targetRepsMax: s.max.trim() === '' ? null : number(s.max),
        targetWeightKg: s.weight.trim() === '' ? null : number(s.weight),
        isWarmup: s.warmup,
        isAmrap: s.amrap,
        ...(s.right
          ? {
              rightTarget: {
                targetRepsMin: s.right.min.trim() === '' ? null : number(s.right.min),
                targetRepsMax: s.right.max.trim() === '' ? null : number(s.right.max),
                targetWeightKg: s.right.weight.trim() === '' ? null : number(s.right.weight),
              },
            }
          : {}),
      })),
    })),
  });
}
