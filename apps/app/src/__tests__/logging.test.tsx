import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import { renderAsync, screen, fireEventAsync, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkoutLogger } from '../features/logging/WorkoutLogger';
import { templateFromLog, templateFromLoggedSet } from '../features/logging/templateFromLog';
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
            isWarmup: true,
            isAmrap: false,
          },
        ],
      },
    ],
  },
};
const mockApi = {
  getWorkoutLogging: jest.fn<(...args: any[]) => Promise<any>>(),
  completeWorkout: jest.fn<(...args: any[]) => Promise<any>>(),
  updateWorkout: jest.fn<(...args: any[]) => Promise<any>>(),
  recordWorkoutSet: jest.fn<(...args: any[]) => Promise<any>>(),
  removeWorkoutSet: jest.fn<(...args: any[]) => Promise<any>>(),
  updateWorkoutTemplate: jest.fn<(...args: any[]) => Promise<any>>(),
  listExercises: jest.fn<() => Promise<any[]>>(),
  listLogLocations: jest.fn<() => Promise<string[]>>(),
  setWorkoutLocation: jest.fn<(...args: any[]) => Promise<any>>(),
};
const mockReplace = jest.fn();
jest.mock('../lib/providers', () => ({
  useSession: () => ({ api: mockApi, status: 'authenticated' }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
beforeEach(() => {
  jest.resetAllMocks();
  mockApi.getWorkoutLogging.mockResolvedValue(workout);
  mockApi.listLogLocations.mockResolvedValue([]);
  mockApi.listExercises.mockResolvedValue([exercise]);
});
async function mount(label = 'Row set 1 reps') {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await renderAsync(
    <QueryClientProvider client={client}>
      <WorkoutLogger scheduleId={2} />
    </QueryClientProvider>,
  );
  await screen.findByLabelText(label);
}

test('missing defaults stay empty and cannot be logged without reps', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue({
    ...workout,
    template: {
      ...workout.template,
      exercises: [
        {
          exercise,
          sets: [
            { ...workout.template.exercises[0]!.sets[0], targetRepsMin: null, targetRepsMax: null },
          ],
        },
      ],
    },
  });
  await mount();
  expect(screen.queryByText(/Planned:/)).toBeNull();
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('');
  expect(screen.getByLabelText('Row set 1 reps').props.placeholder).toBe('');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Log Row set 1' }));
  expect(mockApi.recordWorkoutSet).not.toHaveBeenCalled();
});

const matchingWorkout = () =>
  ({
    ...JSON.parse(JSON.stringify(workout)),
    previousSets: [],
    log: {
      id: 3,
      date: workout.date,
      notes: null,
      completedAt: '2026-10-01T12:00:00Z',
      exercises: [
        {
          exercise,
          sets: [{ order: 1, side: 'Both', reps: 10, weightKg: 25, isWarmup: false, notes: null }],
        },
      ],
    },
  }) as WorkoutLogging;

test('updates matching template targets only after confirmation using saved results', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue(matchingWorkout());
  mockApi.updateWorkoutTemplate.mockResolvedValue(workout.template);
  await mount('Update template');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Update template' }));
  expect(mockApi.updateWorkoutTemplate).not.toHaveBeenCalled();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Confirm update' }));
  await waitFor(() =>
    expect(mockApi.updateWorkoutTemplate).toHaveBeenCalledWith(1, {
      name: 'Pull',
      exercises: [
        {
          exerciseId: 1,
          sets: [
            {
              targetRepsMin: 10,
              targetRepsMax: null,
              targetWeightKg: 25,
              isWarmup: true,
              isAmrap: false,
              rightTarget: null,
            },
          ],
        },
      ],
    }),
  );
  await screen.findByText('Template updated.');
});

test('rechecks matching structure before updating and preserves the template on mismatch', async () => {
  const current = matchingWorkout();
  mockApi.getWorkoutLogging.mockResolvedValueOnce(current).mockResolvedValue({
    ...current,
    template: { ...current.template!, exercises: [] },
  });
  await mount('Update template');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Update template' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Confirm update' }));
  await screen.findByText('The saved workout no longer matches the template.');
  expect(mockApi.updateWorkoutTemplate).not.toHaveBeenCalled();
});

test('cancelling a template update does not save and failed updates remain retryable', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue(matchingWorkout());
  mockApi.updateWorkoutTemplate.mockRejectedValue(new Error('Could not save template.'));
  await mount('Update template');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Update template' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(mockApi.updateWorkoutTemplate).not.toHaveBeenCalled();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Update template' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Confirm update' }));
  await screen.findByText('Could not save template.');
  mockApi.updateWorkoutTemplate.mockResolvedValue(workout.template);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Confirm update' }));
  await screen.findByText('Template updated.');
});

test('mismatching completed workouts disable template updates', async () => {
  const current = matchingWorkout();
  current.log!.exercises[0]!.sets = [];
  mockApi.getWorkoutLogging.mockResolvedValue(current);
  await mount('Update template');
  expect(screen.getByRole('button', { name: 'Update template' })).toBeDisabled();
});

test('template matching rejects unfinished logs, changed exercises, missing and extra sets', () => {
  const current = matchingWorkout();
  expect(templateFromLog({ ...current, log: { ...current.log!, completedAt: null } })).toBeNull();
  expect(templateFromLog({ ...current, template: null })).toBeNull();
  for (const sets of [
    [],
    [...current.log!.exercises[0]!.sets, { ...current.log!.exercises[0]!.sets[0]!, order: 2 }],
  ]) {
    expect(
      templateFromLog({
        ...current,
        log: {
          ...current.log!,
          exercises: [{ exercise: current.log!.exercises[0]!.exercise, sets }],
        },
      }),
    ).toBeNull();
  }
  current.log!.exercises[0]!.exercise = { ...current.log!.exercises[0]!.exercise, id: 99 };
  expect(templateFromLog(current)).toBeNull();
});

test('updates one saved set in an unfinished workout while retaining other targets', async () => {
  const current = matchingWorkout();
  current.log!.completedAt = null;
  const otherTarget = {
    ...current.template!.exercises[0]!.sets[0]!,
    targetRepsMin: 6,
    targetRepsMax: 8,
  };
  current.template!.exercises[0]!.sets.push(otherTarget);
  mockApi.getWorkoutLogging.mockResolvedValue(current);
  mockApi.updateWorkoutTemplate.mockResolvedValue(current.template);
  await mount();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Update template Row set 1' }));
  expect(mockApi.updateWorkoutTemplate).not.toHaveBeenCalled();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Confirm set update' }));
  await screen.findByText('Template set updated.');
  expect(mockApi.updateWorkoutTemplate).toHaveBeenCalledWith(1, {
    name: 'Pull',
    exercises: [
      {
        exerciseId: 1,
        sets: [
          {
            ...current.template!.exercises[0]!.sets[0]!,
            targetRepsMin: 10,
            targetRepsMax: null,
            targetWeightKg: 25,
          },
          otherTarget,
        ],
      },
    ],
  });
});

test('per-set updates are available on completed logs but disabled for unsaved changes', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue(matchingWorkout());
  await mount('Update template');
  expect(screen.getByRole('button', { name: 'Update template Row set 1' })).toBeEnabled();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Edit workout' }));
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 reps'), '11');
  expect(screen.getByRole('button', { name: 'Update template Row set 1' })).toBeDisabled();
});

test('single-side update preserves the other side and rejects incompatible or missing targets', () => {
  const current = matchingWorkout();
  const selection = { exerciseId: 1, order: 1, side: 'Right' as const };
  expect(templateFromLoggedSet(current, selection)).toBeNull();
  const left = { ...current.template!.exercises[0]!.sets[0]! };
  current.template!.exercises[0]!.sets[0]!.rightTarget = {
    targetRepsMin: 8,
    targetRepsMax: 10,
    targetWeightKg: 20,
  };
  current.log!.exercises[0]!.sets = [
    { ...current.log!.exercises[0]!.sets[0]!, side: 'Right', reps: 12, weightKg: 30 },
  ];
  expect(templateFromLoggedSet(current, selection)?.exercises[0]!.sets[0]).toEqual({
    ...left,
    rightTarget: { targetRepsMin: 12, targetRepsMax: null, targetWeightKg: 30 },
  });
  expect(templateFromLoggedSet(current, { ...selection, order: 2 })).toBeNull();
  expect(templateFromLoggedSet(current, { ...selection, exerciseId: 99 })).toBeNull();
  expect(templateFromLoggedSet(current, { ...selection, side: 'Left' })).toBeNull();
});

test('split template targets require both sides and keep their independent values', () => {
  const current = matchingWorkout();
  current.template!.exercises[0]!.sets[0]!.rightTarget = {
    targetRepsMin: 8,
    targetRepsMax: null,
    targetWeightKg: 20,
  };
  expect(templateFromLog(current)).toBeNull();
  const set = current.log!.exercises[0]!.sets[0]!;
  current.log!.exercises[0]!.sets = [
    { ...set, side: 'Right', reps: 12, weightKg: 30 },
    { ...set, side: 'Left' },
  ];
  expect(templateFromLog(current)?.exercises[0]!.sets[0]).toMatchObject({
    targetRepsMin: 10,
    targetWeightKg: 25,
    rightTarget: { targetRepsMin: 12, targetRepsMax: null, targetWeightKg: 30 },
  });
  current.log!.exercises[0]!.sets.pop();
  expect(templateFromLog(current)).toBeNull();
});
test('saves entered values instead of defaults and shows completed results', async () => {
  await mount();
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 reps'), '9');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 weight (kg)'), '22,5');
  mockApi.completeWorkout.mockResolvedValue({
    ...workout,
    log: {
      id: 3,
      date: workout.date,
      notes: null,
      completedAt: '2026-10-01T12:00:00Z',
      exercises: [
        { exercise, sets: [{ reps: 9, weightKg: 22.5, isWarmup: true, notes: null, order: 1 }] },
      ],
    },
  });
  await fireEventAsync.press(screen.getByRole('button', { name: 'Finish workout' }));
  await waitFor(() =>
    expect(mockApi.completeWorkout).toHaveBeenCalledWith(2, {
      location: null,
      notes: null,
      exercises: [
        {
          exerciseId: 1,
          sets: [{ reps: 9, weightKg: 22.5, isWarmup: true, notes: null, order: 1, side: 'Both' }],
        },
      ],
    }),
  );
  await screen.findByText('Completed');
  expect(screen.queryByLabelText('Row set 1 reps')).toBeNull();
});

test('saves an optional workout location independently without requiring sets', async () => {
  mockApi.setWorkoutLocation.mockResolvedValue({
    ...workout,
    log: {
      id: 1,
      date: workout.date,
      notes: null,
      completedAt: null,
      exercises: [],
      location: 'Central Gym',
    },
  });
  await mount();
  await screen.findByLabelText('Location (optional)');
  await fireEventAsync.changeText(screen.getByLabelText('Location (optional)'), 'Central Gym');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save location' }));
  await waitFor(() => expect(mockApi.setWorkoutLocation).toHaveBeenCalledWith(2, 'Central Gym'));
  expect(mockApi.recordWorkoutSet).not.toHaveBeenCalled();
});

test('automatically saves the selected workout location rather than the typed prefix', async () => {
  mockApi.listLogLocations.mockResolvedValue(['Central Gym']);
  mockApi.setWorkoutLocation.mockResolvedValue(workout);
  await mount();
  const field = await screen.findByLabelText('Location (optional)');
  await fireEventAsync.changeText(field, 'Cent');
  await fireEventAsync(field, 'focus');
  const suggestion = await screen.findByRole('button', { name: 'Use location Central Gym' });
  await fireEventAsync.press(suggestion);
  await waitFor(() => expect(mockApi.setWorkoutLocation).toHaveBeenCalledWith(2, 'Central Gym'));
  expect(mockApi.setWorkoutLocation).toHaveBeenCalledTimes(1);
  expect(mockApi.recordWorkoutSet).not.toHaveBeenCalled();
});

test('shows the latest matching set instead of planned targets without filling actual inputs', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue({
    ...workout,
    previousSets: [
      { exerciseId: 1, order: 1, date: '2026-09-29', reps: 10, weightKg: 35, isWarmup: false },
    ],
  });
  await mount();
  expect(screen.getByText(/Last logged \(2026-09-29\)/)).toBeTruthy();
  expect(screen.queryByText(/Planned:/)).toBeNull();
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('');
  expect(screen.getByLabelText('Row set 1 reps').props.placeholder).toBe('10');
  expect(screen.getByLabelText('Row set 1 weight (kg)').props.placeholder).toBe('35');
  mockApi.recordWorkoutSet.mockResolvedValue(workout);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Log Row set 1' }));
  await waitFor(() =>
    expect(mockApi.recordWorkoutSet).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ reps: 10, weightKg: 35 }),
    ),
  );
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('10');
});
test('planned placeholders save on finish and zero weight is retained', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue({
    ...workout,
    template: {
      ...workout.template,
      exercises: [
        { exercise, sets: [{ ...workout.template.exercises[0]!.sets[0], targetWeightKg: 0 }] },
      ],
    },
  });
  mockApi.completeWorkout.mockResolvedValue(matchingWorkout());
  await mount();
  expect(screen.getByLabelText('Row set 1 reps').props.placeholder).toBe('8');
  expect(screen.getByLabelText('Row set 1 weight (kg)').props.placeholder).toBe('0');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Finish workout' }));
  await waitFor(() =>
    expect(mockApi.completeWorkout).toHaveBeenCalledWith(
      2,
      expect.objectContaining({
        exercises: [{ exerciseId: 1, sets: [expect.objectContaining({ reps: 8, weightKg: 0 })] }],
      }),
    ),
  );
});
test('add and remove sets, collapse, cancel, and preserve values after failed saving', async () => {
  await mount();
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 reps'), '8');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 weight (kg)'), '20');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Add set to Row' }));
  expect(screen.getByLabelText('Row set 2 reps').props.value).toBe('');
  expect(screen.getByLabelText('Row set 2 weight (kg)').props.value).toBe('');
  expect(screen.getByLabelText('Row set 2 weight (kg)').props.placeholder).toBe('');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Remove Row set 2' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Collapse Row' }));
  expect(screen.queryByLabelText('Row set 1 reps')).toBeNull();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Expand Row' }));
  mockApi.completeWorkout.mockRejectedValue(new Error('Offline'));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Finish workout' }));
  await screen.findByText('Could not connect. Check your connection and try again.');
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('8');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Cancel' }));
  await screen.findByText('Discard workout?');
  expect(mockReplace).not.toHaveBeenCalled();
});

test('records one set without requiring the remaining sets and allows editing a completed log', async () => {
  await mount();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Add set to Row' }));
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 reps'), '9');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 weight (kg)'), '25');
  const progress = {
    ...workout,
    log: {
      id: 3,
      date: workout.date,
      notes: null,
      completedAt: null,
      exercises: [
        { exercise, sets: [{ reps: 9, weightKg: 25, isWarmup: true, notes: null, order: 1 }] },
      ],
    },
  };
  mockApi.recordWorkoutSet.mockResolvedValue(progress);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Log Row set 1' }));
  await waitFor(() =>
    expect(mockApi.recordWorkoutSet).toHaveBeenCalledWith(2, {
      location: '',
      exerciseId: 1,
      order: 1,
      side: 'Both',
      reps: 9,
      weightKg: 25,
      isWarmup: true,
      notes: null,
    }),
  );
  expect(screen.getByLabelText('Row set 2 reps').props.value).toBe('');
  const completed = { ...progress, log: { ...progress.log, completedAt: '2026-10-01T12:00:00Z' } };
  mockApi.completeWorkout.mockResolvedValue(completed);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Finish workout' }));
  await screen.findByText('Completed');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Edit workout' }));
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('9');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 reps'), '11');
  mockApi.updateWorkout.mockResolvedValue(completed);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(mockApi.updateWorkout).toHaveBeenCalledWith(2, {
      location: null,
      notes: null,
      exercises: [
        {
          exerciseId: 1,
          sets: [{ reps: 11, weightKg: 25, isWarmup: true, notes: null, order: 1, side: 'Both' }],
        },
      ],
    }),
  );
});

test('restores an unfinished workout with saved sets and remaining planned slots', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue({
    ...workout,
    log: {
      id: 3,
      date: workout.date,
      notes: null,
      completedAt: null,
      exercises: [
        { exercise, sets: [{ reps: 6, weightKg: 30, isWarmup: false, notes: null, order: 2 }] },
      ],
    },
  });
  await mount();
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('');
  expect(screen.getByLabelText('Row set 2 reps').props.value).toBe('6');
});

test('splits a set, logs each side independently and finishes with the same set order', async () => {
  await mount();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Split Row set 1 left/right' }));
  expect(screen.queryByLabelText('Row set 1 reps')).toBeNull();
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 left reps'), '8');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 left weight (kg)'), '12');
  mockApi.recordWorkoutSet.mockResolvedValue(workout);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Log Row set 1 left' }));
  await waitFor(() =>
    expect(mockApi.recordWorkoutSet).toHaveBeenCalledWith(2, {
      location: '',
      exerciseId: 1,
      order: 1,
      side: 'Left',
      reps: 8,
      weightKg: 12,
      isWarmup: true,
      notes: null,
    }),
  );
  expect(screen.getByLabelText('Row set 1 right reps').props.value).toBe('');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 right reps'), '10');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 right weight (kg)'), '14');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Log Row set 1 right' }));
  await waitFor(() =>
    expect(mockApi.recordWorkoutSet).toHaveBeenLastCalledWith(2, {
      location: '',
      exerciseId: 1,
      order: 1,
      side: 'Right',
      reps: 10,
      weightKg: 14,
      isWarmup: true,
      notes: null,
    }),
  );
  mockApi.completeWorkout.mockResolvedValue(workout);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Finish workout' }));
  await waitFor(() =>
    expect(mockApi.completeWorkout).toHaveBeenCalledWith(2, {
      notes: null,
      location: null,
      exercises: [
        {
          exerciseId: 1,
          sets: [
            { order: 1, side: 'Left', reps: 8, weightKg: 12, isWarmup: true, notes: null },
            { order: 1, side: 'Right', reps: 10, weightKg: 14, isWarmup: true, notes: null },
          ],
        },
      ],
    }),
  );
});

test('restores a saved left side with a blank right side and uses matching-side history', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue({
    ...workout,
    previousSets: [
      {
        exerciseId: 1,
        order: 1,
        side: 'Left',
        date: '2026-09-28',
        reps: 8,
        weightKg: 12,
        isWarmup: false,
      },
      {
        exerciseId: 1,
        order: 1,
        side: 'Right',
        date: '2026-09-29',
        reps: 10,
        weightKg: 14,
        isWarmup: false,
      },
    ],
    log: {
      id: 3,
      date: workout.date,
      notes: null,
      completedAt: null,
      exercises: [
        {
          exercise,
          sets: [{ reps: 8, weightKg: 12, order: 1, side: 'Left', isWarmup: false, notes: null }],
        },
      ],
    },
  });
  await mount('Row set 1 left reps');
  expect(screen.getByLabelText('Row set 1 left reps').props.value).toBe('8');
  expect(screen.getByLabelText('Row set 1 right reps').props.value).toBe('');
  expect(screen.getByText(/Last logged \(2026-09-28\)/)).toBeTruthy();
  expect(screen.getByText(/Last logged \(2026-09-29\)/)).toBeTruthy();
  mockApi.removeWorkoutSet.mockResolvedValue(workout);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Remove Row set 1 left' }));
  await waitFor(() => expect(mockApi.removeWorkoutSet).toHaveBeenCalledWith(2, 1, 1, 'Left'));
  expect(screen.getByLabelText('Row set 1 right reps').props.value).toBe('');
});

test('opens split template sets with distinct planned targets and blank actual values', async () => {
  mockApi.getWorkoutLogging.mockResolvedValue({
    ...workout,
    template: {
      ...workout.template,
      exercises: [
        {
          exercise,
          sets: [
            {
              targetRepsMin: 8,
              targetRepsMax: null,
              targetWeightKg: 12,
              isWarmup: false,
              isAmrap: false,
              rightTarget: { targetRepsMin: 10, targetRepsMax: null, targetWeightKg: 14 },
            },
          ],
        },
      ],
    },
  });
  await mount('Row set 1 left reps');
  expect(screen.getByLabelText('Row set 1 left reps').props.value).toBe('');
  expect(screen.getByLabelText('Row set 1 right reps').props.value).toBe('');
  expect(screen.getAllByText(/Planned:/)).toHaveLength(2);
  expect(screen.getByText('8')).toBeTruthy();
  expect(screen.getByText('10')).toBeTruthy();
  expect(screen.getByText('12')).toBeTruthy();
  expect(screen.getByText('14')).toBeTruthy();
});

test('logging split control toggles back to normal and confirms before discarding different values', async () => {
  await mount();
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 reps'), '8');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 weight (kg)'), '12');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Split Row set 1 left/right' }));
  expect(screen.getAllByRole('button', { name: 'Unsplit Row set 1 left/right' })).toHaveLength(1);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Unsplit Row set 1 left/right' }));
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('8');
  expect(screen.queryByLabelText('Row set 1 right reps')).toBeNull();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Split Row set 1 left/right' }));
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 right reps'), '10');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Unsplit Row set 1 left/right' }));
  await screen.findByText('Use a normal set?');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Keep split set' }));
  expect(screen.getByLabelText('Row set 1 right reps').props.value).toBe('10');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Unsplit Row set 1 left/right' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Confirm normal set' }));
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('8');
  expect(screen.getByLabelText('Row set 1 weight (kg)').props.value).toBe('12');
  expect(mockApi.removeWorkoutSet).not.toHaveBeenCalled();
});
