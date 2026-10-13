import { View } from 'react-native';
import {
  weeklyActivity,
  weightRecords,
  groupPoints,
  weekKey,
  climbingTypes,
  systemsForType,
  hardestSends,
  climbingLabel,
  climbingGrades,
  type ProgressData,
} from '@topout/shared';
import { Card } from '../../ui/components/Card';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { useDesktop, useTheme } from '../../ui/theme';
import { displayDate } from '../../lib/dates';
import { ProgressChart } from './ProgressChart';
const count = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
export function ProgressOverview({
  data,
  all,
  from,
  today,
}: {
  data: ProgressData;
  all?: ProgressData;
  from: string;
  today: string;
}) {
  const c = useTheme();
  const wide = useDesktop();
  const hasData = data.exercises.length > 0 || data.climbing.length > 0;
  const activity = weeklyActivity(data, from, today);
  const records = weightRecords(all?.exercises ?? [])
    .filter((x) => x.date >= from && x.date <= today)
    .reverse()
    .slice(0, 5);
  const summary = [
    ['Workout days', new Set(data.exercises.map((x) => x.date)).size],
    ['Working sets', data.exercises.reduce((sum, x) => sum + x.sets, 0)],
    ['Climbing days', new Set(data.climbing.map((x) => x.date)).size],
    ['Climbs sent', data.climbing.reduce((sum, x) => sum + x.sends, 0)],
  ] as const;
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {summary.map(([label, value]) => (
          <Card key={label} style={{ flexGrow: 1, flexBasis: wide ? '22%' : '44%' }}>
            <Label small muted>
              {label}
            </Label>
            <Heading>{count(value)}</Heading>
          </Card>
        ))}
      </View>
      <ProgressChart
        title="Weekly activity"
        subtitle="Active days per week · weeks start Monday"
        ceiling={7}
        series={[
          { name: 'Workouts', color: c.accent, points: hasData ? activity.workouts : [] },
          {
            name: 'Climbing',
            color: c.syntax.keyword,
            points: hasData ? activity.climbing : [],
          },
        ]}
      />
      <ProgressChart
        title="Working sets"
        subtitle="Weekly totals · each logged side counts as one set"
        bars
        series={[
          {
            name: 'Sets',
            color: c.syntax.number,
            points: groupPoints(
              data.exercises,
              (x) => weekKey(x.date),
              (x) => x.sets,
            ),
          },
        ]}
      />
      <Card>
        <Label syntax="name">Recent weight records</Label>
        <Label small muted>
          New lifetime heaviest working weights recorded in this period. Reps may differ.
        </Label>
        {records.length ? (
          records.map((x) => (
            <Label key={`${x.date}:${x.exerciseId}:${x.side}`} small>
              {x.name}
              {x.side !== 'Both' ? ` · ${x.side}` : ''} · {count(x.maxWeightKg)} kg ·{' '}
              {displayDate(x.date)}
            </Label>
          ))
        ) : (
          <Label muted>No new weight records in this period.</Label>
        )}
      </Card>
      <Card>
        <Label syntax="name">Hardest climbs sent</Label>
        {climbingTypes.flatMap((t) =>
          systemsForType(t).map((s) => {
            const points = hardestSends(
              data.climbing.filter((x) => x.climbingType === t),
              s,
            );
            if (!points.length) return null;
            const best = Math.max(...points.map((x) => x.value));
            return (
              <Label key={`${t}:${s}`} small>
                {climbingLabel(t)} · {climbingLabel(s)} · {climbingGrades[s][best - 1]}
              </Label>
            );
          }),
        )}
        {!data.climbing.some((x) => x.sends > 0) && <Label muted>No sends in this period.</Label>}
      </Card>
    </>
  );
}
