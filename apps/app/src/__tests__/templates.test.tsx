import React from 'react';
import { jest, beforeEach, test, expect } from '@jest/globals';
import {
  renderAsync as render,
  screen,
  fireEventAsync as fireEvent,
  waitFor,
  act,
} from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@topout/shared';
import { TemplateList } from '../features/templates/TemplateList';
import { TemplateEditor } from '../features/templates/TemplateEditor';

const exercise = { id: 1, name: 'Row', muscleGroups: ['Back'], isCustom: false };
const set = {
  targetRepsMin: 8,
  targetRepsMax: null,
  targetWeightKg: null,
  isWarmup: false,
  isAmrap: false,
};
const template = { id: 1, name: 'Pull', exercises: [{ exercise, sets: [set, set] }] };
const mockApi = {
  listExercises: jest.fn<() => Promise<any[]>>(),
  createExercise: jest.fn<(...args: any[]) => Promise<any>>(),
  listWorkoutTemplates: jest.fn<() => Promise<any[]>>(),
  getWorkoutTemplate: jest.fn<(...args: any[]) => Promise<any>>(),
  createWorkoutTemplate: jest.fn<(...args: any[]) => Promise<any>>(),
  updateWorkoutTemplate: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteWorkoutTemplate: jest.fn<(...args: any[]) => Promise<void>>(),
};
const mockReplace = jest.fn();

// The Expo Jest preset does not yet provide the RN 0.86 native Switch host component.
jest.mock('react-native/Libraries/Components/Switch/Switch', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, { ...props, accessibilityRole: 'switch' }),
  };
});

jest.mock('../lib/providers', () => ({
  useSession: () => ({ api: mockApi, status: 'authenticated' }),
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  useRouter: () => ({ replace: mockReplace }),
}));

async function mount(element: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

beforeEach(() => {
  jest.resetAllMocks();
  mockApi.listExercises.mockResolvedValue([exercise, { ...exercise, id: 2, name: 'Curl' }]);
  mockApi.listWorkoutTemplates.mockResolvedValue([]);
  mockApi.getWorkoutTemplate.mockResolvedValue(template);
  mockApi.createWorkoutTemplate.mockResolvedValue(template);
  mockApi.updateWorkoutTemplate.mockResolvedValue(template);
});

test('blank rep targets can be saved and stay blank when restored', async () => {
  mockApi.getWorkoutTemplate.mockResolvedValue({
    ...template,
    exercises: [{ exercise, sets: [{ ...set, targetRepsMin: null }] }],
  });
  await mount(<TemplateEditor id={1} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Expand Row' }));
  const field = await screen.findByLabelText('Row set 1 reps');
  expect(field.props.value).toBe('');
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(mockApi.updateWorkoutTemplate).toHaveBeenCalledWith(1, {
      name: 'Pull',
      exercises: [{ exerciseId: 1, sets: [{ ...set, targetRepsMin: null }] }],
    }),
  );
});

test('loading and empty list states', async () => {
  let resolve!: (value: any[]) => void;
  mockApi.listWorkoutTemplates.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await mount(<TemplateList />);
  expect(screen.getByText('Loading templates…')).toBeTruthy();
  await act(async () => resolve([]));
  await screen.findByText('No templates');
});

test('failed list state', async () => {
  mockApi.listWorkoutTemplates.mockRejectedValue(new Error('offline'));
  await mount(<TemplateList />);
  await screen.findByText('Could not connect. Check your connection and try again.');
});

test('template list searches exercises, sorts names and filters muscles without clearing search', async () => {
  mockApi.listWorkoutTemplates.mockResolvedValue([
    template,
    { id: 2, name: 'Empty', exercises: [] },
    {
      id: 3,
      name: 'Arms',
      exercises: [
        {
          exercise: { ...exercise, id: 2, name: 'Curl', muscleGroups: ['Biceps'] },
          sets: [{ ...set, isAmrap: true }],
        },
      ],
    },
  ]);
  await mount(<TemplateList />);
  await screen.findByRole('button', { name: 'Expand template Pull' });
  expect(
    screen
      .getAllByRole('button', { name: /^Expand template/ })
      .map((node) => node.props.accessibilityLabel),
  ).toEqual(['Expand template Arms', 'Expand template Empty', 'Expand template Pull']);
  expect(screen.queryByRole('button', { name: 'Most sets' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Name Z–A' }));
  expect(
    screen
      .getAllByRole('button', { name: /^Expand template/ })
      .map((node) => node.props.accessibilityLabel),
  ).toEqual(['Expand template Pull', 'Expand template Empty', 'Expand template Arms']);
  await fireEvent.changeText(screen.getByLabelText('Search templates'), 'ROW');
  expect(screen.getAllByRole('button', { name: /^Expand template/ })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Filter muscle group: Biceps' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByText('No templates match these filters.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByLabelText('Search templates').props.value).toBe('ROW');
  await fireEvent.changeText(screen.getByLabelText('Search templates'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.queryByText('Contents')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Filter muscle group: Biceps' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getAllByRole('button', { name: /^Expand template/ })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Expand template Arms' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Filters' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Filter muscle group: Back' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getAllByRole('button', { name: /^Expand template/ })).toHaveLength(2);
});

test('template list shows distinct left and right targets for split sets', async () => {
  mockApi.listWorkoutTemplates.mockResolvedValue([
    {
      ...template,
      exercises: [
        {
          exercise,
          sets: [
            {
              ...set,
              targetWeightKg: 0,
              isWarmup: true,
              isAmrap: true,
              rightTarget: { targetRepsMin: 10, targetRepsMax: 12, targetWeightKg: 14 },
            },
            { ...set, targetRepsMin: 1 },
          ],
        },
      ],
    },
  ]);
  await mount(<TemplateList />);
  await screen.findByText('Pull');
  expect(screen.queryByText('Left: 8 reps (0 kg)')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Expand template Pull' }));
  expect(screen.getByText('Left: 8 reps (0 kg)')).toBeTruthy();
  expect(screen.getByText('Right: 10–12 reps (14 kg)')).toBeTruthy();
  expect(screen.getByText('Set 1 (Warmup) (Amrap)')).toBeTruthy();
  expect(screen.getByText('Set 2: 1 rep')).toBeTruthy();
});

test('starts exercises without sets and defaults new set reps to blank', async () => {
  await mount(<TemplateEditor />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  await screen.findByText('Enter a template name.');
  await fireEvent.changeText(screen.getByLabelText('Template name'), 'Pull');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Row');
  expect(screen.queryByRole('button', { name: 'Select Curl' })).toBeNull();
  await fireEvent.press(await screen.findByRole('button', { name: 'Select Row' }));
  expect(screen.queryByLabelText('Row set 1 reps')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Add set to Row' }));
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('');
  await fireEvent.changeText(screen.getByLabelText('Row set 1 reps'), '8');
  await fireEvent.press(screen.getByRole('button', { name: 'Add set to Row' }));
  expect(screen.getByLabelText('Row set 2 reps').props.value).toBe('');
  expect(screen.queryByRole('button', { name: 'Add Row' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Row set 2 reps'), '12');
  await fireEvent.press(screen.getByRole('button', { name: 'Add set to Row' }));
  expect(screen.getByLabelText('Row set 3 reps').props.value).toBe('');
  await fireEvent.changeText(screen.getByLabelText('Row set 3 reps'), '12');
  await fireEvent.press(screen.getByRole('button', { name: 'Move Row set 3 up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Row set 3' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  expect(screen.queryByLabelText('Row set 1 reps')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Expand Row' }));
  expect(screen.getByLabelText('Row set 2 reps').props.value).toBe('12');
  await fireEvent.press(screen.getByRole('button', { name: 'Collapse Row' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  expect(screen.queryByRole('button', { name: 'Select Row' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Select Curl' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move Curl up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  await waitFor(() =>
    expect(mockApi.createWorkoutTemplate).toHaveBeenCalledWith({
      name: 'Pull',
      exercises: [
        { exerciseId: 2, sets: [] },
        { exerciseId: 1, sets: [set, { ...set, targetRepsMin: 12 }] },
      ],
    }),
  );
  expect(mockReplace).toHaveBeenCalledWith('/templates');
});

test('edits targets, validates ranges, preserves draft after a conflict and permits no sets', async () => {
  mockApi.updateWorkoutTemplate.mockRejectedValueOnce(
    new ApiError(409, 'A workout template with this name already exists.'),
  );
  await mount(<TemplateEditor id={1} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Expand Row' }));
  await screen.findByLabelText('Row set 1 reps');
  await fireEvent.changeText(screen.getByLabelText('Row set 1 max reps (optional)'), '3');
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('Maximum reps must be at least minimum reps.');
  expect(mockApi.updateWorkoutTemplate).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Row set 1 max reps (optional)'), '12');
  await fireEvent.changeText(screen.getByLabelText('Row set 1 weight (kg, optional)'), '20.5');
  await fireEvent(screen.getByLabelText('Row set 1 warm-up'), 'valueChange', true);
  await fireEvent(screen.getByLabelText('Row set 1 AMRAP'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await screen.findByText('A workout template with this name already exists.');
  expect(mockApi.updateWorkoutTemplate).toHaveBeenCalledWith(1, {
    name: 'Pull',
    exercises: [
      {
        exerciseId: 1,
        sets: [
          { ...set, targetRepsMax: 12, targetWeightKg: 20.5, isWarmup: true, isAmrap: true },
          set,
        ],
      },
    ],
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Row set 2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Row set 1' }));
  expect(screen.getByText('No planned sets.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(mockApi.updateWorkoutTemplate).toHaveBeenLastCalledWith(1, {
      name: 'Pull',
      exercises: [{ exerciseId: 1, sets: [] }],
    }),
  );
});

test('cancelling a selected exercise discards its sets without changing the template', async () => {
  await mount(<TemplateEditor />);
  await fireEvent.changeText(screen.getByLabelText('Template name'), 'Empty');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Select Row' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add set to Row' }));
  await fireEvent.changeText(screen.getByLabelText('Row set 1 reps'), '20');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('button', { name: 'Expand Row' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  await waitFor(() =>
    expect(mockApi.createWorkoutTemplate).toHaveBeenCalledWith({ name: 'Empty', exercises: [] }),
  );
});

test('delete conflict remains visible and successful deletion reloads templates', async () => {
  mockApi.listWorkoutTemplates.mockResolvedValue([template]);
  mockApi.deleteWorkoutTemplate
    .mockRejectedValueOnce(
      new ApiError(409, 'This workout template is used by a scheduled workout.'),
    )
    .mockResolvedValue(undefined);
  await mount(<TemplateList />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Expand template Pull' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete Pull' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  await screen.findByText('This workout template is used by a scheduled workout.');
  mockApi.listWorkoutTemplates.mockResolvedValue([]);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  await screen.findByText('No templates');
});

test('creates a missing exercise inline and preserves the template draft', async () => {
  const created = {
    ...exercise,
    id: 3,
    name: 'Cable row',
    muscleGroups: ['Back', 'Biceps'],
    isCustom: true,
  };
  mockApi.createExercise.mockResolvedValue(created);
  await mount(<TemplateEditor />);
  await fireEvent.changeText(screen.getByLabelText('Template name'), 'Pull');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Select Row' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Curl');
  expect(screen.queryByRole('button', { name: 'Create exercise' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Cable row');
  await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
  expect(screen.getByLabelText('Exercise name').props.value).toBe('Cable row');
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Back' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Biceps' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
  await screen.findByRole('button', { name: 'Add set to Cable row' });
  expect(screen.queryByLabelText('Cable row set 1 reps')).toBeNull();
  expect(mockApi.createExercise).toHaveBeenCalledWith({
    name: 'Cable row',
    muscleGroups: ['Back', 'Biceps'],
  });
  expect(mockReplace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  await waitFor(() =>
    expect(mockApi.createWorkoutTemplate).toHaveBeenCalledWith({
      name: 'Pull',
      exercises: [
        { exerciseId: 1, sets: [] },
        { exerciseId: 3, sets: [] },
      ],
    }),
  );
});

test('inline creation errors and cancellation preserve the search and template name', async () => {
  mockApi.createExercise.mockRejectedValue(
    new ApiError(409, 'An exercise with this name already exists.'),
  );
  await mount(<TemplateEditor />);
  await fireEvent.changeText(screen.getByLabelText('Template name'), 'Pull');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await screen.findByRole('button', { name: 'Select Row' });
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Cable row');
  await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
  await screen.findByText('An exercise with this name already exists.');
  expect(screen.getByLabelText('Exercise name').props.value).toBe('Cable row');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByLabelText('Search exercises').props.value).toBe('Cable row');
  expect(screen.getByLabelText('Template name').props.value).toBe('Pull');
  expect(mockReplace).not.toHaveBeenCalled();
});

test('plans left/right targets and preserves split weights while leaving added reps blank', async () => {
  await mount(<TemplateEditor />);
  await fireEvent.changeText(screen.getByLabelText('Template name'), 'Split');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Select Row' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add set to Row' }));
  await fireEvent.changeText(screen.getByLabelText('Row set 1 reps'), '8');
  await fireEvent.press(screen.getByRole('button', { name: 'Split Row set 1 left/right' }));
  await fireEvent.changeText(screen.getByLabelText('Row set 1 left weight (kg, optional)'), '12');
  await fireEvent.changeText(screen.getByLabelText('Row set 1 right reps'), '10');
  await fireEvent.changeText(screen.getByLabelText('Row set 1 right max reps (optional)'), '3');
  await fireEvent.changeText(screen.getByLabelText('Row set 1 right weight (kg, optional)'), '14');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  await screen.findByText('Maximum reps must be at least minimum reps.');
  expect(mockApi.createWorkoutTemplate).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Row set 1 right max reps (optional)'), '12');
  await fireEvent.press(screen.getByRole('button', { name: 'Add set to Row' }));
  expect(screen.getByLabelText('Row set 2 right reps').props.value).toBe('');
  expect(screen.getByLabelText('Row set 2 left reps').props.value).toBe('');
  await fireEvent.changeText(screen.getByLabelText('Row set 2 left reps'), '8');
  await fireEvent.changeText(screen.getByLabelText('Row set 2 right max reps (optional)'), '12');
  await fireEvent.changeText(screen.getByLabelText('Row set 2 right reps'), '11');
  await fireEvent.press(screen.getByRole('button', { name: 'Move Row set 2 up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  await waitFor(() =>
    expect(mockApi.createWorkoutTemplate).toHaveBeenCalledWith({
      name: 'Split',
      exercises: [
        {
          exerciseId: 1,
          sets: [
            {
              ...set,
              targetWeightKg: 12,
              rightTarget: { targetRepsMin: 11, targetRepsMax: 12, targetWeightKg: 14 },
            },
            {
              ...set,
              targetWeightKg: 12,
              rightTarget: { targetRepsMin: 10, targetRepsMax: 12, targetWeightKg: 14 },
            },
          ],
        },
      ],
    }),
  );
});

test('restores split template targets and can change a set back to normal', async () => {
  mockApi.getWorkoutTemplate.mockResolvedValue({
    ...template,
    exercises: [
      {
        exercise,
        sets: [
          { ...set, rightTarget: { targetRepsMin: 10, targetRepsMax: null, targetWeightKg: 14 } },
        ],
      },
    ],
  });
  await mount(<TemplateEditor id={1} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Expand Row' }));
  expect(screen.getByLabelText('Row set 1 right reps').props.value).toBe('10');
  await fireEvent.press(screen.getByRole('button', { name: 'Unsplit Row set 1 left/right' }));
  expect(screen.queryByLabelText('Row set 1 right reps')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(mockApi.updateWorkoutTemplate).toHaveBeenCalledWith(1, {
      name: 'Pull',
      exercises: [{ exerciseId: 1, sets: [set] }],
    }),
  );
});
