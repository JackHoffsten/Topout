import { expect, it, vi } from 'vitest';
import { ApiClient, type SessionTransport } from './client';
import { scheduleWorkoutInputSchema, scheduledWorkoutSchema } from './contracts';

it('validates date-only plans, template ids, and schedule responses', () => {
  expect(scheduleWorkoutInputSchema.safeParse({ date: '2026-02-30', templateId: 1 }).success).toBe(
    false,
  );
  expect(scheduleWorkoutInputSchema.safeParse({ date: '2026-10-01', templateId: 0 }).success).toBe(
    false,
  );
  expect(
    scheduleWorkoutInputSchema.parse({ date: '2026-10-01', templateId: null }).templateId,
  ).toBeNull();
  expect(
    scheduledWorkoutSchema.safeParse({
      id: 1,
      date: '2026-10-01',
      templateId: null,
      templateName: null,
      isRestDay: true,
      status: 'Unknown',
    }).success,
  ).toBe(false);
});

it('sends schedule requests and validates the returned plan', async () => {
  const session = { accessToken: 'test', accessTokenExpiresAt: '2030-01-01T00:00:00Z' };
  const transport = { refresh: vi.fn().mockResolvedValue(session) } as unknown as SessionTransport;
  const plan = {
    id: 2,
    date: '2026-10-01',
    templateId: 1,
    templateName: 'Push',
    isRestDay: false,
    status: 'Planned',
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify([plan])))
    .mockResolvedValueOnce(new Response(JSON.stringify(plan)))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const client = new ApiClient('https://example.com', transport, fetcher);
  await client.initialize();
  expect(await client.listWorkoutSchedule('2026-10-01', '2026-10-31')).toEqual([plan]);
  expect(await client.scheduleWorkout({ date: plan.date, templateId: 1 })).toEqual(plan);
  await client.deleteScheduledWorkout(2);
  expect(fetcher.mock.calls[0]![0]).toBe(
    'https://example.com/api/workout-schedule?from=2026-10-01&to=2026-10-31',
  );
  expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual({ date: plan.date, templateId: 1 });
  expect(fetcher.mock.calls[2]![1].method).toBe('DELETE');
});
