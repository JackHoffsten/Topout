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
import { ExerciseList } from '../features/exercises/ExerciseList';
import { ExerciseEditor } from '../features/exercises/ExerciseEditor';

const exercise = { id: 1, name: 'Pull-up', muscleGroup: 'Back', isCustom: true };
const mockApi = {
  listExercises: jest.fn<() => Promise<any[]>>(),
  createExercise: jest.fn<(...args: any[]) => Promise<any>>(),
  updateExercise: jest.fn<(...args: any[]) => Promise<any>>(),
  deleteExercise: jest.fn<(...args: any[]) => Promise<void>>(),
};
const mockReplace = jest.fn();

jest.mock('../lib/providers', () => ({
  useSession: () => ({ api: mockApi, status: 'authenticated' }),
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@expo/vector-icons', () => ({ Feather: () => null, Ionicons: () => null }));
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
  mockApi.listExercises.mockResolvedValue([]);
});

test('loading and empty states', async () => {
  let resolve!: (value: any[]) => void;
  mockApi.listExercises.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await mount(<ExerciseList />);
  expect(screen.getByText('Loading exercises…')).toBeTruthy();
  await act(async () => resolve([]));
  await screen.findByText('No exercises');
});

test('starter and custom exercises have the same presentation', async () => {
  mockApi.listExercises.mockResolvedValue([
    { ...exercise, id: 1, name: 'Pull-up', isCustom: false },
    { ...exercise, id: 2, name: 'Row', isCustom: true },
  ]);
  await mount(<ExerciseList />);
  await screen.findByText('Pull-up');
  expect(screen.getByText('Row')).toBeTruthy();
  expect(screen.queryByText('Starter')).toBeNull();
  expect(screen.queryByText('Custom')).toBeNull();
  expect(screen.queryByText('MADE BY YOU')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Refresh exercises' })).toBeNull();
});

test('create validates, then surfaces duplicate names', async () => {
  mockApi.createExercise.mockRejectedValue(
    new ApiError(409, 'An exercise with this name already exists.'),
  );
  await mount(<ExerciseEditor />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
  await screen.findByText('Give your exercise a name.');
  expect(mockApi.createExercise).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'Pull-up');
  await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
  await screen.findByText('An exercise with this name already exists.');
});

test('successful creation returns to library', async () => {
  mockApi.createExercise.mockResolvedValue(exercise);
  await mount(<ExerciseEditor />);
  await fireEvent.changeText(screen.getByLabelText('Exercise name'), 'Pull-up');
  await fireEvent.press(screen.getByRole('button', { name: 'Create exercise' }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/exercises'));
});

test('edit loads existing values and saves changes', async () => {
  mockApi.listExercises.mockResolvedValue([exercise]);
  mockApi.updateExercise.mockResolvedValue(exercise);
  await mount(<ExerciseEditor id={1} />);
  const field = await screen.findByLabelText('Exercise name');
  expect(field.props.value).toBe('Pull-up');
  await fireEvent.changeText(field, 'Weighted pull-up');
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(mockApi.updateExercise).toHaveBeenCalledWith(1, {
      name: 'Weighted pull-up',
      muscleGroup: 'Back',
    }),
  );
});

test('referenced deletion stays open with error; successful deletion refreshes library', async () => {
  mockApi.listExercises.mockResolvedValue([exercise]);
  mockApi.deleteExercise
    .mockRejectedValueOnce(new ApiError(409, 'Exercises used in workouts cannot be deleted.'))
    .mockResolvedValue(undefined);
  await mount(<ExerciseList />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete Pull-up' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Delete exercise' }));
  await screen.findByText('Exercises used in workouts cannot be deleted.');
  mockApi.listExercises.mockResolvedValue([]);
  await fireEvent.press(screen.getByRole('button', { name: 'Delete exercise' }));
  await screen.findByText('No exercises');
});
