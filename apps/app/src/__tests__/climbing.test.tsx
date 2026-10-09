import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
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
  listClimbProjects: jest.fn<(...args: any[]) => Promise<any>>(),
  getProjectAttempts: jest.fn<(...args: any[]) => Promise<any>>(),
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
  mockApi.listClimbProjects.mockResolvedValue([]);
  mockApi.getProjectAttempts.mockResolvedValue([]);
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

test('unknown project attempts omit the total suffix', async () => {
  await mount({
    logs: [
      {
        ...log,
        projectId: 4,
        attempts: null,
        attemptsMode: 'Unknown',
        totalAttempts: null,
        totalAttemptsIsLowerBound: true,
      },
    ],
  });
  expect(screen.getByText('Attempts unknown · Sent')).toBeTruthy();
  expect(screen.queryByText('Attempts unknown total · Sent')).toBeNull();
});

test('history shows one spinner while the list and selected climb load together', async () => {
  mockClimb = String(log.id);
  let resolveHistory!: (value: any) => void;
  mockApi.listClimbHistory.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveHistory = resolve;
      }),
  );
  mockApi.getClimbLog.mockImplementation(() => new Promise(() => {}));
  await mountHistory();
  expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
  expect(screen.getByText('Loading climbs…')).toBeTruthy();
  expect(screen.queryByText('Loading selected climb…')).toBeNull();
  await act(async () => resolveHistory({ items: [], nextPage: null, totalCount: 0 }));
  await waitFor(() => expect(screen.getByText('Loading selected climb…')).toBeTruthy());
  expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
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

test('grade selection orders two distinct grades and prevents a third selection', async () => {
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 6C' }));
  expect(
    screen.getByRole('button', { name: 'Choose grade 6A+' }).props.accessibilityState.disabled,
  ).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Choose grade 6A' }).props.accessibilityState.disabled,
  ).toBe(true);
  expect(
    screen.getByRole('button', { name: 'Choose grade 7A+' }).props.accessibilityState.disabled,
  ).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Choose grade 7B' }).props.accessibilityState.disabled,
  ).toBe(true);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 6B' }));
  expect(screen.getByRole('header', { name: '6B - 6C' })).toBeTruthy();
  expect(
    screen.getByRole('button', { name: 'Choose grade 7A' }).props.accessibilityState.disabled,
  ).toBe(true);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 6B' }));
  expect(screen.getByRole('header', { name: '6C' })).toBeTruthy();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 6C' }));
  expect(screen.getByText('No grade selected')).toBeTruthy();
});

test('saves a grade range', async () => {
  mockApi.createClimbLog.mockResolvedValue({ ...log, grade: '6B-6C' });
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 6C' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 6B' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await waitFor(() =>
    expect(mockApi.createClimbLog).toHaveBeenCalledWith(
      expect.objectContaining({ grade: '6B-6C' }),
    ),
  );
});

test('restores both endpoints when editing a grade range', async () => {
  mockApi.listClimbHistory.mockResolvedValue({
    items: [{ ...log, grade: '6B-6C' }],
    nextPage: null,
  });
  await mountHistory();
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Expand climb Problem' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Edit climb Problem' }));
  expect(screen.getByRole('header', { name: '6B - 6C' })).toBeTruthy();
  for (const grade of ['6B', '6C'])
    expect(
      screen.getByRole('button', { name: `Choose grade ${grade}` }).props.accessibilityState
        .selected,
    ).toBe(true);
});

test('creates a graded climb with multiple styles and optional details', async () => {
  await mountCreate();
  expect(screen.getByText('No grade selected')).toBeTruthy();
  expect(screen.getByLabelText('Search grades').props.placeholder).toBe('Search grades');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  expect(mockApi.createClimbLog).not.toHaveBeenCalled();
  await screen.findByText('Choose a valid grade.');
  await fireEventAsync.changeText(screen.getByLabelText('Search grades'), '7A');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7A' }));
  expect(screen.getByLabelText('Search grades')).toBeTruthy();
  expect(screen.getByRole('header', { name: '7A' })).toBeTruthy();
  expect(screen.queryByText('No grade selected')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Choose grade 7A' }).props.accessibilityState.selected,
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Choose grade' })).toBeNull();
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Environment: Board' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Wall angle: Slab' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Wall angle: Overhang' }));
  expect(
    screen.getByRole('button', { name: 'Wall angle: Slab' }).props.accessibilityState.selected,
  ).toBe(true);
  expect(
    screen.getByRole('button', { name: 'Wall angle: Overhang' }).props.accessibilityState.selected,
  ).toBe(true);
  expect(
    StyleSheet.flatten(screen.getByRole('button', { name: 'Wall angle: Overhang' }).props.style)
      .backgroundColor,
  ).not.toBe(
    StyleSheet.flatten(screen.getByRole('button', { name: 'Wall angle: Roof' }).props.style)
      .backgroundColor,
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Wall angle: Slab' }));
  await fireEventAsync.press(screen.getByRole('checkbox', { name: 'Crimpy' }));
  await fireEventAsync.press(screen.getByRole('checkbox', { name: 'Slopy' }));
  await fireEventAsync.changeText(screen.getByLabelText('Attempts this day'), '3');
  await fireEventAsync.changeText(screen.getByLabelText('Route name (optional)'), ' Problem ');
  await fireEventAsync.changeText(screen.getByLabelText('Location (optional)'), ' Gym ');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await waitFor(() =>
    expect(mockApi.createClimbLog).toHaveBeenCalledWith({
      ...log,
      id: undefined,
      attemptsMode: 'Exact',
      wallAngles: ['Overhang'],
    }),
  );
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/calendar', params: { date: log.date } }),
  );
});

test('selects an unfinished project and pre-fills a separate attempt log', async () => {
  mockApi.listClimbProjects.mockResolvedValue([
    { id: 4, climb: { ...log, projectId: 4, outcome: 'Attempted' } },
  ]);
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose unfinished project' }));
  await fireEventAsync.changeText(await screen.findByLabelText('Search projects'), 'gym');
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Choose project Problem' }));
  expect(screen.queryByLabelText('Search projects')).toBeNull();
  expect(screen.getByText('Selected project')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Problem' })).toBeTruthy();
  expect(screen.getByText('Gym')).toBeTruthy();
  expect(screen.getByText('Change project')).toBeTruthy();
  expect(screen.getByRole('header', { name: '7A' })).toBeTruthy();
  expect(screen.getByLabelText('Attempts this day').props.value).toBe('1');
  expect(
    screen.getByRole('button', { name: 'Mark climb as project' }).props.accessibilityState.selected,
  ).toBe(true);
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await waitFor(() =>
    expect(mockApi.createClimbLog).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 4, isProject: true, outcome: 'Attempted', attempts: 1 }),
    ),
  );
});

test('marks a new climb as a project and explains automatic completion', async () => {
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Mark climb as project' }));
  expect(screen.getByText('Saving a send completes this project.')).toBeTruthy();
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Outcome: Attempted' }));
  expect(screen.getByText('This project stays unfinished until you log a send.')).toBeTruthy();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7A' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await waitFor(() =>
    expect(mockApi.createClimbLog).toHaveBeenCalledWith(
      expect.objectContaining({ isProject: true, projectId: null, outcome: 'Attempted' }),
    ),
  );
});

test('project picker has empty and retry states and history has project filters', async () => {
  mockApi.listClimbProjects
    .mockRejectedValueOnce(new ApiError(500, 'Projects unavailable.'))
    .mockResolvedValue([]);
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose unfinished project' }));
  await screen.findByText('Projects unavailable.');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Retry projects' }));
  await screen.findByText('No unfinished projects.');
  await fireEventAsync.press(screen.getByRole('button', { name: 'Close projects' }));
  expect(screen.queryByLabelText('Search projects')).toBeNull();
});

test('applies unfinished project filters to history queries', async () => {
  await mountHistory();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEventAsync.press(
    screen.getByRole('button', { name: 'Filter projects: Unfinished projects' }),
  );
  await fireEventAsync.press(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() =>
    expect(mockApi.listClimbHistory).toHaveBeenLastCalledWith(
      1,
      expect.objectContaining({ project: 'unfinished' }),
    ),
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
  expect(screen.queryByLabelText('Attempts this day')).toBeNull();
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

test.each(['Flash', 'Onsight', 'Day flash'])(
  'hides attempts and saves one for %s',
  async (label) => {
    await mountCreate();
    await fireEventAsync.changeText(screen.getByLabelText('Attempts this day'), '5');
    await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7A' }));
    await fireEventAsync.press(screen.getByRole('radio', { name: `Outcome: ${label}` }));
    const descriptions = {
      Flash: 'Sent on the first attempt with prior information.',
      Onsight: 'Sent on the first attempt without prior information.',
      'Day flash': 'Sent on the first attempt of the day, after attempts on an earlier day.',
    };
    for (const [outcome, description] of Object.entries(descriptions)) {
      if (outcome === label) expect(screen.getByText(description)).toBeTruthy();
      else expect(screen.queryByText(description)).toBeNull();
    }
    expect(screen.queryByLabelText('Attempts this day')).toBeNull();
    await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
    await waitFor(() =>
      expect(mockApi.createClimbLog).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: 1,
          outcome: label === 'Day flash' ? 'DayFlash' : label,
        }),
      ),
    );
  },
);

test('a single-attempt send automatically becomes a flash', async () => {
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7A' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await waitFor(() =>
    expect(mockApi.createClimbLog).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'Flash', attempts: 1 }),
    ),
  );
});

test.each(['Unknown', 'More than'])(
  'saves %s attempts without automatically flashing',
  async (mode) => {
    await mountCreate();
    await fireEventAsync.press(screen.getByRole('button', { name: 'Choose grade 7A' }));
    await fireEventAsync.press(screen.getByRole('radio', { name: `Attempt count: ${mode}` }));
    if (mode === 'Unknown') expect(screen.queryByLabelText('Attempts this day')).toBeNull();
    await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
    await waitFor(() =>
      expect(mockApi.createClimbLog).toHaveBeenCalledWith(
        expect.objectContaining({
          attempts: mode === 'Unknown' ? null : 1,
          attemptsMode: mode === 'Unknown' ? 'Unknown' : 'MoreThan',
          outcome: 'Redpoint',
        }),
      ),
    );
  },
);

test('earlier project attempts disable flash and onsight and automatically classify a new-day send', async () => {
  mockApi.listClimbProjects.mockResolvedValue([
    { id: 4, climb: { ...log, projectId: 4, outcome: 'Attempted' } },
  ]);
  mockApi.getProjectAttempts.mockResolvedValue([{ id: 2, date: '2026-10-02' }]);
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose unfinished project' }));
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Choose project Problem' }));
  await screen.findByText('Flash and onsight are unavailable after previous project attempts.');
  for (const outcome of ['Flash', 'Onsight'])
    expect(
      screen.getByRole('radio', { name: `Outcome: ${outcome}` }).props.accessibilityState.disabled,
    ).toBe(true);
  expect(
    screen.getByRole('radio', { name: 'Outcome: Day flash' }).props.accessibilityState.disabled,
  ).toBe(false);
  await fireEventAsync.press(screen.getByRole('radio', { name: 'Outcome: Redpoint / sent' }));
  await fireEventAsync.press(screen.getByRole('button', { name: 'Save climb' }));
  await waitFor(() =>
    expect(mockApi.createClimbLog).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 4, outcome: 'DayFlash', attempts: 1 }),
    ),
  );
});

test('same-day project history disables day flash as well', async () => {
  mockApi.listClimbProjects.mockResolvedValue([
    { id: 4, climb: { ...log, projectId: 4, outcome: 'Attempted' } },
  ]);
  mockApi.getProjectAttempts.mockResolvedValue([{ id: 2, date: log.date }]);
  await mountCreate();
  await fireEventAsync.press(screen.getByRole('button', { name: 'Choose unfinished project' }));
  await fireEventAsync.press(await screen.findByRole('button', { name: 'Choose project Problem' }));
  await screen.findByText('Day flash is unavailable after an earlier attempt today.');
  expect(
    screen.getByRole('radio', { name: 'Outcome: Day flash' }).props.accessibilityState.disabled,
  ).toBe(true);
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
  expect(screen.getByText('Wall angles: Overhang')).toBeTruthy();
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
