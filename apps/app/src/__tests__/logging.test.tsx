import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import { renderAsync, screen, fireEventAsync, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkoutLogger } from '../features/logging/WorkoutLogger';

const exercise = { id: 1, name: 'Row', muscleGroup: 'Back', isCustom: false };
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
async function mount() {
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
  await screen.findByLabelText('Row set 1 reps');
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
        { exerciseId: 1, sets: [{ reps: 9, weightKg: 22.5, isWarmup: true, notes: null }] },
      ],
    }),
  );
  await screen.findByText('Completed');
  expect(screen.queryByLabelText('Row set 1 reps')).toBeNull();
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
        { exerciseId: 1, sets: [{ reps: 11, weightKg: 25, isWarmup: true, notes: null }] },
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
