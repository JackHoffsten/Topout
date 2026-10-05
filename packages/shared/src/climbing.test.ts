import { expect, it, vi } from 'vitest';
import { climbHistorySchema, climbOutcomeLabel } from './climbing';
import { ApiClient, ApiError, type SessionTransport } from './client';
import {
  climbLogInputSchema,
  climbLogSchema,
  climbingGrades,
  systemsForType,
  type ClimbLogInput,
} from './climbing';

const input: ClimbLogInput = {
  date: '2026-10-03',
  climbingType: 'Bouldering',
  gradeSystem: 'Font',
  grade: '7A',
  environment: 'Board',
  attempts: 3,
  outcome: 'Redpoint',
  wallAngle: 'Overhang',
  styles: ['Crimpy', 'Slopy'],
  name: null,
  location: null,
};

it('validates private photo responses and uses the authenticated photo endpoints', async () => {
  const transport = {
    refresh: vi
      .fn()
      .mockResolvedValue({ accessToken: 'token', accessTokenExpiresAt: '2099-01-01T00:00:00Z' }),
  } as unknown as SessionTransport;
  const photo = { base64: 'jpeg', width: 800, height: 600 };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('null'))
    .mockResolvedValueOnce(new Response(JSON.stringify(photo)))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...photo, width: 0 })));
  const api = new ApiClient('https://example.com', transport, fetcher);
  await api.initialize();
  expect(await api.getClimbPhoto(7)).toBeNull();
  expect(await api.saveClimbPhoto(7, 'jpeg')).toEqual(photo);
  expect(fetcher.mock.calls[1]![0]).toBe('https://example.com/api/climb-logs/7/photo');
  expect(fetcher.mock.calls[1]![1]).toEqual(
    expect.objectContaining({ method: 'PUT', body: JSON.stringify({ base64: 'jpeg' }) }),
  );
  await api.deleteClimbPhoto(7);
  await expect(api.getClimbPhoto(7)).rejects.toThrow();
});

it('loads history pages and selected climbs with runtime validation', async () => {
  const log = { id: 7, ...input };
  const transport = {
    refresh: vi
      .fn()
      .mockResolvedValue({ accessToken: 'test', accessTokenExpiresAt: '2030-01-01T00:00:00Z' }),
  } as unknown as SessionTransport;
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [log], nextPage: 3, totalCount: 120 })),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify(log)));
  const api = new ApiClient('https://example.com', transport, fetcher);
  await api.initialize();
  expect(await api.listClimbHistory(2)).toEqual({ items: [log], nextPage: 3, totalCount: 120 });
  expect(await api.getClimbLog(7)).toEqual(log);
  expect(fetcher.mock.calls[0]![0]).toBe('https://example.com/api/climb-logs/history?page=2');
  expect(fetcher.mock.calls[1]![0]).toBe('https://example.com/api/climb-logs/7');
  expect(climbHistorySchema.safeParse({ items: [log], nextPage: 0 }).success).toBe(false);
  expect(['Attempted', 'Redpoint', 'Flash', 'Onsight'].map(climbOutcomeLabel)).toEqual([
    'Not sent',
    'Sent',
    'Flashed',
    'Onsighted',
  ]);
});

it('keeps climbing grades independent and validates type, environment, attempts, tags, and real dates', () => {
  expect(systemsForType('Bouldering')).toEqual(['Font', 'V']);
  expect(systemsForType('Sport')).toEqual(['French', 'YDS']);
  expect(climbingGrades.Font).toContain('7A');
  expect(climbingGrades.French).toContain('7a');
  expect(climbLogInputSchema.parse(input)).toEqual(input);
  for (const change of [
    { gradeSystem: 'French' },
    { grade: '7a' },
    { attempts: 0 },
    { attempts: 1001 },
    { attempts: 1.5 },
    { outcome: 'Flash' },
    { styles: ['Crimpy', 'Crimpy'] },
    { styles: ['Unknown'] },
    { date: '2026-02-30' },
    { date: '0000-01-01' },
    { name: 'x'.repeat(101) },
    { location: 'x'.repeat(201) },
    { climbingType: 'Sport', gradeSystem: 'French', grade: '7a' },
  ])
    expect(climbLogInputSchema.safeParse({ ...input, ...change }).success).toBe(false);
  expect(climbLogInputSchema.safeParse({ ...input, attempts: 1, outcome: 'Flash' }).success).toBe(
    true,
  );
  expect(climbLogInputSchema.safeParse({ ...input, outcome: 'Attempted' }).success).toBe(true);
});

it('sends scoped CRUD requests and validates responses at runtime', async () => {
  const session = { accessToken: 'test', accessTokenExpiresAt: '2030-01-01T00:00:00Z' };
  const transport = { refresh: vi.fn().mockResolvedValue(session) } as unknown as SessionTransport;
  const log = { id: 1, ...input };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify([log])))
    .mockResolvedValueOnce(new Response(JSON.stringify(log)))
    .mockResolvedValueOnce(new Response(JSON.stringify(log)))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...log, gradeSystem: 'French' })))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Remove the rest day before logging a climb.' }), {
        status: 409,
      }),
    );
  const api = new ApiClient('https://example.com', transport, fetcher);
  await api.initialize();
  expect(await api.listClimbLogs(input.date, input.date)).toEqual([log]);
  expect(await api.createClimbLog(input)).toEqual(log);
  expect(await api.updateClimbLog(1, input)).toEqual(log);
  await api.deleteClimbLog(1);
  expect(fetcher.mock.calls[0]![0]).toBe(
    'https://example.com/api/climb-logs?from=2026-10-03&to=2026-10-03',
  );
  expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toEqual(input);
  expect(fetcher.mock.calls[2]![1].method).toBe('PUT');
  expect(fetcher.mock.calls[3]![1].method).toBe('DELETE');
  await expect(api.createClimbLog(input)).rejects.toThrow();
  await expect(api.createClimbLog(input)).rejects.toEqual(
    new ApiError(409, 'Remove the rest day before logging a climb.'),
  );
  expect(climbLogSchema.safeParse({ ...log, attempts: 0 }).success).toBe(false);
});

it('encodes history filters and sorting without losing search punctuation', async () => {
  const session = { accessToken: 'test', accessTokenExpiresAt: '2030-01-01T00:00:00Z' };
  const transport = { refresh: vi.fn().mockResolvedValue(session) } as unknown as SessionTransport;
  const fetcher = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ items: [], nextPage: null, totalCount: 0 })),
    );
  const api = new ApiClient('https://example.com', transport, fetcher);
  await api.initialize();
  await api.listClimbHistory(2, {
    sort: 'grade-asc',
    environment: 'Outdoor',
    search: 'Rock & roof',
    from: '2026-01-01',
  });
  await api.listClimbHistory(1, {
    environment: ['Indoor', 'Outdoor'],
    gradeSystem: ['Font', 'V'],
    grade: ['7A', 'V5'],
  });
  const multipleUrl = new URL(fetcher.mock.calls[1]![0]);
  expect(multipleUrl.searchParams.getAll('environment')).toEqual(['Indoor', 'Outdoor']);
  expect(multipleUrl.searchParams.getAll('gradeSystem')).toEqual(['Font', 'V']);
  expect(multipleUrl.searchParams.getAll('grade')).toEqual(['7A', 'V5']);
  const url = new URL(fetcher.mock.calls[0]![0]);
  expect(Object.fromEntries(url.searchParams)).toEqual({
    page: '2',
    sort: 'grade-asc',
    environment: 'Outdoor',
    search: 'Rock & roof',
    from: '2026-01-01',
  });
});
