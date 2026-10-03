import { expect, it, vi } from 'vitest';
import { ApiClient, ApiError, type SessionTransport } from './client';
import {
  exerciseInputSchema,
  workoutTemplateInputSchema,
  workoutTemplateSchema,
} from './contracts';

it('validates multiple muscle groups, empty selections and invalid or duplicate groups', () => {
  expect(
    exerciseInputSchema.parse({ name: 'Row', muscleGroups: ['Back', 'Biceps'] }).muscleGroups,
  ).toEqual(['Back', 'Biceps']);
  expect(exerciseInputSchema.safeParse({ name: 'Row', muscleGroups: [] }).success).toBe(true);
  for (const muscleGroups of [['Back', 'Back'], ['None'], ['Unknown']]) {
    expect(exerciseInputSchema.safeParse({ name: 'Row', muscleGroups }).success).toBe(false);
  }
});

const set = {
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetWeightKg: 20,
  isWarmup: false,
  isAmrap: true,
};
const input = { name: 'Push', exercises: [{ exerciseId: 1, sets: [set] }] };
const template = {
  id: 2,
  name: 'Push',
  exercises: [
    { exercise: { id: 1, name: 'Press', muscleGroups: ['Chest'], isCustom: false }, sets: [set] },
  ],
};

it('validates templates, empty plans, ranges, duplicates and weight bounds', () => {
  const split = {
    ...set,
    rightTarget: { targetRepsMin: 10, targetRepsMax: 12, targetWeightKg: 14 },
  };
  expect(
    workoutTemplateInputSchema.safeParse({
      name: 'Split',
      exercises: [{ exerciseId: 1, sets: [split] }],
    }).success,
  ).toBe(true);
  expect(
    workoutTemplateInputSchema.safeParse({
      name: 'Split',
      exercises: [
        {
          exerciseId: 1,
          sets: [{ ...split, rightTarget: { ...split.rightTarget, targetRepsMax: 5 } }],
        },
      ],
    }).success,
  ).toBe(false);
  expect(workoutTemplateInputSchema.parse({ name: ' Empty ', exercises: [] }).name).toBe('Empty');
  expect(workoutTemplateInputSchema.safeParse(input).success).toBe(true);
  expect(
    workoutTemplateInputSchema.safeParse({
      ...input,
      exercises: [...input.exercises, ...input.exercises],
    }).success,
  ).toBe(false);
  for (const invalid of [
    { targetRepsMin: 0 },
    { targetRepsMin: 1001 },
    { targetRepsMax: 7 },
    { targetWeightKg: -1 },
    { targetWeightKg: 2001 },
  ]) {
    expect(
      workoutTemplateInputSchema.safeParse({
        ...input,
        exercises: [{ exerciseId: 1, sets: [{ ...set, ...invalid }] }],
      }).success,
    ).toBe(false);
  }
  expect(
    workoutTemplateSchema.safeParse({ ...template, exercises: [{ exercise: { id: 1 }, sets: [] }] })
      .success,
  ).toBe(false);
});

it('sends complete ordered drafts and validates every template response', async () => {
  const session = { accessToken: 'token', accessTokenExpiresAt: '2026-09-22T10:00:00Z' };
  const transport = { refresh: vi.fn().mockResolvedValue(session) } as unknown as SessionTransport;
  const fetcher = vi.fn<typeof fetch>();
  const api = new ApiClient('', transport, fetcher);
  await api.initialize();
  fetcher.mockResolvedValueOnce(Response.json([template]));
  expect(await api.listWorkoutTemplates()).toEqual([template]);
  fetcher.mockResolvedValueOnce(Response.json(template));
  expect(await api.getWorkoutTemplate(2)).toEqual(template);
  fetcher.mockResolvedValueOnce(Response.json(template));
  await api.createWorkoutTemplate(input);
  expect(fetcher.mock.calls[2]).toEqual([
    '/api/workout-templates',
    expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
  ]);
  fetcher.mockResolvedValueOnce(Response.json(template));
  await api.updateWorkoutTemplate(2, input);
  expect(fetcher.mock.calls[3]).toEqual([
    '/api/workout-templates/2',
    expect.objectContaining({ method: 'PUT', body: JSON.stringify(input) }),
  ]);
  fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await api.deleteWorkoutTemplate(2);
  fetcher.mockResolvedValueOnce(
    Response.json({ title: 'Template is scheduled.' }, { status: 409 }),
  );
  await expect(api.deleteWorkoutTemplate(2)).rejects.toEqual(
    new ApiError(409, 'Template is scheduled.'),
  );
  fetcher.mockResolvedValueOnce(Response.json({ id: 'invalid' }));
  await expect(api.getWorkoutTemplate(2)).rejects.toThrow();
});
