import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import { renderAsync, screen, fireEventAsync, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkoutLogger } from '../features/logging/WorkoutLogger';

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
  listExercises: jest.fn<() => Promise<any[]>>(),
};
const mockReplace = jest.fn();
jest.mock('../lib/providers', () => ({
  useSession: () => ({ api: mockApi, status: 'authenticated' }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
beforeEach(() => {
  jest.resetAllMocks();
  mockApi.getWorkoutLogging.mockResolvedValue(workout);
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
test('requires actual reps and weight, saves entered sets, and shows completed results', async () => {
  await mount();
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Finish workout' }));
  expect(mockApi.completeWorkout).not.toHaveBeenCalled();
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
});
test('add and remove sets, collapse, cancel, and preserve values after failed saving', async () => {
  await mount();
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 reps'), '8');
  await fireEventAsync.changeText(screen.getByLabelText('Row set 1 weight (kg)'), '20');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Add set to Row' }));
  expect(screen.getByLabelText('Row set 2 reps').props.value).toBe('');
  expect(screen.getByLabelText('Row set 2 weight (kg)').props.value).toBe('20');
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
