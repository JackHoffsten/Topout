import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import {
  renderAsync,
  screen,
  fireEventAsync,
  waitFor,
  within,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { dateKey, monthDays } from '../features/calendar/calendar';

const mockApi = {
  listWorkoutSchedule: jest.fn<() => Promise<any[]>>(),
  listWorkoutTemplates: jest.fn<() => Promise<any[]>>(),
  listClimbLogs: jest.fn<() => Promise<any[]>>(),
  scheduleWorkout: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteScheduledWorkout: jest.fn<(...args: any[]) => Promise<void>>(),
  deleteWorkoutLog: jest.fn<(...args: any[]) => Promise<void>>(),
};
let mockDesktop = false;
let mockCalendarDate: string | undefined;
jest.mock('../ui/theme', () => ({
  ...jest.requireActual<typeof import('../ui/theme')>('../ui/theme'),
  useDesktop: () => mockDesktop,
}));
jest.mock('../lib/providers', () => ({
  useSession: () => ({ api: mockApi, status: 'authenticated' }),
}));
jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  useLocalSearchParams: () => ({ date: mockCalendarDate }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
  MaterialCommunityIcons: () => null,
  Ionicons: () => null,
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockDesktop = false;
  mockCalendarDate = undefined;
  mockApi.listWorkoutSchedule.mockResolvedValue([]);
  mockApi.listClimbLogs.mockResolvedValue([]);
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
      <CalendarScreen />
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

test('calendar restores the date returned from the logging screen', async () => {
  mockCalendarDate = '2028-02-29';
  await mount();
  const label = new Date('2028-02-29T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { selected: true }).props.accessibilityLabel).toContain(
      label,
    ),
  );
  expect(mockApi.listClimbLogs).toHaveBeenCalledWith('2028-01-31', '2028-03-05');
});

test.each([false, true])(
  'calendar uses matching square activity icons (desktop: %s)',
  async (desktop) => {
    mockDesktop = desktop;
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
    mockApi.listClimbLogs.mockResolvedValue([
      {
        id: 7,
        date: dateKey(new Date()),
        climbingType: 'Bouldering',
        gradeSystem: 'Font',
        grade: '7A',
        environment: 'Indoor',
        attempts: 3,
        outcome: 'Redpoint',
        wallAngle: null,
        styles: [],
        name: null,
        location: null,
      },
    ]);
    await mount();
    await screen.findByRole('link', { name: 'View climb 7A' });
    expect(screen.getByRole('button', { name: /1 climb logged/ })).toBeTruthy();
    expect(screen.getByTestId(`climbs-${dateKey(new Date())}`)).toBeTruthy();
    const badges = screen.getByTestId(`activity-badges-${dateKey(new Date())}`);
    const workout = within(badges).getByTestId(`plans-${dateKey(new Date())}`);
    const climb = within(badges).getByTestId(`climbs-${dateKey(new Date())}`);
    expect(within(workout).queryByTestId(`plans-${dateKey(new Date())}-count`)).toBeNull();
    expect(within(climb).queryByTestId(`climbs-${dateKey(new Date())}-count`)).toBeNull();
    expect(StyleSheet.flatten(badges.props.style)).toMatchObject({
      flexDirection: 'row',
      left: desktop ? 5 : 1,
      bottom: desktop ? 6 : 2,
    });
    const { backgroundColor: climbBackground, ...climbLayout } = StyleSheet.flatten(
      climb.props.style,
    );
    const { backgroundColor: workoutBackground, ...workoutLayout } = StyleSheet.flatten(
      workout.props.style,
    );
    expect(climbLayout).toEqual(workoutLayout);
    expect(workoutBackground).not.toBe(climbBackground);
    expect(StyleSheet.flatten(climb.props.style)).toMatchObject({
      width: desktop ? 24 : 15,
      height: desktop ? 24 : 15,
      aspectRatio: 1,
      minWidth: desktop ? 24 : 15,
      maxWidth: desktop ? 24 : 15,
      flexShrink: 0,
    });
    expect(StyleSheet.flatten(badges.props.style).right).toBeUndefined();
    const cellStyle = StyleSheet.flatten(
      screen.getByRole('button', { name: /1 climb logged/ }).props.style,
    );
    expect(cellStyle.aspectRatio).toBe(1);
    expect(cellStyle.minHeight).toBeUndefined();
    const headerStyle = StyleSheet.flatten(
      screen.getByTestId(`date-header-${dateKey(new Date())}`).props.style,
    );
    const badgeStyle = StyleSheet.flatten(badges.props.style);
    expect(headerStyle.left).toBe(badgeStyle.left);
    expect(headerStyle.right).toBe(badgeStyle.left);
    expect(headerStyle.top).toBe(badgeStyle.bottom);
    expect(
      StyleSheet.flatten(screen.getByTestId(`date-number-${dateKey(new Date())}`).props.style)
        .fontSize,
    ).toBe(Math.max(10, Math.round((desktop ? 24 : 15) * 0.68)));
    expect(screen.getByRole('button', { name: 'Add rest day' })).toBeDisabled();
  },
);

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
    expect(screen.getByTestId(`plans-${plan.date}`).props.accessibilityLabel).toBe(
      `Workout: ${status === 'InProgress' ? 'In progress' : 'Completed'}`,
    );
    expect(screen.queryByTestId(`logged-${plan.date}`)).toBeNull();
    await fireEventAsync.press(screen.getByRole('button', { name: 'Remove log for Push' }));
    await fireEventAsync.press(screen.getByRole('button', { name: 'Keep log' }));
    expect(mockApi.deleteWorkoutLog).not.toHaveBeenCalled();
    await fireEventAsync.press(screen.getByRole('button', { name: 'Remove log for Push' }));
    mockApi.listWorkoutSchedule.mockResolvedValue([{ ...plan, status: 'Planned' }]);
    await fireEventAsync.press(screen.getByRole('button', { name: 'Remove workout log' }));
    await waitFor(() => expect(mockApi.deleteWorkoutLog).toHaveBeenCalledWith(2));
    await screen.findByRole('button', { name: 'Remove Push' });
    expect(screen.queryByRole('button', { name: /workout logged/ })).toBeNull();
    expect(screen.getByTestId(`plans-${plan.date}`).props.accessibilityLabel).toBe(
      'Workout: Planned',
    );
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
