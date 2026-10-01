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

const exercise = { id: 1, name: 'Row', muscleGroup: 'Back', isCustom: false };
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

test('creates a complete ordered draft with two default sets and copied additional sets', async () => {
  await mount(<TemplateEditor />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create template' }));
  await screen.findByText('Enter a template name.');
  await fireEvent.changeText(screen.getByLabelText('Template name'), 'Pull');
  await fireEvent.press(screen.getByRole('button', { name: 'Add exercise' }));
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), 'Row');
  expect(screen.queryByRole('button', { name: 'Select Curl' })).toBeNull();
  await fireEvent.press(await screen.findByRole('button', { name: 'Select Row' }));
  expect(screen.getByLabelText('Row set 1 reps').props.value).toBe('8');
  expect(screen.getByLabelText('Row set 2 reps').props.value).toBe('8');
  expect(screen.queryByRole('button', { name: 'Add Row' })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Row set 2 reps'), '12');
  await fireEvent.press(screen.getByRole('button', { name: 'Add set to Row' }));
  expect(screen.getByLabelText('Row set 3 reps').props.value).toBe('12');
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
        { exerciseId: 2, sets: [set, set] },
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
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete Pull' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  await screen.findByText('This workout template is used by a scheduled workout.');
  mockApi.listWorkoutTemplates.mockResolvedValue([]);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete template' }));
  await screen.findByText('No templates');
});
