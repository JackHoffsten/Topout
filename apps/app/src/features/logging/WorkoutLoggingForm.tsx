import { WorkoutSetEditor } from './WorkoutSetEditor';
import { workoutLoggingKey } from './queries';
import {
  completionExercises,
  restoreWorkoutDraft,
  draftSetFromActual,
  draftDefaults,
  valueOrDefault,
  blankSet,
  signature,
  reconcileRecordedSet,
  splitDraftSet,
  mergeDraftSet,
  type DraftSet,
  type DraftExercise,
} from './workoutDraft';
import { refreshTraining } from '../training/queries';
import { useRef, useState } from 'react';
import { Pressable, View, type ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  completeWorkoutInputSchema,
  recordWorkoutSetSchema,
  errorMessage,
  type WorkoutLogging,
  type Exercise,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Field } from '../../ui/components/Field';
import { SearchField } from '../../ui/components/SearchField';
import { LocationField } from '../../ui/components/LocationField';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Loading } from '../../ui/components/Loading';
import { Page } from '../../ui/components/Page';
import { useExercises } from '../exercises/queries';
import { templatesKey } from '../templates/queries';
import {
  templateFromLog,
  templateFromLoggedSet,
  type TemplateSetSelection,
} from './templateFromLog';
import { displayDate } from '../../lib/dates';

export function WorkoutLoggingForm({ workout }: { workout: WorkoutLogging }) {
  const defaults = (exerciseId: number, set: DraftSet) => draftDefaults(workout, exerciseId, set);
  const router = useRouter();

  const { api } = useSession();
  const cache = useQueryClient();
  const available = useExercises();
  const [items, setItems] = useState<DraftExercise[]>(() => restoreWorkoutDraft(workout));
  const [notes, setNotes] = useState(workout.log?.notes ?? '');
  const [location, setLocation] = useState(workout.log?.location ?? '');
  const scrollRef = useRef<ScrollView>(null);
  const saveLocation = useMutation({
    mutationFn: (value: string) => api.setWorkoutLocation(workout.scheduleId, value.trim() || null),
    onSuccess: async (response) => {
      cache.setQueryData(workoutLoggingKey(workout.scheduleId), response);
      await refreshTraining(cache, 'workout');
    },
  });
  const [editing, setEditing] = useState(!workout.log?.completedAt);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [removingExercise, setRemovingExercise] = useState<DraftExercise>();
  const [normalSet, setNormalSet] = useState<{ exerciseId: number; order: number }>();
  const [replacingExercise, setReplacingExercise] = useState<DraftExercise>();
  const [replacementChoice, setReplacementChoice] = useState<Exercise>();
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
      cache.setQueryData(workoutLoggingKey(workout.scheduleId), response);
      setEditing(false);
      setDirty(false);
      await refreshTraining(cache, 'workout');
    },
  });
  const record = useMutation({
    mutationFn: (input: Parameters<typeof api.recordWorkoutSet>[1]) =>
      api.recordWorkoutSet(workout.scheduleId, input),
    onSuccess: async (response, input) => {
      setItems((current) => reconcileRecordedSet(current, input));
      cache.setQueryData(workoutLoggingKey(workout.scheduleId), response);
      await refreshTraining(cache, 'workout');
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
      cache.setQueryData(workoutLoggingKey(workout.scheduleId), response);
      await refreshTraining(cache, 'workout');
    },
  });
  const removeExercise = useMutation({
    mutationFn: (exerciseId: number) => api.removeWorkoutExercise(workout.scheduleId, exerciseId),
    onSuccess: async (response, exerciseId) => {
      setItems((current) => current.filter((item) => item.exercise.id !== exerciseId));
      setRemovingExercise(undefined);
      setErrors({});
      cache.setQueryData(workoutLoggingKey(workout.scheduleId), response);
      await refreshTraining(cache, 'workout');
    },
  });
  const replaceExercise = useMutation({
    mutationFn: ({ item, replacement }: { item: DraftExercise; replacement: Exercise }) =>
      api.replaceWorkoutExercise(workout.scheduleId, item.exercise.id, {
        replacementExerciseId: replacement.id,
        order: items.findIndex((entry) => entry.exercise.id === item.exercise.id) + 1,
        sets: (
          items.find((entry) => entry.exercise.id === item.exercise.id)?.sets ?? item.sets
        ).map((set) => ({ order: set.order, side: set.side, isWarmup: set.warmup })),
      }),
    onSuccess: async (response, { item, replacement }) => {
      const recorded =
        response.log?.exercises.find((entry) => entry.exercise.id === replacement.id)?.sets ?? [];
      setItems((current) =>
        current.map((entry) =>
          entry.exercise.id !== item.exercise.id
            ? entry
            : {
                exercise: replacement,
                sets: entry.sets.map((set) => {
                  const saved = recorded.find(
                    (result) => result.order === set.order && result.side === set.side,
                  );
                  return draftSetFromActual(saved, {
                    ...set,
                    target: undefined,
                    reps: '',
                    weight: '',
                    saved: undefined,
                  });
                }),
              },
        ),
      );
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.delete(item.exercise.id)) next.add(replacement.id);
        return next;
      });
      setReplacingExercise(undefined);
      setReplacementChoice(undefined);
      setPicker(false);
      setSearch('');
      setErrors({});
      cache.setQueryData(workoutLoggingKey(workout.scheduleId), response);
      await refreshTraining(cache, 'workout');
    },
  });
  const busy =
    replaceExercise.isPending ||
    removeExercise.isPending ||
    save.isPending ||
    record.isPending ||
    remove.isPending ||
    updateTemplateSet.isPending ||
    saveLocation.isPending;
  const logSet = (i: number, j: number) => {
    const set = items[i]!.sets[j]!;
    const fallback = defaults(items[i]!.exercise.id, set);
    const parsed = recordWorkoutSetSchema.safeParse({
      location: location.trim(),
      exerciseId: items[i]!.exercise.id,
      order: set.order,
      side: set.side,
      reps: valueOrDefault(set.reps, fallback.reps),
      weightKg: valueOrDefault(set.weight, fallback.weight),
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
    setItems((current) => mergeDraftSet(current, exerciseId, order));
    setNormalSet(undefined);
    changed();
  };
  const finish = () => {
    const parsed = completeWorkoutInputSchema.safeParse({
      notes: notes.trim() || null,
      location: location.trim() || null,
      exercises: completionExercises(workout, items),
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
    <Page scrollRef={scrollRef}>
      <Heading large>
        {workout.log?.completedAt ? (editing ? 'Edit workout' : 'Workout log') : 'Log workout'}
      </Heading>
      <Heading name>{workout.templateName ?? 'Workout'}</Heading>
      <Label muted>
        {displayDate(workout.date, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </Label>
      {workout.log?.completedAt && !editing ? (
        <>
          <Label syntax="keyword">Completed</Label>
          {!!workout.log.location && <Label>Location: {workout.log.location}</Label>}
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
              setItems(restoreWorkoutDraft(workout));
              setNotes(workout.log?.notes ?? '');
              setLocation(workout.log?.location ?? '');
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
          <LocationField
            scrollRef={scrollRef}
            activity="workout"
            value={location}
            disabled={busy || saveLocation.isPending}
            onSelect={(value) => saveLocation.mutate(value)}
            onChange={(value) => {
              setLocation(value);
              changed();
            }}
          />
          <Button
            title="Save location"
            variant="secondary"
            busy={saveLocation.isPending}
            disabled={busy || location.trim() === (workout.log?.location ?? '')}
            onPress={() => saveLocation.mutate(location)}
          />
          <ErrorNotice
            message={saveLocation.isError ? errorMessage(saveLocation.error) : undefined}
          />
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
                  {item.sets.map((set, j) => (
                    <WorkoutSetEditor
                      key={`${set.order}-${set.side}`}
                      workout={workout}
                      item={item}
                      set={set}
                      exerciseIndex={i}
                      setIndex={j}
                      busy={busy}
                      errors={errors}
                      actions={{
                        change: (patch) => changeSet(i, j, patch),
                        record: () => logSet(i, j),
                        toggleSplit: () => {
                          const group = item.sets.filter((s) => s.order === set.order);
                          if (group.some((s) => !!s.saved)) return;
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
                          setItems((current) =>
                            splitDraftSet(current, item.exercise.id, set.order),
                          );
                          changed();
                        },
                        remove: () => {
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
                        },
                        updateTemplate: () =>
                          selectTemplateSet({
                            exerciseId: item.exercise.id,
                            order: set.order,
                            side: set.side,
                          }),
                      }}
                    />
                  ))}
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
                      title="Replace exercise"
                      accessibilityLabel={`Replace ${item.exercise.name}`}
                      variant="secondary"
                      disabled={busy}
                      onPress={() => {
                        replaceExercise.reset();
                        setReplacingExercise(item);
                        setReplacementChoice(undefined);
                        setSearch('');
                        setPicker(true);
                      }}
                    />
                    <Button
                      title="Remove exercise"
                      accessibilityLabel={`Remove ${item.exercise.name}`}
                      variant="secondary"
                      disabled={busy}
                      onPress={() => {
                        removeExercise.reset();
                        setRemovingExercise(item);
                      }}
                    />
                  </View>
                </>
              )}
            </Card>
          ))}
          {picker ? (
            <Card>
              <SearchField
                label="Search exercises"
                value={search}
                onChangeText={setSearch}
                autoFocus={!!replacingExercise}
              />
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
                        accessibilityLabel={`${replacingExercise ? 'Replace with' : 'Add'} ${exercise.name}`}
                        variant="secondary"
                        disabled={busy}
                        onPress={() => {
                          if (replacingExercise) {
                            if (
                              workout.log?.exercises.some(
                                (entry) =>
                                  entry.exercise.id === replacingExercise.exercise.id &&
                                  entry.sets.length > 0,
                              )
                            ) {
                              setReplacementChoice(exercise);
                              setPicker(false);
                            } else
                              replaceExercise.mutate({
                                item: replacingExercise,
                                replacement: exercise,
                              });
                            return;
                          }
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
                disabled={busy}
                onPress={() => {
                  setPicker(false);
                  setReplacingExercise(undefined);
                  setReplacementChoice(undefined);
                }}
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
          {!replacementChoice && (
            <ErrorNotice
              message={replaceExercise.isError ? errorMessage(replaceExercise.error) : undefined}
            />
          )}
          {replaceExercise.isError && !replacementChoice && replacingExercise && (
            <Label muted>Choose an exercise again to retry replacement.</Label>
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
                void cache.invalidateQueries({ queryKey: workoutLoggingKey(workout.scheduleId) });
              }}
            />
          )}
          <Label small muted>
            {workout.log?.completedAt
              ? 'Save set, exercise replacements and confirmed exercise removals save immediately. Save changes also saves notes and other exercise changes.'
              : 'Blank fields use the shown previous or planned values. Log each set to save it immediately. Remove sets you did not complete before finishing.'}
          </Label>
          <Button
            title={workout.log?.completedAt ? 'Save changes' : 'Finish workout'}
            busy={save.isPending}
            disabled={busy}
            onPress={finish}
          />
          <Button
            title="Cancel"
            variant="secondary"
            disabled={busy}
            onPress={() => (dirty ? setDiscard(true) : router.replace('/calendar'))}
          />
          <ConfirmDialog
            visible={!!replacementChoice}
            title={`Replace ${replacingExercise?.exercise.name ?? 'exercise'} with ${replacementChoice?.name ?? 'exercise'}?`}
            description="Logged sets will be relabelled to the replacement exercise. Their reps, weight, warm-up flags and notes will be kept. This change saves immediately and leaves the template unchanged."
            confirmLabel="Confirm replacement"
            cancelLabel="Keep original exercise"
            busy={replaceExercise.isPending}
            error={replaceExercise.isError ? errorMessage(replaceExercise.error) : undefined}
            onCancel={() => {
              setReplacementChoice(undefined);
              setReplacingExercise(undefined);
              replaceExercise.reset();
            }}
            onConfirm={() => {
              if (replacingExercise && replacementChoice)
                replaceExercise.mutate({ item: replacingExercise, replacement: replacementChoice });
            }}
          />
          <ConfirmDialog
            visible={!!removingExercise}
            title={`Remove ${removingExercise?.exercise.name ?? 'exercise'}?`}
            description={`This exercise will be removed from this workout immediately.${workout.log?.exercises.some((entry) => entry.exercise.id === removingExercise?.exercise.id && entry.sets.length > 0) ? ' Its logged sets will also be deleted.' : ''}`}
            confirmLabel="Confirm removal"
            cancelLabel="Keep exercise"
            busy={removeExercise.isPending}
            error={removeExercise.isError ? errorMessage(removeExercise.error) : undefined}
            onCancel={() => setRemovingExercise(undefined)}
            onConfirm={() => {
              if (removingExercise) removeExercise.mutate(removingExercise.exercise.id);
            }}
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
