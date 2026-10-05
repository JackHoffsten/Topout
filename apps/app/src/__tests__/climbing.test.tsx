import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import { renderAsync, screen, fireEventAsync, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, type ClimbLog } from '@topout/shared';
import { ClimbingDay } from '../features/climbing/ClimbingDay';
import { ClimbHistory } from '../features/climbing/ClimbHistory';
import { ClimbCreateScreen } from '../features/climbing/ClimbCreateScreen';

const log: ClimbLog = {
  id: 7,
  date: '2026-10-03',
  climbingType: 'Bouldering',
  gradeSystem: 'Font',
  grade: '7A',
  environment: 'Board',
  attempts: 3,
  outcome: 'Redpoint',
  wallAngle: 'Overhang',
  styles: ['Crimpy', 'Slopy'],
  name: 'Problem',
  location: 'Gym',
};
const mockApi = {
  createClimbLog: jest.fn<(...args: any[]) => Promise<any>>(),
  updateClimbLog: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteClimbLog: jest.fn<(...args: any[]) => Promise<void>>(),
  listClimbHistory: jest.fn<(...args: any[]) => Promise<any>>(),
  getClimbLog: jest.fn<(...args: any[]) => Promise<any>>(),
  getClimbPhoto: jest.fn<(...args: any[]) => Promise<any>>(),
  saveClimbPhoto: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteClimbPhoto: jest.fn<(...args: any[]) => Promise<void>>(),
};
const mockPickPhoto = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../features/climbing/pickClimbPhoto', () => ({
  pickClimbPhoto: (...args: any[]) => mockPickPhoto(...args),
}));
let mockClimb: string | undefined;
let mockDate: string | undefined;
let mockReturnTo: string | undefined;
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  Link: ({ children, asChild, href }: any) =>
    asChild ? require('react').cloneElement(children, { onPress: () => mockPush(href) }) : children,
  useLocalSearchParams: () => ({ climb: mockClimb, date: mockDate, returnTo: mockReturnTo }),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));
jest.mock('../lib/providers', () => ({ useSession: () => ({ api: mockApi }) }));
const mockRetry = jest.fn();

async function mount(props: Partial<React.ComponentProps<typeof ClimbingDay>> = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await renderAsync(
    <QueryClientProvider client={client}>
      <ClimbingDay
        date={log.date}
        logs={[]}
        loading={false}
        onRetry={mockRetry}
        restDay={false}
        {...props}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  mockClimb = undefined;
  mockDate = log.date;
  mockReturnTo = undefined;
  mockApi.createClimbLog.mockResolvedValue(log);
  mockApi.updateClimbLog.mockResolvedValue(log);
  mockApi.deleteClimbLog.mockResolvedValue(undefined);
  mockApi.listClimbHistory.mockResolvedValue({ items: [log], nextPage: null, totalCount: 1 });
  mockApi.getClimbLog.mockResolvedValue(log);
  mockApi.getClimbPhoto.mockResolvedValue(null);
  mockApi.saveClimbPhoto.mockResolvedValue({ base64: 'photo', width: 800, height: 600 });
  mockPickPhoto.mockResolvedValue({ base64: 'photo', width: 800, height: 600 });
});

async function mountHistory() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await renderAsync(
    <QueryClientProvider client={client}>
      <ClimbHistory />
    </QueryClientProvider>,
  );
}

async function mountCreate() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  await renderAsync(
    <QueryClientProvider client={client}>
      <ClimbCreateScreen />
    </QueryClientProvider>,
  );
}

test('calendar logging opens a dedicated screen with the selected date', async () => {
  await mount();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Log climb' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/climbs/new', params: { date: log.date } });
  expect(screen.queryByTestId('climb-editor')).toBeNull();
});

test('create screen rejects invalid dates', async () => {
  mockDate = '2026-02-30';
  await mountCreate();
  expect(screen.getByText('Choose a valid calendar date.')).toBeTruthy();
  expect(screen.queryByTestId('climb-editor')).toBeNull();
});

test('an unselected grade never renders raw text inside the editor View', async () => {
  await mountCreate();
  expect(screen.getByTestId('climb-editor').props.children).not.toContain('');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7A' }));
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Grade system: V scale' }));
  expect(screen.getByTestId('climb-editor').props.children).not.toContain('');
});

test('create screen can cancel back to history without saving', async () => {
  mockReturnTo = 'climbs';
  await mountCreate();
  expect(screen.getByLabelText('Date').props.value).toBe(log.date);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(mockReplace).toHaveBeenCalledWith('/climbs');
  expect(mockApi.createClimbLog).not.toHaveBeenCalled();
});

test.each([
  ['Attempted', 'Not sent'],
  ['Redpoint', 'Sent'],
  ['Flash', 'Flashed'],
  ['Onsight', 'Onsighted'],
])('calendar summary is compact for %s', async (outcome, label) => {
  await mount({ logs: [{ ...log, outcome: outcome as ClimbLog['outcome'] }] });
  expect(screen.getByText(`3 attempts · ${label}`)).toBeTruthy();
  expect(screen.queryByText('Gym')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Edit climb Problem' })).toBeNull();
  await fireEventAsync.press(screen.getByRole('link', { name: 'View climb Problem' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/climbs', params: { climb: 7 } });
});

test('history automatically loads an older selected climb in its sorted position without duplicating it', async () => {
  mockClimb = '7';
  mockApi.listClimbHistory.mockImplementation(async (page) =>
    page === 1
      ? {
          items: [{ ...log, id: 8, name: 'Newer' }],
          nextPage: 2,
          totalCount: 120,
        }
      : { items: [log], nextPage: null, totalCount: 120 },
  );
  await mountHistory();
  await screen.findByRole('button', { name: 'Edit climb Problem' });
  expect(mockApi.getClimbLog).toHaveBeenCalledWith(7);
  expect(screen.getByText('TOTAL CLIMBS')).toBeTruthy();
  await screen.findByText('120');
  expect(screen.getByText('Gym')).toBeTruthy();
  await waitFor(() => expect(mockApi.listClimbHistory).toHaveBeenCalledWith(2));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Load more climbs' })).toBeNull(),
  );
  expect(screen.getAllByRole('button', { name: 'Collapse climb Problem' })).toHaveLength(1);
  expect(
    screen
      .getAllByRole('button', { name: /^(Expand|Collapse) climb / })
      .map((button) => button.props.accessibilityLabel),
  ).toEqual(['Expand climb Newer', 'Collapse climb Problem']);
});

test('a selected climb remains available when history cannot load', async () => {
  mockClimb = '7';
  mockApi.listClimbHistory.mockRejectedValue(new Error('offline'));
  await mountHistory();
  await screen.findByRole('button', { name: 'Edit climb Problem' });
  expect(screen.getByRole('button', { name: 'Retry climbs' })).toBeTruthy();
  expect(screen.getByText('Gym')).toBeTruthy();
});

test('history applies sorting and filters to API queries and validates date ranges', async () => {
  await mountHistory();
  await screen.findByRole('button', { name: 'Expand climb Problem' });
  await fireEventAsync.press(screen.getByRole('button', { name: 'Hardest' }));
  await waitFor(() =>
    expect(mockApi.listClimbHistory).toHaveBeenCalledWith(1, { sort: 'grade-desc' }),
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter Environment: Outdoor' }));
  await fireEventAsync.changeText(screen.getByLabelText('Search climbs'), 'rock');
  await waitFor(() =>
    expect(mockApi.listClimbHistory).toHaveBeenCalledWith(1, {
      sort: 'grade-desc',
      search: 'rock',
    }),
  );
  await fireEventAsync.changeText(screen.getByLabelText('From date'), '2026-02-30');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByText('Choose valid dates with the end on or after the start.')).toBeTruthy();
  await fireEventAsync.changeText(screen.getByLabelText('From date'), '2026-02-01');
  mockApi.listClimbHistory.mockResolvedValue({ items: [], nextPage: null });
  await fireEventAsync.press(screen.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText('No climbs match these filters.');
  expect(mockApi.listClimbHistory).toHaveBeenCalledWith(1, {
    sort: 'grade-desc',
    environment: ['Outdoor'],
    search: 'rock',
    from: '2026-02-01',
  });
});

test('search is visible outside filters and remains when filters are reset', async () => {
  await mountHistory();
  await screen.findByRole('button', { name: 'Expand climb Problem' });
  expect(screen.queryByLabelText('From date')).toBeNull();
  await fireEventAsync.changeText(screen.getByLabelText('Search climbs'), '  rock  ');
  await waitFor(() => expect(mockApi.listClimbHistory).toHaveBeenCalledWith(1, { search: 'rock' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter Environment: Outdoor' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() =>
    expect(mockApi.listClimbHistory).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ search: 'rock', environment: ['Outdoor'] }),
    ),
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByLabelText('Search climbs').props.value).toBe('  rock  ');
  await waitFor(() =>
    expect(mockApi.listClimbHistory).toHaveBeenLastCalledWith(1, {
      sort: undefined,
      search: 'rock',
    }),
  );
  await fireEventAsync.changeText(screen.getByLabelText('Search climbs'), '');
  await waitFor(() =>
    expect(mockApi.listClimbHistory).toHaveBeenLastCalledWith(1, {
      sort: undefined,
      search: undefined,
    }),
  );
});

test('missing selected climbs and history failures show clear errors', async () => {
  mockClimb = '7';
  mockApi.getClimbLog.mockRejectedValue(new ApiError(404, 'Climbing log not found.'));
  mockApi.listClimbHistory.mockRejectedValue(new Error('offline'));
  await mountHistory();
  await screen.findByText('Climbing log not found.');
  expect(screen.getByRole('button', { name: 'Retry climbs' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Retry selected climb' })).toBeTruthy();
});

test('grade filtering uses the selected scale and resets on scale changes', async () => {
  await mountHistory();
  await screen.findByRole('button', { name: 'Expand climb Problem' });
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.getByRole('button', { name: 'Select grade filter' })).toBeDisabled();
  await fireEventAsync.press(
    screen.getByRole('button', { name: 'Filter Grade system: Fontainebleau' }),
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Select grade filter' }));
  await fireEventAsync.changeText(screen.getByLabelText('Search filter grades'), '7A');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter grade: 7A' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() =>
    expect(mockApi.listClimbHistory).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ gradeSystem: ['Font'], grade: ['7A'] }),
    ),
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter Grade system: V scale' }));
  expect(screen.getByRole('button', { name: 'Select grade filter' })).toHaveTextContent(
    'All grades',
  );
});

test('climb categories and grades support multiple selections', async () => {
  await mountHistory();
  await screen.findByRole('button', { name: 'Expand climb Problem' });
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter Environment: Indoor' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter Environment: Board' }));
  await fireEventAsync.press(
    screen.getByRole('button', { name: 'Filter Grade system: Fontainebleau' }),
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Select grade filter' }));
  await fireEventAsync.changeText(screen.getByLabelText('Search filter grades'), '7A');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter grade: 7A' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter grade: 7A+' }));
  expect(
    screen.getByRole('button', { name: 'Filter grade: 7A' }).props.accessibilityState.selected,
  ).toBe(true);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() =>
    expect(mockApi.listClimbHistory).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        environment: ['Indoor', 'Board'],
        gradeSystem: ['Font'],
        grade: ['7A', '7A+'],
      }),
    ),
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter Environment: Indoor' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filter Environment: All' }));
  expect(
    screen.getByRole('button', { name: 'Filter Environment: Board' }).props.accessibilityState
      .selected,
  ).toBe(false);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Close' }));
});

test('empty, loading, retry, and rest-day states are explicit', async () => {
  await mount({ restDay: true });
  expect(screen.getByText('No climbs logged.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log climb' })).toBeDisabled();
  expect(screen.getByText('Remove the rest day to log a climb.')).toBeTruthy();
});
test('loading shows progress without an editor', async () => {
  await mount({ loading: true });
  expect(screen.getByText('Loading climbs…')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Log climb' })).toBeNull();
});
test('failed loading offers retry', async () => {
  await mount({ error: new Error('offline') });
  await fireEventAsync.press(screen.getByRole('button', { name: 'Retry climbs' }));
  expect(mockRetry).toHaveBeenCalled();
});

test('creates a graded climb with multiple styles and optional details', async () => {
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  expect(mockApi.createClimbLog).not.toHaveBeenCalled();
  await screen.findByText('Choose a valid grade.');
  await fireEventAsync.changeText(screen.getByLabelText('Search grades'), '7A');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7A' }));
  expect(screen.getByLabelText('Search grades')).toBeTruthy();
  expect(screen.getByText('Grade: 7A')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Choose grade' })).toBeNull();
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Environment: Board' }));
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Wall angle: Overhang' }));
  await fireEventAsync.press(screen.getByRole('checkbox', { name: 'Crimpy' }));
  await fireEventAsync.press(screen.getByRole('checkbox', { name: 'Slopy' }));
  await fireEventAsync.changeText(screen.getByLabelText('Attempts this day'), '3');
  await fireEventAsync.changeText(screen.getByLabelText('Route name (optional)'), ' Problem ');
  await fireEventAsync.changeText(screen.getByLabelText('Location (optional)'), ' Gym ');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await waitFor(() =>
    expect(mockApi.createClimbLog).toHaveBeenCalledWith({ ...log, id: undefined }),
  );
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/calendar', params: { date: log.date } }),
  );
});

test('loads a photo only when expanded and allows removing it when editing', async () => {
  mockApi.getClimbPhoto.mockResolvedValue({ base64: 'photo', width: 800, height: 600 });
  await mountHistory();
  expect(mockApi.getClimbPhoto).not.toHaveBeenCalled();
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Expand climb Problem' }));
  await screen.findByLabelText('Climb photo');
  expect(mockApi.getClimbPhoto).toHaveBeenCalledWith(7);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Edit climb Problem' }));
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Remove photo' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(mockApi.deleteClimbPhoto).toHaveBeenCalledWith(7));
});

test('photo upload failure retries the saved climb instead of creating another', async () => {
  mockApi.saveClimbPhoto.mockRejectedValueOnce(new ApiError(400, 'Photo rejected'));
  await mountCreate();
  await fireEventAsync.changeText(screen.getByLabelText('Search grades'), '7A');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7A' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Upload photo' }));
  await screen.findByLabelText('Climb photo');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await screen.findByText('The climb was saved, but the photo change was not. Try saving again.');
  expect(mockReplace).not.toHaveBeenCalled();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await waitFor(() => expect(mockApi.saveClimbPhoto).toHaveBeenCalledTimes(2));
  expect(mockApi.createClimbLog).toHaveBeenCalledTimes(1);
  expect(mockApi.updateClimbLog).toHaveBeenCalledWith(7, expect.anything());
});

test('take photo opens the camera and previews the result', async () => {
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Take photo' }));
  expect(mockPickPhoto).toHaveBeenCalledWith('camera');
  await screen.findByLabelText('Climb photo');
  expect(mockApi.saveClimbPhoto).not.toHaveBeenCalled();
});

test('changing climbing type resets incompatible grades and board environment', async () => {
  await mountHistory();
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Expand climb Problem' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Edit climb Problem' }));
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Climbing type: Sport' }));
  expect(screen.queryByRole('radio', { name: 'Environment: Board' })).toBeNull();
  expect(screen.getByRole('radio', { name: 'Grade system: French' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Environment: Indoor' })).toBeChecked();
  await fireEventAsync.changeText(screen.getByLabelText('Search grades'), '7a');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7a' }));
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Outcome: Onsight' }));
  expect(screen.getByLabelText('Attempts this day').props.value).toBe('1');
  await fireEventAsync.changeText(screen.getByLabelText('Attempts this day'), '2');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Flash and onsight require one attempt.');
  expect(mockApi.updateClimbLog).not.toHaveBeenCalled();
  await fireEventAsync.changeText(screen.getByLabelText('Attempts this day'), '1');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(mockApi.updateClimbLog).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        climbingType: 'Sport',
        gradeSystem: 'French',
        grade: '7a',
        environment: 'Indoor',
        outcome: 'Onsight',
        attempts: 1,
      }),
    ),
  );
  await screen.findByRole('button', { name: 'Edit climb Problem' });
});

test('unsent attempts can be saved, errors keep the draft, and cancel does not save', async () => {
  mockApi.createClimbLog.mockRejectedValue(
    new ApiError(409, 'Remove the rest day before logging a climb.'),
  );
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7B' }));
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Outcome: Attempted' }));
  await fireEventAsync.changeText(screen.getByLabelText('Attempts this day'), '4');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await screen.findByText('Remove the rest day before logging a climb.');
  expect(screen.getByLabelText('Attempts this day').props.value).toBe('4');
  expect(mockApi.createClimbLog).toHaveBeenCalledWith(
    expect.objectContaining({ grade: '7B', outcome: 'Attempted', attempts: 4 }),
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/calendar', params: { date: log.date } });
  expect(mockApi.createClimbLog).toHaveBeenCalledTimes(1);
});

test('shows recorded details and confirms deletion without losing errors', async () => {
  mockApi.deleteClimbLog.mockRejectedValueOnce(new ApiError(404, 'Climbing log not found.'));
  await mountHistory();
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Expand climb Problem' }));
  expect(screen.getByText('Wall angle: Overhang')).toBeTruthy();
  expect(screen.getByText('Crimpy · Slopy')).toBeTruthy();
  expect(screen.getByText('Gym')).toBeTruthy();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Delete climb Problem' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Keep climb' }));
  expect(mockApi.deleteClimbLog).not.toHaveBeenCalled();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Delete climb Problem' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Delete climb' }));
  await screen.findByText('Climbing log not found.');
  mockApi.listClimbHistory.mockResolvedValue({ items: [], nextPage: null });
  await fireEventAsync.press(screen.getByRole('button', { name: 'Delete climb' }));
  await waitFor(() => expect(mockApi.deleteClimbLog).toHaveBeenCalledTimes(2));
  await screen.findByText('No climbs logged.');
});
