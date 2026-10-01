import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import { renderAsync, screen, fireEventAsync, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomeScreen } from '../features/home/HomeScreen';
import { dateKey, monthDays } from '../features/home/calendar';

const mockApi = {
  listWorkoutSchedule: jest.fn<() => Promise<any[]>>(),
  listWorkoutTemplates: jest.fn<() => Promise<any[]>>(),
  scheduleWorkout: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteScheduledWorkout: jest.fn<(...args: any[]) => Promise<void>>(),
  deleteWorkoutLog: jest.fn<(...args: any[]) => Promise<void>>(),
};
jest.mock('../lib/providers', () => ({
  useSession: () => ({ api: mockApi, status: 'authenticated' }),
}));
jest.mock('expo-router', () => ({ Link: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

beforeEach(() => {
  jest.resetAllMocks();
  mockApi.listWorkoutSchedule.mockResolvedValue([]);
  mockApi.listWorkoutTemplates.mockResolvedValue([{ id: 1, name: 'Push', exercises: [] }]);
  mockApi.scheduleWorkout.mockResolvedValue({});
  mockApi.deleteScheduledWorkout.mockResolvedValue(undefined);
  mockApi.deleteWorkoutLog.mockResolvedValue(undefined);
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
      <HomeScreen />
    </QueryClientProvider>,
  );
}

test('calendar covers leap February in complete Monday-first weeks using local dates', () => {
  const days = monthDays(new Date(2028, 1, 1));
  expect(days[0]!.getDay()).toBe(1);
  expect(days.at(-1)!.getDay()).toBe(0);
  expect(days.length % 7).toBe(0);
  expect(days.map(dateKey)).toContain('2028-02-29');
  expect(dateKey(new Date(2026, 9, 1))).toBe('2026-10-01');
});

test('searches templates, schedules today, and reloads saved plans', async () => {
  await mount();
  await screen.findByText('No workouts planned.');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Plan workout' }));
  await fireEventAsync.changeText(screen.getByLabelText('Search templates'), 'Push');
  mockApi.listWorkoutSchedule.mockResolvedValue([
    {
      id: 2,
      date: dateKey(new Date()),
      templateId: 1,
      templateName: 'Push',
      isRestDay: false,
      status: 'Planned',
    },
  ]);
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Schedule Push' }));
  await waitFor(() =>
    expect(mockApi.scheduleWorkout).toHaveBeenCalledWith({
      date: dateKey(new Date()),
      templateId: 1,
    }),
  );
  await screen.findByRole('button', { name: 'Remove Push' });
  expect(screen.getByRole('button', { name: 'Add rest day' })).toBeDisabled();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Remove Push' }));
  mockApi.listWorkoutSchedule.mockResolvedValue([]);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Remove plan' }));
  await waitFor(() => expect(mockApi.deleteScheduledWorkout).toHaveBeenCalledWith(2));
  await screen.findByText('No workouts planned.');
});

test('adds rest days and preserves scheduling errors', async () => {
  await mount();
  await screen.findByText('No workouts planned.');
  mockApi.scheduleWorkout.mockRejectedValue(new Error('Network failed'));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Add rest day' }));
  await waitFor(() =>
    expect(mockApi.scheduleWorkout).toHaveBeenCalledWith({
      date: dateKey(new Date()),
      templateId: null,
    }),
  );
  await screen.findByText('Could not connect. Check your connection and try again.');
});

test.each(['InProgress', 'Completed'])(
  'marks %s dates logged and removes only the log first',
  async (status) => {
    const plan = {
      id: 2,
      date: dateKey(new Date()),
      templateId: 1,
      templateName: 'Push',
      isRestDay: false,
      status,
    };
    mockApi.listWorkoutSchedule.mockResolvedValue([plan]);
    await mount();
    await screen.findByRole('button', { name: 'Remove log for Push' });
    expect(screen.queryByRole('button', { name: 'Remove Push' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add rest day' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /workout logged/ })).toBeTruthy();
    await fireEventAsync.press(screen.getByRole('button', { name: 'Remove log for Push' }));
    await fireEventAsync.press(screen.getByRole('button', { name: 'Keep log' }));
    expect(mockApi.deleteWorkoutLog).not.toHaveBeenCalled();
    await fireEventAsync.press(screen.getByRole('button', { name: 'Remove log for Push' }));
    mockApi.listWorkoutSchedule.mockResolvedValue([{ ...plan, status: 'Planned' }]);
    await fireEventAsync.press(screen.getByRole('button', { name: 'Remove workout log' }));
    await waitFor(() => expect(mockApi.deleteWorkoutLog).toHaveBeenCalledWith(2));
    await screen.findByRole('button', { name: 'Remove Push' });
    expect(screen.queryByRole('button', { name: /workout logged/ })).toBeNull();
    expect(mockApi.deleteScheduledWorkout).not.toHaveBeenCalled();
  },
);

test('rest-day confirmation describes removing the rest marker, not a template', async () => {
  mockApi.listWorkoutSchedule.mockResolvedValue([
    {
      id: 3,
      date: dateKey(new Date()),
      templateId: null,
      templateName: null,
      isRestDay: true,
      status: 'Planned',
    },
  ]);
  await mount();
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Remove rest day' }));
  expect(screen.getByText('Remove rest day?')).toBeTruthy();
  expect(screen.getByText('This date will no longer be marked as a rest day.')).toBeTruthy();
  expect(screen.queryByText('This removes the calendar entry. Your template is kept.')).toBeNull();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Keep rest day' }));
  expect(mockApi.deleteScheduledWorkout).not.toHaveBeenCalled();
});
