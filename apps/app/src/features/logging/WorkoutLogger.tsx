import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeWorkoutInputSchema,
  recordWorkoutSetSchema,
  errorMessage,
  type Exercise,
  type PlannedSet,
  type WorkoutLogging,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Field } from '../../ui/components/Field';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Loading } from '../../ui/components/Loading';
import { Page } from '../../ui/components/Page';
import { useDesktop } from '../../ui/theme';
import { useExercises } from '../exercises/queries';
import { templatesKey } from '../templates/queries';
import {
  templateFromLog,
  templateFromLoggedSet,
  type TemplateSetSelection,
} from './templateFromLog';

type DraftSet = {
  side: 'Both' | 'Left' | 'Right';
  reps: string;
  weight: string;
  warmup: boolean;
  notes: string;
  target?: PlannedSet;
  order: number;
  saved?: string;
};
type DraftExercise = { exercise: Exercise; sets: DraftSet[] };
const blankSet = (target?: PlannedSet, order = 1): DraftSet => ({
  side: 'Both',
  reps: '',
  weight: '',
  warmup: target?.isWarmup ?? false,
  notes: '',
  target,
  order,
});
const signature = (set: DraftSet) =>
  JSON.stringify([set.reps, set.weight, set.warmup, set.notes, set.side]);
function initialItems(workout: WorkoutLogging): DraftExercise[] {
  const recorded = workout.log?.exercises ?? [];
  const sources = workout.log?.completedAt
    ? recorded
    : [
        ...(workout.template?.exercises ?? []),
        ...recorded.filter(
          (e) => !workout.template?.exercises.some((t) => t.exercise.id === e.exercise.id),
        ),
      ];
  return sources.map((item) => {
    const actual = recorded.find((e) => e.exercise.id === item.exercise.id)?.sets ?? [];
    const targets = workout.log?.completedAt
      ? []
      : (workout.template?.exercises.find((e) => e.exercise.id === item.exercise.id)?.sets ?? []);
    const orders = workout.log?.completedAt
      ? [...new Set(actual.map((s) => s.order))]
      : Array.from(
          { length: Math.max(targets.length, ...actual.map((s) => s.order), 1) },
          (_, i) => i + 1,
        );
    return {
      exercise: item.exercise,
      sets: orders.flatMap((order) => {
        const results = actual.filter((s) => s.order === order);
        const planned = targets[order - 1];
        const sides: DraftSet['side'][] =
          results.some((s) => (s.side ?? 'Both') !== 'Both') ||
          (!results.length && !!planned?.rightTarget)
            ? workout.log?.completedAt
              ? results.map((s) => s.side)
              : ['Left', 'Right']
            : ['Both'];
        return sides.map((side) => {
          const target =
            side === 'Right' && planned?.rightTarget
              ? { ...planned, ...planned.rightTarget }
              : planned;
          const set = actual.find((s) => s.order === order && (s.side ?? 'Both') === side);
          const draft = set
            ? {
                reps: String(set.reps),
                side,
                weight: String(set.weightKg),
                warmup: set.isWarmup,
                notes: set.notes ?? '',
                order,
                target,
              }
            : { ...blankSet(target, order), side };
          return set ? { ...draft, saved: signature(draft) } : draft;
        });
      }),
    };
  });
}
const key = (id: number) => ['workout-logging', id];

export function WorkoutLogger({ scheduleId }: { scheduleId: number }) {
  const { api } = useSession();
  const query = useQuery({
    queryKey: key(scheduleId),
    queryFn: () => api.getWorkoutLogging(scheduleId),
    enabled: Number.isSafeInteger(scheduleId) && scheduleId > 0,
  });
  const router = useRouter();
  if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0)
    return (
      <Page>
        <Heading>Workout not found</Heading>
        <Button title="Back to Calendar" onPress={() => router.replace('/calendar')} />
      </Page>
    );
  if (query.isPending) return <Loading text="Loading workout…" />;
  if (query.isError)
    return (
      <Page>
        <ErrorNotice message={errorMessage(query.error)} />
        <Button
          title="Try again"
          onPress={() => {
            void query.refetch();
          }}
        />
        <Button title="Back to Calendar" onPress={() => router.replace('/calendar')} />
      </Page>
    );
  return <LoggingForm key={scheduleId} workout={query.data} />;
}

function LoggingForm({ workout }: { workout: WorkoutLogging }) {
  const router = useRouter();
  const wide = useDesktop();
  const { api } = useSession();
  const cache = useQueryClient();
  const available = useExercises();
  const [items, setItems] = useState<DraftExercise[]>(() => initialItems(workout));
  const [notes, setNotes] = useState(workout.log?.notes ?? '');
  const [editing, setEditing] = useState(!workout.log?.completedAt);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [normalSet, setNormalSet] = useState<{ exerciseId: number; order: number }>();
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [confirmTemplate, setConfirmTemplate] = useState(false);
  const [templateSet, setTemplateSet] = useState<TemplateSetSelection>();
  const updateTemplateSet = useMutation({
    mutationFn: async (selection: TemplateSetSelection) => {
      const current = await api.getWorkoutLogging(workout.scheduleId);
      const input = templateFromLoggedSet(current, selection);
      if (!input || current.template?.id !== workout.template?.id)
        throw new Error('The saved set no longer matches the template.');
      return api.updateWorkoutTemplate(current.template!.id, input);
    },
    onSuccess: async () => {
      setTemplateSet(undefined);
      await Promise.all([
        cache.invalidateQueries({ queryKey: templatesKey }),
        cache.invalidateQueries({ queryKey: ['workout-logging'] }),
        cache.invalidateQueries({ queryKey: ['workout-schedule'] }),
      ]);
    },
  });
  const selectTemplateSet = (selection: TemplateSetSelection) => {
    updateTemplateSet.reset();
    setTemplateSet(selection);
  };
  const updateTemplate = useMutation({
    mutationFn: async () => {
      // Recheck persisted data rather than using draft edits or an old cached template.
      const current = await api.getWorkoutLogging(workout.scheduleId);
      const input = templateFromLog(current);
      if (!input || current.template?.id !== workout.template?.id)
        throw new Error('The saved workout no longer matches the template.');
      return api.updateWorkoutTemplate(current.template!.id, input);
    },
    onSuccess: async () => {
      setConfirmTemplate(false);
      await Promise.all([
        cache.invalidateQueries({ queryKey: templatesKey }),
        cache.invalidateQueries({ queryKey: ['workout-logging'] }),
        cache.invalidateQueries({ queryKey: ['workout-schedule'] }),
      ]);
    },
  });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof api.completeWorkout>[1]) =>
      workout.log?.completedAt
        ? api.updateWorkout(workout.scheduleId, input)
        : api.completeWorkout(workout.scheduleId, input),
    onSuccess: async (response) => {
      cache.setQueryData(key(workout.scheduleId), response);
      setEditing(false);
      setDirty(false);
      await cache.invalidateQueries({ queryKey: ['progress'] });
      await cache.invalidateQueries({ queryKey: ['workout-schedule'] });
    },
  });
  const record = useMutation({
    mutationFn: (input: Parameters<typeof api.recordWorkoutSet>[1]) =>
      api.recordWorkoutSet(workout.scheduleId, input),
    onSuccess: async (response, input) => {
      setItems((current) =>
        current.map((item) =>
          item.exercise.id === input.exerciseId
            ? {
                ...item,
                sets: item.sets.map((set) =>
                  set.order === input.order && set.side === input.side
                    ? { ...set, saved: signature(set) }
                    : set,
                ),
              }
            : item,
        ),
      );
      cache.setQueryData(key(workout.scheduleId), response);
      await cache.invalidateQueries({ queryKey: ['progress'] });
      await cache.invalidateQueries({ queryKey: ['workout-schedule'] });
    },
  });
  const remove = useMutation({
    mutationFn: ({
      exerciseId,
      order,
      side,
    }: {
      exerciseId: number;
      order: number;
      side: DraftSet['side'];
    }) => api.removeWorkoutSet(workout.scheduleId, exerciseId, order, side),
    onSuccess: async (response, input) => {
      setItems((current) =>
        current.map((item) =>
          item.exercise.id === input.exerciseId
            ? {
                ...item,
                sets: item.sets.filter(
                  (set) => set.order !== input.order || set.side !== input.side,
                ),
              }
            : item,
        ),
      );
      cache.setQueryData(key(workout.scheduleId), response);
      await cache.invalidateQueries({ queryKey: ['progress'] });
      await cache.invalidateQueries({ queryKey: ['workout-schedule'] });
    },
  });
  const busy =
    save.isPending || record.isPending || remove.isPending || updateTemplateSet.isPending;
  const logSet = (i: number, j: number) => {
    const set = items[i]!.sets[j]!;
    const parsed = recordWorkoutSetSchema.safeParse({
      exerciseId: items[i]!.exercise.id,
      order: set.order,
      side: set.side,
      reps: set.reps.trim() ? Number(set.reps.replace(',', '.')) : NaN,
      weightKg: set.weight.trim() ? Number(set.weight.replace(',', '.')) : NaN,
      isWarmup: set.warmup,
      notes: set.notes.trim() || null,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            `exercises.${i}.sets.${j}.${String(issue.path[0])}`,
            issue.message,
          ]),
        ),
      );
      return;
    }
    setErrors({});
    record.mutate(parsed.data);
  };
  const changed = () => {
    setDirty(true);
    setErrors({});
    save.reset();
    record.reset();
    remove.reset();
  };
  const changeSet = (i: number, j: number, patch: Partial<DraftSet>) => {
    setItems(
      items.map((item, index) =>
        index === i
          ? { ...item, sets: item.sets.map((set, n) => (n === j ? { ...set, ...patch } : set)) }
          : item,
      ),
    );
    changed();
  };
  const useNormalSet = (exerciseId: number, order: number) => {
    setItems((current) =>
      current.map((item) => {
        if (item.exercise.id !== exerciseId) return item;
        const group = item.sets.filter((set) => set.order === order);
        const kept = group.find((set) => set.side === 'Left') ?? group[0];
        if (!kept) return item;
        const first = item.sets.findIndex((set) => set.order === order);
        return {
          ...item,
          sets: item.sets.flatMap((set, index) =>
            set.order !== order
              ? [set]
              : index === first
                ? [
                    {
                      ...kept,
                      side: 'Both' as const,
                      saved: undefined,
                      target: kept.target ? { ...kept.target, rightTarget: null } : undefined,
                    },
                  ]
                : [],
          ),
        };
      }),
    );
    setNormalSet(undefined);
    changed();
  };
  const finish = () => {
    const number = (value: string) => (value.trim() ? Number(value.replace(',', '.')) : NaN);
    const parsed = completeWorkoutInputSchema.safeParse({
      notes: notes.trim() || null,
      exercises: items
        .map((item) => ({
          exerciseId: item.exercise.id,
          sets: item.sets
            .filter((set) => set.saved || set.reps.trim())
            .map((set) => ({
              reps: number(set.reps),
              order: set.order,
              side: set.side,
              weightKg: number(set.weight),
              isWarmup: set.warmup,
              notes: set.notes.trim() || null,
            })),
        }))
        .filter((item) => item.sets.length > 0),
    });
    if (!parsed.success) {
      setCollapsed(new Set());
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      );
      return;
    }
    save.mutate(parsed.data);
  };
  return (
    <Page>
      <Heading large>
        {workout.log?.completedAt ? (editing ? 'Edit workout' : 'Workout log') : 'Log workout'}
      </Heading>
      <Heading name>{workout.templateName ?? 'Workout'}</Heading>
      <Label muted>
        {new Date(`${workout.date}T12:00:00`).toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </Label>
      {workout.log?.completedAt && !editing ? (
        <>
          <Label syntax="keyword">Completed</Label>
          {workout.log.exercises.map((item) => (
            <Card key={item.exercise.id}>
              <Heading name>{item.exercise.name}</Heading>
              {item.sets.map((set, index) => (
                <View key={index} style={{ gap: 4 }}>
                  <Label>
                    <Label syntax="property">Set </Label>
                    <Label syntax="number">{set.order}</Label>
                    {set.side !== 'Both' && ` · ${set.side}`}
                    {': '}
                    <Label syntax="number">{set.reps}</Label>
                    <Label syntax="string"> reps</Label>
                    {' · '}
                    <Label syntax="number">{set.weightKg}</Label>
                    <Label syntax="string"> kg</Label>
                    {set.isWarmup && <Label syntax="keyword"> · Warm-up</Label>}
                  </Label>
                  {!!set.notes && (
                    <Label muted small>
                      {set.notes}
                    </Label>
                  )}
                  {workout.template && (
                    <Button
                      title="Update template set"
                      accessibilityLabel={`Update template ${item.exercise.name} set ${set.order}${(set.side ?? 'Both') === 'Both' ? '' : ` ${set.side.toLowerCase()}`}`}
                      variant="secondary"
                      disabled={
                        busy ||
                        !templateFromLoggedSet(workout, {
                          exerciseId: item.exercise.id,
                          order: set.order,
                          side: set.side ?? 'Both',
                        })
                      }
                      onPress={() =>
                        selectTemplateSet({
                          exerciseId: item.exercise.id,
                          order: set.order,
                          side: set.side ?? 'Both',
                        })
                      }
                    />
                  )}
                </View>
              ))}
            </Card>
          ))}
          {!!workout.log.notes && (
            <Card>
              <Label syntax="property">Notes</Label>
              <Label>{workout.log.notes}</Label>
            </Card>
          )}
          <Button
            title="Edit workout"
            disabled={busy || updateTemplate.isPending}
            onPress={() => {
              setItems(initialItems(workout));
              setNotes(workout.log?.notes ?? '');
              setEditing(true);
            }}
          />
          {workout.template && (
            <>
              <Button
                title="Update template"
                variant="secondary"
                disabled={busy || !templateFromLog(workout) || updateTemplate.isPending}
                onPress={() => {
                  updateTemplate.reset();
                  setConfirmTemplate(true);
                }}
              />
              {!templateFromLog(workout) && (
                <Label small muted>
                  To update the template, exercises, set positions, and left/right splits must
                  match.
                </Label>
              )}
              {updateTemplate.isSuccess && <Label>Template updated.</Label>}
              {!confirmTemplate && (
                <ErrorNotice
                  message={updateTemplate.isError ? updateTemplate.error.message : undefined}
                />
              )}
              <ConfirmDialog
                visible={confirmTemplate}
                title="Update template from log?"
                description="Replace template reps and weights with saved results. Rep ranges become exact reps. Warm-up and AMRAP flags stay unchanged. Other dates using this template will show the new targets; saved logs stay unchanged."
                confirmLabel="Confirm update"
                cancelLabel="Cancel"
                error={updateTemplate.isError ? updateTemplate.error.message : undefined}
                busy={updateTemplate.isPending}
                onCancel={() => setConfirmTemplate(false)}
                onConfirm={() => updateTemplate.mutate()}
              />
            </>
          )}
          <Button title="Back to Calendar" onPress={() => router.replace('/calendar')} />
        </>
      ) : (
        <>
          <Label muted>Enter the sets you completed. Use 0 kg for bodyweight exercises.</Label>
          {items.map((item, i) => (
            <Card key={item.exercise.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${collapsed.has(item.exercise.id) ? 'Expand' : 'Collapse'} ${item.exercise.name}`}
                accessibilityState={{ expanded: !collapsed.has(item.exercise.id) }}
                onPress={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(item.exercise.id)) next.delete(item.exercise.id);
                    else next.add(item.exercise.id);
                    return next;
                  })
                }
              >
                <Heading name>{item.exercise.name}</Heading>
                <Label small muted>
                  <Label syntax="number" small>
                    {new Set(item.sets.map((set) => set.order)).size}
                  </Label>{' '}
                  sets {collapsed.has(item.exercise.id) ? '▾' : '▴'}
                </Label>
              </Pressable>
              {!collapsed.has(item.exercise.id) && (
                <>
                  {item.sets.map((set, j) => {
                    const group = item.sets.filter((s) => s.order === set.order);
                    const firstSide = item.sets.findIndex((s) => s.order === set.order) === j;
                    const basePrefix = `${item.exercise.name} set ${set.order}`;
                    const recorded =
                      workout.log?.exercises
                        .find((e) => e.exercise.id === item.exercise.id)
                        ?.sets.filter((s) => s.order === set.order) ?? [];
                    const modeChanged =
                      !!recorded.length &&
                      recorded.some(
                        (s) => ((s.side ?? 'Both') === 'Both') !== (set.side === 'Both'),
                      );
                    const prefix = `${item.exercise.name} set ${set.order}${set.side === 'Both' ? '' : ` ${set.side.toLowerCase()}`}`;
                    const previous = workout.previousSets?.find(
                      (s) =>
                        s.exerciseId === item.exercise.id &&
                        s.order === set.order &&
                        (s.side ?? 'Both') === set.side,
                    );
                    return (
                      <View
                        key={`${set.order}-${set.side}`}
                        style={{ gap: 10, paddingVertical: 10 }}
                      >
                        <Label syntax="property">
                          Set <Label syntax="number">{set.order}</Label>
                          {set.side !== 'Both' && ` · ${set.side}`}
                        </Label>
                        {firstSide && (
                          <Button
                            title={set.side === 'Both' ? 'Split left/right' : 'Use normal set'}
                            accessibilityLabel={`${set.side === 'Both' ? 'Split' : 'Unsplit'} ${basePrefix} left/right`}
                            variant="secondary"
                            disabled={
                              busy || (group.some((s) => !!s.saved) && !workout.log?.completedAt)
                            }
                            onPress={() => {
                              if (set.side !== 'Both') {
                                const left = group.find((s) => s.side === 'Left') ?? group[0]!;
                                const right = group.find((s) => s.side === 'Right');
                                if (
                                  right &&
                                  signature({ ...right, side: 'Both' }) !==
                                    signature({ ...left, side: 'Both' }) &&
                                  (right.reps || right.weight || right.notes)
                                ) {
                                  setNormalSet({ exerciseId: item.exercise.id, order: set.order });
                                } else useNormalSet(item.exercise.id, set.order);
                                return;
                              }
                              setItems(
                                items.map((entry, n) =>
                                  n === i
                                    ? {
                                        ...entry,
                                        sets: entry.sets.flatMap((s, k) =>
                                          k === j
                                            ? [
                                                { ...s, side: 'Left' as const, saved: undefined },
                                                { ...s, side: 'Right' as const, saved: undefined },
                                              ]
                                            : [s],
                                        ),
                                      }
                                    : entry,
                                ),
                              );
                              changed();
                            }}
                          />
                        )}
                        {firstSide && group.some((s) => !!s.saved) && !workout.log?.completedAt && (
                          <Label small muted>
                            Remove logged results before changing the set type.
                          </Label>
                        )}
                        {firstSide && modeChanged && workout.log?.completedAt && (
                          <Label small muted>
                            Save changes to apply the set type.
                          </Label>
                        )}
                        {previous ? (
                          <Label small muted>
                            Last logged ({previous.date}):{' '}
                            <Label syntax="number" small>
                              {previous.reps}
                            </Label>{' '}
                            reps ·{' '}
                            <Label syntax="number" small>
                              {previous.weightKg}
                            </Label>{' '}
                            kg{previous.isWarmup ? ' · Warm-up' : ''}
                          </Label>
                        ) : (
                          set.target && (
                            <Label small muted>
                              Planned:{' '}
                              <Label syntax="number" small>
                                {set.target.targetRepsMin}
                                {set.target.targetRepsMax != null && `–${set.target.targetRepsMax}`}
                              </Label>{' '}
                              reps
                              {set.target.targetWeightKg != null && (
                                <>
                                  {' · '}
                                  <Label syntax="number" small>
                                    {set.target.targetWeightKg}
                                  </Label>{' '}
                                  kg
                                </>
                              )}
                              {set.target.isAmrap && ' · AMRAP'}
                            </Label>
                          )
                        )}
                        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Field
                              label="Reps"
                              accessibilityLabel={`${prefix} reps`}
                              value={set.reps}
                              onChangeText={(reps) => changeSet(i, j, { reps })}
                              keyboardType="number-pad"
                              editable={!busy}
                              error={errors[`exercises.${i}.sets.${j}.reps`]}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Field
                              label={set.side === 'Both' ? 'Weight (kg)' : 'Weight per side (kg)'}
                              accessibilityLabel={`${prefix} weight (kg)`}
                              value={set.weight}
                              onChangeText={(weight) => changeSet(i, j, { weight })}
                              keyboardType="decimal-pad"
                              editable={!busy}
                              error={errors[`exercises.${i}.sets.${j}.weightKg`]}
                            />
                          </View>
                        </View>
                        <Field
                          label="Set notes (optional)"
                          accessibilityLabel={`${prefix} notes`}
                          value={set.notes}
                          onChangeText={(notes) => changeSet(i, j, { notes })}
                          maxLength={2000}
                          editable={!busy}
                          error={errors[`exercises.${i}.sets.${j}.notes`]}
                        />
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          <Button
                            title={
                              set.saved === signature(set)
                                ? 'Logged'
                                : set.saved
                                  ? 'Save set'
                                  : 'Log set'
                            }
                            accessibilityLabel={`Log ${prefix}`}
                            disabled={busy || set.saved === signature(set) || modeChanged}
                            onPress={() => logSet(i, j)}
                          />
                          <Button
                            title={set.warmup ? 'Warm-up: on' : 'Warm-up: off'}
                            accessibilityLabel={`${prefix} toggle warm-up`}
                            variant="secondary"
                            disabled={busy}
                            onPress={() => changeSet(i, j, { warmup: !set.warmup })}
                          />
                          {set.saved && workout.template && (
                            <Button
                              title="Update template set"
                              accessibilityLabel={`Update template ${prefix}`}
                              variant="secondary"
                              disabled={
                                busy ||
                                set.saved !== signature(set) ||
                                !templateFromLoggedSet(workout, {
                                  exerciseId: item.exercise.id,
                                  order: set.order,
                                  side: set.side,
                                })
                              }
                              onPress={() =>
                                selectTemplateSet({
                                  exerciseId: item.exercise.id,
                                  order: set.order,
                                  side: set.side,
                                })
                              }
                            />
                          )}
                          <Button
                            title="Remove set"
                            accessibilityLabel={`Remove ${prefix}`}
                            variant="secondary"
                            disabled={busy}
                            onPress={() => {
                              if (set.saved) {
                                remove.mutate({
                                  exerciseId: item.exercise.id,
                                  order: set.order,
                                  side: set.side,
                                });
                                return;
                              }
                              setItems(
                                items.map((entry, n) =>
                                  n === i
                                    ? { ...entry, sets: entry.sets.filter((_, k) => k !== j) }
                                    : entry,
                                ),
                              );
                              changed();
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                  <ErrorNotice message={errors[`exercises.${i}.sets`]} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Button
                      title="Add set"
                      accessibilityLabel={`Add set to ${item.exercise.name}`}
                      variant="secondary"
                      disabled={busy || Math.max(0, ...item.sets.map((set) => set.order)) >= 100}
                      onPress={() => {
                        setItems(
                          items.map((entry, n) =>
                            n === i
                              ? {
                                  ...entry,
                                  sets: [
                                    ...entry.sets,
                                    {
                                      ...blankSet(
                                        undefined,
                                        Math.max(0, ...entry.sets.map((set) => set.order)) + 1,
                                      ),
                                      weight: entry.sets.at(-1)?.weight ?? '',
                                    },
                                  ],
                                }
                              : entry,
                          ),
                        );
                        changed();
                      }}
                    />
                    <Button
                      title="Remove exercise"
                      accessibilityLabel={`Remove ${item.exercise.name}`}
                      variant="secondary"
                      disabled={busy}
                      onPress={() => {
                        setItems(items.filter((_, n) => n !== i));
                        changed();
                      }}
                    />
                  </View>
                </>
              )}
            </Card>
          ))}
          {picker ? (
            <Card>
              <Field label="Search exercises" value={search} onChangeText={setSearch} />
              {available.isPending ? (
                <Loading text="Loading exercises…" />
              ) : available.isError ? (
                <>
                  <ErrorNotice message={errorMessage(available.error)} />
                  <Button
                    title="Retry exercises"
                    onPress={() => {
                      void available.refetch();
                    }}
                  />
                </>
              ) : (
                <>
                  {available.data
                    .filter(
                      (e) =>
                        !items.some((item) => item.exercise.id === e.id) &&
                        e.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((exercise) => (
                      <Button
                        key={exercise.id}
                        title={exercise.name}
                        accessibilityLabel={`Add ${exercise.name}`}
                        variant="secondary"
                        disabled={busy}
                        onPress={() => {
                          setItems([...items, { exercise, sets: [blankSet()] }]);
                          setPicker(false);
                          setSearch('');
                          changed();
                        }}
                      />
                    ))}
                  {!available.data.some(
                    (e) =>
                      !items.some((item) => item.exercise.id === e.id) &&
                      e.name.toLowerCase().includes(search.toLowerCase()),
                  ) && <Label muted>No exercises found.</Label>}
                </>
              )}
              <Button
                title="Close exercise picker"
                variant="secondary"
                onPress={() => setPicker(false)}
              />
            </Card>
          ) : (
            <Button
              title="Add exercise"
              variant="secondary"
              disabled={busy || items.length >= 100}
              onPress={() => setPicker(true)}
            />
          )}
          <Field
            label="Workout notes (optional)"
            value={notes}
            multiline
            maxLength={2000}
            editable={!busy}
            onChangeText={(value) => {
              setNotes(value);
              changed();
            }}
            error={errors.notes}
          />
          <ErrorNotice message={errors.exercises} />
          <ErrorNotice
            message={
              Object.keys(errors).length
                ? 'Enter reps and weight for each set, or remove sets you did not complete.'
                : undefined
            }
          />
          <ErrorNotice message={save.isError ? errorMessage(save.error) : undefined} />
          <ErrorNotice
            message={
              record.isError
                ? errorMessage(record.error)
                : remove.isError
                  ? errorMessage(remove.error)
                  : undefined
            }
          />
          {save.isError && (
            <Button
              title="Check saved workout"
              variant="secondary"
              onPress={() => {
                void cache.invalidateQueries({ queryKey: key(workout.scheduleId) });
              }}
            />
          )}
          <Label small muted>
            {workout.log?.completedAt
              ? 'Save set saves that set immediately. Save changes also saves notes and exercise changes.'
              : 'Log each set to save it immediately. Finish when done; empty sets are skipped.'}
          </Label>
          <Button
            title={workout.log?.completedAt ? 'Save changes' : 'Finish workout'}
            busy={save.isPending}
            disabled={record.isPending || remove.isPending || updateTemplateSet.isPending}
            onPress={finish}
          />
          <Button
            title="Cancel"
            variant="secondary"
            disabled={busy}
            onPress={() => (dirty ? setDiscard(true) : router.replace('/calendar'))}
          />
          <ConfirmDialog
            visible={discard}
            title="Discard workout?"
            description="Unsaved changes will be lost. Sets already logged are kept."
            confirmLabel="Discard workout"
            cancelLabel="Keep logging"
            busy={false}
            onCancel={() => setDiscard(false)}
            onConfirm={() => router.replace('/calendar')}
          />
          <ConfirmDialog
            visible={!!normalSet}
            title="Use a normal set?"
            description="Left-side values will be kept. Right-side values will be removed from this draft."
            confirmLabel="Confirm normal set"
            cancelLabel="Keep split set"
            busy={busy}
            onCancel={() => setNormalSet(undefined)}
            onConfirm={() => {
              if (normalSet) useNormalSet(normalSet.exerciseId, normalSet.order);
            }}
          />
        </>
      )}
      {updateTemplateSet.isSuccess && <Label>Template set updated.</Label>}
      {!templateSet && (
        <ErrorNotice
          message={updateTemplateSet.isError ? updateTemplateSet.error.message : undefined}
        />
      )}
      <ConfirmDialog
        visible={!!templateSet}
        title="Update template set?"
        description="Copy this saved set's reps and weight to its template target. Rep ranges become exact reps. Other sets and flags stay unchanged. For a split set, only the selected side changes."
        confirmLabel="Confirm set update"
        cancelLabel="Cancel"
        busy={updateTemplateSet.isPending}
        error={updateTemplateSet.isError ? updateTemplateSet.error.message : undefined}
        onCancel={() => setTemplateSet(undefined)}
        onConfirm={() => {
          if (templateSet) updateTemplateSet.mutate(templateSet);
        }}
      />
    </Page>
  );
}
