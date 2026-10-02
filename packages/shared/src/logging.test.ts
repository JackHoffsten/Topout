import { expect, it, vi } from 'vitest';
import { ApiClient, type SessionTransport } from './client';
import { completeWorkoutInputSchema, workoutLoggingSchema } from './contracts';

const set = { reps: 8, weightKg: 20.5, isWarmup: false, notes: null };
const input = { notes: null, exercises: [{ exerciseId: 1, sets: [set] }] };
const response = {
  scheduleId: 2,
  date: '2026-10-01',
  templateName: 'Pull',
  template: null,
  previousSets: [],
  log: {
    id: 3,
    date: '2026-10-01',
    notes: null,
    completedAt: '2026-10-01T12:00:00Z',
    exercises: [
      {
        exercise: { id: 1, name: 'Row', muscleGroups: ['Back'], isCustom: true },
        sets: [{ ...set, order: 1 }],
      },
    ],
  },
};

it('rejects incomplete, invalid, and duplicate actual sets and validates logs', () => {
  expect(completeWorkoutInputSchema.safeParse({ notes: null, exercises: [] }).success).toBe(false);
  expect(
    completeWorkoutInputSchema.safeParse({ ...input, exercises: [{ exerciseId: 1, sets: [] }] })
      .success,
  ).toBe(false);
  expect(
    completeWorkoutInputSchema.safeParse({
      ...input,
      exercises: [input.exercises[0], input.exercises[0]],
    }).success,
  ).toBe(false);
  expect(
    completeWorkoutInputSchema.safeParse({
      ...input,
      exercises: [{ exerciseId: 1, sets: [{ ...set, reps: 0 }] }],
    }).success,
  ).toBe(false);
  expect(workoutLoggingSchema.parse(response)).toEqual(response);
});

it('sends completion data and parses the persisted workout', async () => {
  const transport = {
    refresh: vi
      .fn()
      .mockResolvedValue({ accessToken: 'test', accessTokenExpiresAt: '2030-01-01T00:00:00Z' }),
  } as unknown as SessionTransport;
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
  const api = new ApiClient('https://example.com', transport, fetcher);
  await api.initialize();
  expect(await api.completeWorkout(2, input)).toEqual(response);
  expect(fetcher.mock.calls[0]![0]).toBe('https://example.com/api/workout-schedule/2/log');
  expect(fetcher.mock.calls[0]![1].method).toBe('POST');
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(input);
  fetcher.mockResolvedValue(new Response(JSON.stringify(response)));
  expect(await api.getWorkoutLogging(2)).toEqual(response);
});

it('records an individual set and updates completed workouts using PUT', async () => {
  const transport = {
    refresh: vi
      .fn()
      .mockResolvedValue({ accessToken: 'test', accessTokenExpiresAt: '2030-01-01T00:00:00Z' }),
  } as unknown as SessionTransport;
  const fetcher = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(response))));
  const api = new ApiClient('https://example.com', transport, fetcher);
  await api.initialize();
  await api.recordWorkoutSet(2, { ...set, exerciseId: 1, order: 2 });
  expect(fetcher.mock.calls[0]![0]).toBe('https://example.com/api/workout-schedule/2/log/sets');
  expect(fetcher.mock.calls[0]![1].method).toBe('PUT');
  await api.updateWorkout(2, input);
  expect(fetcher.mock.calls[1]![1].method).toBe('PUT');
  await api.removeWorkoutSet(2, 1, 2);
  expect(fetcher.mock.calls[2]![0]).toBe('https://example.com/api/workout-schedule/2/log/sets/1/2');
  expect(fetcher.mock.calls[2]![1].method).toBe('DELETE');
  fetcher.mockResolvedValue(new Response(null, { status: 204 }));
  await api.deleteWorkoutLog(2);
  expect(fetcher.mock.calls[3]![0]).toBe('https://example.com/api/workout-schedule/2/log');
  expect(fetcher.mock.calls[3]![1].method).toBe('DELETE');
});
