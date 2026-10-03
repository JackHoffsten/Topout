import { z } from 'zod';
import { climbingTypes, gradeSystems, climbingEnvironments, climbingGrades } from './climbing';

export const progressSchema = z.object({
  exercises: z.array(
    z.object({
      date: z.iso.date(),
      exerciseId: z.number().int().positive(),
      name: z.string(),
      side: z.enum(['Both', 'Left', 'Right']),
      sets: z.number().int().nonnegative(),
      reps: z.number().int().nonnegative(),
      maxWeightKg: z.number().nonnegative(),
      volumeKg: z.number().nonnegative(),
    }),
  ),
  climbing: z.array(
    z
      .object({
        date: z.iso.date(),
        climbingType: z.enum(climbingTypes),
        gradeSystem: z.enum(gradeSystems),
        grade: z.string(),
        environment: z.enum(climbingEnvironments),
        climbs: z.number().int().nonnegative(),
        sends: z.number().int().nonnegative(),
        flashes: z.number().int().nonnegative(),
        attempts: z.number().int().nonnegative(),
      })
      .refine(
        (x) =>
          climbingGrades[x.gradeSystem].includes(x.grade) &&
          x.flashes <= x.sends &&
          x.sends <= x.climbs,
        'Invalid climbing progress.',
      ),
  ),
});
export type ProgressData = z.infer<typeof progressSchema>;
export type ChartPoint = { date: string; value: number };

/** Monday-based calendar weeks. Parse at UTC noon to avoid DST boundary shifts. */
export function weekKey(date: string) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function groupPoints<T>(
  items: readonly T[],
  date: (item: T) => string,
  value: (item: T) => number,
  mode: 'sum' | 'max' = 'sum',
): ChartPoint[] {
  const points = new Map<string, number>();
  items.forEach((item) => {
    const key = date(item);
    points.set(
      key,
      mode === 'max'
        ? Math.max(points.get(key) ?? 0, value(item))
        : (points.get(key) ?? 0) + value(item),
    );
  });
  return [...points]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}
export function weeklyActivity(data: ProgressData, from: string, to: string) {
  const workoutDays = new Set(data.exercises.map((x) => x.date));
  const climbDays = new Set(data.climbing.map((x) => x.date));
  const weeks: string[] = [];
  const d = new Date(weekKey(from) + 'T12:00:00Z');
  while (d.toISOString().slice(0, 10) <= to) {
    weeks.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  const series = (days: Set<string>) =>
    weeks.map((date) => ({
      date,
      value: [...days].filter((day) => day >= from && day <= to && weekKey(day) === date).length,
    }));
  return { workouts: series(workoutDays), climbing: series(climbDays) };
}
export function hardestSends(
  climbs: ProgressData['climbing'],
  system: keyof typeof climbingGrades,
) {
  return groupPoints(
    climbs.filter((x) => x.gradeSystem === system && x.sends > 0),
    (x) => x.date,
    (x) => climbingGrades[system].indexOf(x.grade) + 1,
    'max',
  );
}
export function flashRates(climbs: ProgressData['climbing']) {
  const totals = groupPoints(
    climbs,
    (x) => weekKey(x.date),
    (x) => x.climbs,
  );
  const flashes = new Map(
    groupPoints(
      climbs,
      (x) => weekKey(x.date),
      (x) => x.flashes,
    ).map((x) => [x.date, x.value]),
  );
  return totals.map((x) => ({
    date: x.date,
    value: x.value ? (100 * (flashes.get(x.date) ?? 0)) / x.value : 0,
  }));
}

export function weightRecords(exercises: ProgressData['exercises']) {
  const best = new Map<string, number>();
  return [...exercises]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((day) => {
      const key = `${day.exerciseId}:${day.side}`;
      const previous = best.get(key) ?? 0;
      best.set(key, Math.max(previous, day.maxWeightKg));
      return day.maxWeightKg > previous;
    });
}
