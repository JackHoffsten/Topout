import { test, expect } from '@jest/globals';
import {
  restoreWorkoutDraft,
  splitDraftSet,
  mergeDraftSet,
  reconcileRecordedSet,
  draftDefaults,
} from '../features/logging/workoutDraft';
import type { WorkoutLogging } from '@topout/shared';

const exercise = { id: 1, name: 'Row', muscleGroups: ['Back'], isCustom: false };
const workout = {
  scheduleId: 2,
  date: '2026-10-01',
  templateName: 'Pull',
  log: null,
  template: {
    id: 1,
    name: 'Pull',
    exercises: [
      {
        exercise,
        sets: [
          {
            targetRepsMin: 8,
            targetRepsMax: 12,
            targetWeightKg: 20,
            isWarmup: false,
            isAmrap: false,
          },
        ],
      },
    ],
  },
} as WorkoutLogging;

test('reopening an unfinished workout excludes removed template exercises', () => {
  expect(
    restoreWorkoutDraft({
      ...workout,
      log: {
        id: 3,
        date: workout.date,
        notes: null,
        completedAt: null,
        exercises: [],
        removedExerciseIds: [1],
      },
    }),
  ).toEqual([]);
});

test('restored targets can split, retain left values when merged, and reconcile a saved side', () => {
  const restored = restoreWorkoutDraft(workout);
  const split = splitDraftSet(restored, 1, 1);
  expect(split[0]!.sets.map((set) => set.side)).toEqual(['Left', 'Right']);
  const recorded = reconcileRecordedSet(split, {
    exerciseId: 1,
    order: 1,
    side: 'Left',
    reps: 10,
    weightKg: 22,
  });
  expect(recorded[0]!.sets[0]).toMatchObject({ reps: '10', weight: '22' });
  expect(recorded[0]!.sets[0]!.saved).toBeDefined();
  expect(recorded[0]!.sets[1]!.saved).toBeUndefined();
  const merged = mergeDraftSet(recorded, 1, 1);
  expect(merged[0]!.sets).toHaveLength(1);
  expect(merged[0]!.sets[0]).toMatchObject({ side: 'Both', reps: '10', saved: undefined });
  expect(draftDefaults(workout, 1, restored[0]!.sets[0]!)).toEqual({ reps: 8, weight: 20 });
});

test('saved exercise order overrides template and logging chronology while retaining empty additions', () => {
  const typedExercise = workout.template!.exercises[0]!.exercise;
  const second = { ...typedExercise, id: 2, name: 'Curl' };
  const restored = restoreWorkoutDraft({
    ...workout,
    log: {
      id: 3,
      date: workout.date,
      completedAt: null,
      notes: null,
      exerciseOrder: [2, 1],
      exercises: [
        { exercise: typedExercise, sets: [] },
        { exercise: second, sets: [] },
      ],
    },
  });
  expect(restored.map((item) => item.exercise.id)).toEqual([2, 1]);
  expect(restored[0]!.sets[0]!.reps).toBe('');
  expect(restored[1]!.sets[0]!.target?.targetRepsMin).toBe(8);
});
