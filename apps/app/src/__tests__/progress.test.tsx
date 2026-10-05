import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import { renderAsync, screen, fireEventAsync, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, type ProgressData } from '@topout/shared';
import { ProgressScreen } from '../features/progress/ProgressScreen';
import { dateKey } from '../features/calendar/calendar';

const today = dateKey(new Date());
const mockApi = { getProgress: jest.fn<(...args: any[]) => Promise<any>>() };
jest.mock('../lib/providers', () => ({ useSession: () => ({ api: mockApi }) }));
const data: ProgressData = {
  exercises: [
    {
      date: today,
      exerciseId: 1,
      name: 'Curl',
      side: 'Left',
      sets: 2,
      reps: 16,
      maxWeightKg: 12,
      volumeKg: 192,
    },
    {
      date: today,
      exerciseId: 1,
      name: 'Curl',
      side: 'Right',
      sets: 1,
      reps: 8,
      maxWeightKg: 14,
      volumeKg: 112,
    },
  ],
  climbing: [
    {
      date: today,
      climbingType: 'Bouldering',
      gradeSystem: 'Font',
      grade: '7A',
      environment: 'Indoor',
      climbs: 2,
      sends: 1,
      flashes: 1,
      attempts: 4,
    },
    {
      date: today,
      climbingType: 'Bouldering',
      gradeSystem: 'Font',
      grade: '9C',
      environment: 'Board',
      climbs: 1,
      sends: 0,
      flashes: 0,
      attempts: 5,
    },
  ],
};
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await renderAsync(
    <QueryClientProvider client={client}>
      <ProgressScreen />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mockApi.getProgress.mockReset();
  mockApi.getProgress.mockResolvedValue(data);
});

test('overview renders activity and lifetime weight records, with values available without a graph gesture', async () => {
  await mount();
  await screen.findByText('Weekly activity');
  expect(mockApi.getProgress).toHaveBeenCalledWith(undefined, today);
  expect(screen.getByText(`Curl · Left · 12 kg · ${today}`)).toBeTruthy();
  expect(screen.getByText('Bouldering · Fontainebleau · 7A')).toBeTruthy();
  await fireEventAsync.press(screen.getAllByRole('button', { name: 'Show values' })[0]);
  expect(screen.getByText('Hide values')).toBeTruthy();
});
test('exercise selection, metric changes, and side filters keep the left and right separate', async () => {
  await mount();
  await screen.findByText('Weekly activity');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Exercises' }));
  await fireEventAsync(screen.getByLabelText('Search exercises'), 'focus', { nativeEvent: {} });
  await fireEventAsync.changeText(screen.getByLabelText('Search exercises'), 'curl');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Select progress exercise Curl' }));
  expect(screen.queryByLabelText('Search exercises')).toBeNull();
  expect(screen.getByRole('button', { name: 'Heaviest weight' }).props.accessibilityState.selected).toBe(
    true,
  );
  expect(
    screen.getByRole('button', { name: `Curl · Heaviest weight, Left, ${today}, 12 kg` }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: `Curl · Heaviest weight, Left, ${today}, 12 kg` }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: `Curl · Heaviest weight, Right, ${today}, 14 kg` }),
  ).toBeTruthy();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Left' }));
  expect(
    screen.queryByRole('button', { name: `Curl · Heaviest weight, Right, ${today}, 14 kg` }),
  ).toBeNull();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Volume' }));
  expect(
    screen.getByRole('button', { name: `Curl · Volume, Left, ${today}, 192 kg` }),
  ).toBeTruthy();
});
test('climbing filters exclude unsent harder grades and can select a different type or system', async () => {
  await mount();
  await screen.findByText('Weekly activity');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Climbing' }));
  expect(
    screen.getByRole('button', { name: `Hardest grade sent, Fontainebleau, ${today}, 7A` }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: new RegExp('Hardest grade sent.*9C') })).toBeNull();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Board' }));
  expect(screen.getByText('No sends for this selection.')).toBeTruthy();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Sport' }));
  expect(screen.getByRole('button', { name: 'French' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Board' })).toBeNull();
});
test('empty history and loading state are explicit', async () => {
  let resolve!: (data: ProgressData) => void;
  mockApi.getProgress.mockImplementation(
    () =>
      new Promise<ProgressData>((r) => {
        resolve = r;
      }),
  );
  await mount();
  expect(screen.getByText('Loading…')).toBeTruthy();
  resolve({ exercises: [], climbing: [] });
  await screen.findByText('No logged activity in this period.');
  await fireEventAsync.press(screen.getByRole('button', { name: 'All time' }));
  expect(screen.getByText('No new weight records in this period.')).toBeTruthy();
});
test('failed requests show an error and can be retried', async () => {
  mockApi.getProgress.mockRejectedValueOnce(new ApiError(500, 'Progress unavailable.'));
  await mount();
  await screen.findByText('Progress unavailable.');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByText('Weekly activity')).toBeTruthy());
});
