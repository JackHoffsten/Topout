import { useRef, useState } from 'react';
import { View, type ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import {
  climbingTypes,
  climbingEnvironments,
  climbingGrades,
  climbingLabel,
  systemsForType,
  groupPoints,
  hardestSends,
  weeklyActivity,
  flashRates,
  weightRecords,
  weekKey,
  errorMessage,
  type ClimbingType,
  type GradeSystem,
  type ProgressData,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Card } from '../../ui/components/Card';
import { SearchField } from '../../ui/components/SearchField';
import { Button } from '../../ui/components/Button';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Loading } from '../../ui/components/Loading';
import { useDesktop, useTheme } from '../../ui/theme';
import { dateKey } from '../calendar/calendar';
import { ProgressChart, type ChartSeries } from './ProgressChart';

const count = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
function Choices<T extends string>({
  values,
  selected,
  onChange,
  label = (x) => x,
}: {
  values: readonly T[];
  selected: T;
  onChange: (value: T) => void;
  label?: (value: T) => string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {values.map((value) => (
        <Button
          key={value}
          title={label(value)}
          selected={selected === value}
          variant={selected === value ? 'primary' : 'secondary'}
          onPress={() => onChange(value)}
        />
      ))}
    </View>
  );
}

export function ProgressScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { api } = useSession();
  const c = useTheme();
  const wide = useDesktop();
  const today = dateKey(new Date());
  // Read compact daily history so range changes can preserve lifetime personal-best comparisons.
  const query = useQuery({
    queryKey: ['progress', today],
    queryFn: () => api.getProgress(undefined, today),
  });
  const [tab, setTab] = useState('Overview');
  const [range, setRange] = useState('3 months');
  const [search, setSearch] = useState('');
  const [exerciseId, setExerciseId] = useState<number>();
  const [choosing, setChoosing] = useState(true);
  const [metric, setMetric] = useState('Heaviest weight');
  const [side, setSide] = useState('All sides');
  const [type, setType] = useState<ClimbingType>('Bouldering');
  const [system, setSystem] = useState<GradeSystem>('Font');
  const [environment, setEnvironment] = useState('All environments');
  const all = query.data;
  const end = new Date(today + 'T12:00:00');
  const months = range === 'Month' ? 1 : range === '3 months' ? 3 : 12;
  // Clamp the month anniversary rather than overflow e.g. March 31 into March again.
  const start = new Date(end.getFullYear(), end.getMonth() - months, 1, 12);
  start.setDate(
    Math.min(end.getDate(), new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()),
  );
  const earliest = all
    ? [...all.exercises, ...all.climbing].map((x) => x.date).sort()[0]
    : undefined;
  const from = range === 'All time' ? (earliest ?? today) : dateKey(start);
  const data: ProgressData = {
    exercises: all?.exercises.filter((x) => x.date >= from && x.date <= today) ?? [],
    climbing: all?.climbing.filter((x) => x.date >= from && x.date <= today) ?? [],
  };
  const activity = weeklyActivity(data, from, today);
  const exercises = [
    ...new Map(
      all?.exercises.map((x) => [x.exerciseId, { id: x.exerciseId, name: x.name }]) ?? [],
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const chosen = exercises.find((x) => x.id === exerciseId) ?? exercises[0];
  const exerciseDays = data.exercises.filter((x) => x.exerciseId === chosen?.id);
  const colors = [c.accent, c.syntax.keyword, c.syntax.number];
  const sides = ['Both', 'Left', 'Right'] as const;
  const exerciseSeries: ChartSeries[] = sides
    .filter((s) => side === 'All sides' || side === s)
    .map((s, i) => ({
      name: s === 'Both' ? 'Unsplit' : s,
      color: colors[i],
      points: groupPoints(
        exerciseDays.filter((x) => x.side === s),
        (x) => x.date,
        (x) =>
          metric === 'Heaviest weight' ? x.maxWeightKg : metric === 'Reps' ? x.reps : x.volumeKg,
        metric === 'Heaviest weight' ? 'max' : 'sum',
      ),
    }))
    .filter((s) => s.points.length);
  const climbs = data.climbing.filter(
    (x) =>
      x.climbingType === type &&
      x.gradeSystem === system &&
      (environment === 'All environments' || x.environment === environment),
  );
  const gradeCounts = climbingGrades[system]
    .map((grade) => ({
      grade,
      sends: climbs.filter((x) => x.grade === grade).reduce((sum, x) => sum + x.sends, 0),
    }))
    .filter((x) => x.sends);
  const gradeMax = Math.max(1, ...gradeCounts.map((x) => x.sends));
  const records = weightRecords(all?.exercises ?? [])
    .filter((x) => x.date >= from && x.date <= today)
    .reverse()
    .slice(0, 5);
  const hasData = data.exercises.length > 0 || data.climbing.length > 0;
  const summary = [
    ['Workout days', new Set(data.exercises.map((x) => x.date)).size],
    ['Working sets', data.exercises.reduce((sum, x) => sum + x.sets, 0)],
    ['Climbing days', new Set(data.climbing.map((x) => x.date)).size],
    ['Climbs sent', data.climbing.reduce((sum, x) => sum + x.sends, 0)],
  ] as const;
  return (
    <Page scrollRef={scrollRef}>
      <Heading large>Progress</Heading>
      <Choices values={['Overview', 'Exercises', 'Climbing']} selected={tab} onChange={setTab} />
      <Choices
        values={['Month', '3 months', 'Year', 'All time']}
        selected={range}
        onChange={setRange}
      />
      <Label small muted>
        {from} – {today}
      </Label>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <>
          <ErrorNotice message={errorMessage(query.error)} />
          <Button title="Retry" onPress={() => void query.refetch()} />
        </>
      ) : (
        <>
          {!hasData && (
            <Card>
              <Label>No logged activity in this period.</Label>
              <Label small muted>
                Log working sets or climbs, or select a longer period.
              </Label>
            </Card>
          )}
          {tab === 'Overview' && (
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
                      {x.date}
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
                {!data.climbing.some((x) => x.sends > 0) && (
                  <Label muted>No sends in this period.</Label>
                )}
              </Card>
            </>
          )}
          {tab === 'Exercises' && (
            <>
              {!exercises.length ? (
                <Label>No exercises with logged working sets yet.</Label>
              ) : (
                <>
                  <Card>
                    <Label syntax="name">Exercise</Label>
                    {!!chosen && (
                      <Button
                        title={chosen.name}
                        accessibilityLabel="Choose progress exercise"
                        variant="secondary"
                        onPress={() => setChoosing(!choosing)}
                      />
                    )}
                    {choosing && (
                      <>
                      <SearchField
                        scrollRef={scrollRef}
                          label="Search exercises"
                          value={search}
                          onChangeText={setSearch}
                          placeholder="Exercise name"
                        />
                        {exercises
                          .filter((x) => x.name.toLowerCase().includes(search.trim().toLowerCase()))
                          .map((x) => (
                            <Button
                              key={x.id}
                              title={x.name}
                              accessibilityLabel={`Select progress exercise ${x.name}`}
                              variant={x.id === chosen?.id ? 'primary' : 'secondary'}
                              selected={x.id === chosen?.id}
                              onPress={() => {
                                setExerciseId(x.id);
                                setChoosing(false);
                              }}
                            />
                          ))}
                        {!exercises.some((x) =>
                          x.name.toLowerCase().includes(search.trim().toLowerCase()),
                        ) && <Label muted>No matching exercises.</Label>}
                      </>
                    )}
                  </Card>
                  <Choices
                    values={['Heaviest weight', 'Reps', 'Volume']}
                    selected={metric}
                    onChange={setMetric}
                  />
                  <Choices
                    values={['All sides', 'Both', 'Left', 'Right']}
                    selected={side}
                    onChange={setSide}
                    label={(x) => (x === 'Both' ? 'Unsplit' : x)}
                  />
                  <ProgressChart
                    key={`${chosen?.id}:${metric}:${side}:${range}`}
                    title={`${chosen?.name} · ${metric}`}
                    subtitle={
                      metric === 'Heaviest weight'
                        ? 'Maximum working weight per day · kg'
                        : metric === 'Reps'
                          ? 'Total working reps per day'
                          : 'Sum of weight × reps per day · kg · excludes body weight'
                    }
                    series={exerciseSeries}
                    format={(value) => `${count(value)}${metric === 'Reps' ? '' : ' kg'}`}
                  />
                  <Label small muted>
                    Warm-ups are excluded. Recorded sets count even before a workout is marked
                    complete. Left and right are never combined.
                  </Label>
                </>
              )}
            </>
          )}
          {tab === 'Climbing' && (
            <>
              <Choices
                values={climbingTypes}
                selected={type}
                onChange={(value) => {
                  setType(value);
                  setSystem(systemsForType(value)[0]);
                  if (value !== 'Bouldering' && environment === 'Board')
                    setEnvironment('All environments');
                }}
                label={climbingLabel}
              />
              <Choices
                values={systemsForType(type)}
                selected={system}
                onChange={setSystem}
                label={climbingLabel}
              />
              <Choices
                values={[
                  'All environments',
                  ...climbingEnvironments.filter((x) => x !== 'Board' || type === 'Bouldering'),
                ]}
                selected={environment}
                onChange={setEnvironment}
              />
              <ProgressChart
                key={`${type}:${system}:${environment}:${range}`}
                title="Hardest grade sent"
                subtitle="Best successful climb each day · attempted climbs excluded · gaps mean no sends"
                ordinal
                format={(value) => climbingGrades[system][Math.round(value) - 1] ?? '—'}
                series={[
                  {
                    name: climbingLabel(system),
                    color: c.accent,
                    points: hardestSends(climbs, system),
                  },
                ]}
              />
              <Card>
                <Label syntax="name">Sends by grade</Label>
                {gradeCounts.length ? (
                  gradeCounts.map((x) => (
                    <View
                      key={x.grade}
                      style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
                    >
                      <View style={{ width: 50 }}>
                        <Label small>{x.grade}</Label>
                      </View>
                      <View
                        style={{ flex: 1, height: 18, backgroundColor: c.soft, borderRadius: 3 }}
                      >
                        <View
                          style={{
                            width: `${(100 * x.sends) / gradeMax}%`,
                            height: 18,
                            backgroundColor: c.accent,
                            borderRadius: 3,
                          }}
                        />
                      </View>
                      <Label small>{x.sends}</Label>
                    </View>
                  ))
                ) : (
                  <Label muted>No sends for this selection.</Label>
                )}
              </Card>
              <ProgressChart
                title="Weekly sends"
                bars
                series={[
                  {
                    name: 'Sends',
                    color: c.syntax.number,
                    points: groupPoints(
                      climbs,
                      (x) => weekKey(x.date),
                      (x) => x.sends,
                    ),
                  },
                ]}
              />
              <ProgressChart
                title="Flash rate"
                subtitle="Flashes ÷ all logged climbs each week · includes unsent climbs · onsights are not flashes"
                ceiling={100}
                format={(value) => `${count(value)}%`}
                series={[
                  { name: 'Flash rate', color: c.syntax.keyword, points: flashRates(climbs) },
                ]}
              />
              <Label small muted>
                Grade systems are shown separately. Grade steps are ordinal, not equal increments of
                difficulty.
              </Label>
            </>
          )}
        </>
      )}
    </Page>
  );
}
