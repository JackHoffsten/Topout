import { describe, it, expect, vi } from 'vitest';
import { ApiClient, type SessionTransport } from './client';
import {
  progressSchema,
  weeklyActivity,
  groupPoints,
  hardestSends,
  flashRates,
  weightRecords,
  type ProgressData,
  weekKey,
} from './progress';

const exercise = {
  date: '2026-10-01',
  exerciseId: 1,
  name: 'Curl',
  side: 'Left' as const,
  sets: 2,
  reps: 16,
  maxWeightKg: 12,
  volumeKg: 192,
};
const climb = {
  date: '2026-10-01',
  climbingType: 'Bouldering' as const,
  gradeSystem: 'Font' as const,
  grade: '7A',
  environment: 'Indoor' as const,
  climbs: 2,
  sends: 1,
  flashes: 1,
  attempts: 4,
};

describe('progress calculations', () => {
  it('validates ranges and ranks them at the lower midpoint', () => {
    const ranged = { ...climb, grade: '6B-6C' };
    expect(progressSchema.safeParse({ exercises: [], climbing: [ranged] }).success).toBe(true);
    expect(hardestSends([ranged], 'Font')).toEqual(
      hardestSends([{ ...climb, grade: '6B+' }], 'Font'),
    );
  });
  it('uses Monday weeks across year and DST boundaries, includes inactive weeks, and counts days once', () => {
    expect(weekKey('2026-01-01')).toBe('2025-12-29');
    expect(weekKey('2026-03-29')).toBe('2026-03-23');
    const data: ProgressData = {
      exercises: [exercise, { ...exercise, side: 'Right' }],
      climbing: [climb],
    };
    const activity = weeklyActivity(data, '2026-09-21', '2026-10-11');
    expect(activity.workouts.map((x) => x.value)).toEqual([0, 1, 0]);
    expect(activity.climbing.map((x) => x.value)).toEqual([0, 1, 0]);
  });
  it('sums volume/reps but takes maximum working weight per day', () => {
    const rows = [exercise, { ...exercise, volumeKg: 100, maxWeightKg: 10 }];
    expect(
      groupPoints(
        rows,
        (x) => x.date,
        (x) => x.volumeKg,
      )[0].value,
    ).toBe(292);
    expect(
      groupPoints(
        rows,
        (x) => x.date,
        (x) => x.maxWeightKg,
        'max',
      )[0].value,
    ).toBe(12);
  });
  it('only ranks sent grades within the requested system and uses proper difficulty order', () => {
    const rows = [
      climb,
      { ...climb, grade: '9C', sends: 0, flashes: 0 },
      { ...climb, gradeSystem: 'V' as const, grade: 'V10' },
    ];
    expect(hardestSends(rows, 'Font')).toEqual(hardestSends([climb], 'Font'));
    expect(hardestSends(rows, 'V')[0].value).toBe(12);
    expect(hardestSends([{ ...climb, sends: 0, flashes: 0 }], 'Font')).toEqual([]);
  });
  it('calculates flashes against all logged climbs including failures, and validates counts', () => {
    expect(flashRates([climb])[0].value).toBe(50);
    expect(
      progressSchema.safeParse({ exercises: [], climbing: [{ ...climb, sends: 0 }] }).success,
    ).toBe(false);
    expect(
      progressSchema.safeParse({ exercises: [], climbing: [{ ...climb, grade: 'V10' }] }).success,
    ).toBe(false);
  });
  it('detects new lifetime weight records independently by exercise and side, without repeats or zero-weight records', () => {
    const rows = [
      exercise,
      { ...exercise, date: '2026-10-02', maxWeightKg: 12 },
      { ...exercise, date: '2026-10-03', maxWeightKg: 14 },
      { ...exercise, side: 'Right' as const, maxWeightKg: 10 },
      { ...exercise, exerciseId: 2, maxWeightKg: 0 },
    ];
    expect(weightRecords(rows).map((x) => `${x.date}:${x.side}`)).toEqual([
      '2026-10-01:Left',
      '2026-10-01:Right',
      '2026-10-03:Left',
    ]);
  });
  it('encodes date bounds and validates progress API responses', async () => {
    const transport = {
      refresh: vi
        .fn()
        .mockResolvedValue({ accessToken: 'test', accessTokenExpiresAt: '2030-01-01T00:00:00Z' }),
    } as unknown as SessionTransport;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ exercises: [exercise], climbing: [climb] })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ exercises: [{ ...exercise, side: 'Unknown' }], climbing: [] }),
        ),
      );
    const api = new ApiClient('https://example.com', transport, fetcher);
    await api.initialize();
    expect((await api.getProgress('2026-10-01', '2026-10-31')).exercises).toHaveLength(1);
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://example.com/api/progress?from=2026-10-01&to=2026-10-31',
    );
    await expect(api.getProgress()).rejects.toThrow();
  });
});
