import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Exercise,
  type PlannedSet,
  type WorkoutTemplate,
  type WorkoutTemplateInput,
  workoutTemplateInputSchema,
  errorMessage,
  muscleLabel,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { Button } from '../../ui/components/Button';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Loading } from '../../ui/components/Loading';
import { Card } from '../../ui/components/Card';
import { Label } from '../../ui/components/Label';
import { Field } from '../../ui/components/Field';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { tokens, useDesktop, useTheme } from '../../ui/theme';
import { useAutoScroll } from '../../ui/useAutoScroll';
import { SearchField } from '../../ui/components/SearchField';
import { useExercises } from '../exercises/queries';
import { ExerciseForm } from '../exercises/ExerciseEditor';
import { templatesKey } from './queries';

type DraftSet = {
  key: number;
  min: string;
  max: string;
  weight: string;
  warmup: boolean;
  amrap: boolean;
  right?: { min: string; max: string; weight: string };
};

type DraftExercise = { exercise: Exercise; sets: DraftSet[] };

function move<T>(items: T[], index: number, direction: number): T[] {
  const result = [...items];
  const target = index + direction;
  if (target < 0 || target >= result.length) return result;
  [result[index], result[target]] = [result[target]!, result[index]!];
  return result;
}

export function TemplateEditor({ id }: { id?: number }) {
  const { api } = useSession();
  const router = useRouter();
  const query = useQuery({
    queryKey: [...templatesKey, id],
    queryFn: () => api.getWorkoutTemplate(id!),
    enabled: id !== undefined && Number.isSafeInteger(id) && id > 0,
  });

  if (id !== undefined) {
    if (!Number.isSafeInteger(id) || id <= 0)
      return (
        <Page>
          <Heading>Template not found</Heading>
          <Button title="Back to templates" onPress={() => router.replace('/templates')} />
        </Page>
      );
    if (query.isPending) return <Loading text="Loading template…" />;
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
          <Button title="Back to templates" onPress={() => router.replace('/templates')} />
        </Page>
      );

    return <EditorForm key={id} template={query.data} />;
  }

  return <EditorForm />;
}

function EditorForm({ template }: { template?: WorkoutTemplate }) {
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const nextKey = useRef(0);
  const toDraft = (set?: PlannedSet): DraftSet => ({
    key: nextKey.current++,
    min: String(set?.targetRepsMin ?? 8),
    max: set?.targetRepsMax == null ? '' : String(set.targetRepsMax),
    weight: set?.targetWeightKg == null ? '' : String(set.targetWeightKg),
    warmup: set?.isWarmup ?? false,
    amrap: set?.isAmrap ?? false,
    right: set?.rightTarget
      ? {
          min: String(set.rightTarget.targetRepsMin),
          max: set.rightTarget.targetRepsMax == null ? '' : String(set.rightTarget.targetRepsMax),
          weight:
            set.rightTarget.targetWeightKg == null ? '' : String(set.rightTarget.targetWeightKg),
        }
      : undefined,
  });
  const [name, setName] = useState(template?.name ?? '');
  const [savedItems, setItems] = useState<DraftExercise[]>(
    () =>
      template?.exercises.map((e) => ({ exercise: e.exercise, sets: e.sets.map(toDraft) })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const autoScroll = useAutoScroll();
  const [pending, setPending] = useState<DraftExercise>();
  const [dropdown, setDropdown] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const items = pending ? [...savedItems, pending] : savedItems;
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const exercises = useExercises();
  const wide = useDesktop();
  const c = useTheme();
  const { api } = useSession();
  const router = useRouter();
  const cache = useQueryClient();
  const save = useMutation({
    mutationFn: (input: WorkoutTemplateInput) =>
      template ? api.updateWorkoutTemplate(template.id, input) : api.createWorkoutTemplate(input),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: templatesKey });
      if (active.current) router.replace('/templates');
    },
  });
  const changeItems = (value: DraftExercise[]) => {
    if (pending) {
      setPending(value.find((e) => e.exercise.id === pending.exercise.id));
      const confirmed = value.filter((e) => e.exercise.id !== pending.exercise.id);
      setItems(confirmed);
      if (confirmed.length !== savedItems.length || confirmed.some((e, i) => e !== savedItems[i]))
        setDirty(true);
    } else {
      setItems(value);
      setDirty(true);
    }
    setErrors({});
    save.reset();
  };
  const changeSet = (i: number, j: number, patch: Partial<DraftSet>) =>
    changeItems(
      items.map((e, index) =>
        index === i ? { ...e, sets: e.sets.map((s, n) => (n === j ? { ...s, ...patch } : s)) } : e,
      ),
    );
  const submit = () => {
    const number = (value: string) => (value.trim() === '' ? NaN : Number(value.replace(',', '.')));
    const parsed = workoutTemplateInputSchema.safeParse({
      name,
      exercises: items.map((e) => ({
        exerciseId: e.exercise.id,
        sets: e.sets.map((s) => ({
          targetRepsMin: number(s.min),
          targetRepsMax: s.max.trim() === '' ? null : number(s.max),
          targetWeightKg: s.weight.trim() === '' ? null : number(s.weight),
          isWarmup: s.warmup,
          isAmrap: s.amrap,
          ...(s.right
            ? {
                rightTarget: {
                  targetRepsMin: number(s.right.min),
                  targetRepsMax: s.right.max.trim() === '' ? null : number(s.right.max),
                  targetWeightKg: s.right.weight.trim() === '' ? null : number(s.right.weight),
                },
              }
            : {}),
        })),
      })),
    });
    if (!parsed.success) {
      setExpanded(new Set(items.map((item) => item.exercise.id)));
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      );
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  };
  const busy = save.isPending;
  const exercisePicker = picker && (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose exercise"
        accessibilityState={{ expanded: dropdown }}
        disabled={creatingExercise}
        onPress={() => setDropdown(!dropdown)}
        style={{
          padding: 14,
          borderWidth: 1,
          borderColor: c.line,
          borderRadius: tokens.radius.sm,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Label syntax={pending ? 'name' : undefined}>
          {pending?.exercise.name ?? 'Choose exercise'}
        </Label>
        <Label>{dropdown ? '▴' : '▾'}</Label>
      </Pressable>
      {creatingExercise && (
        <ExerciseForm
          embedded
          initialName={search.trim()}
          onCancel={() => setCreatingExercise(false)}
          onCreated={(exercise) => {
            setPending({ exercise, sets: [toDraft(), toDraft()] });
            setCreatingExercise(false);
            setDropdown(false);
            setSearch('');
          }}
        />
      )}
      {dropdown && !creatingExercise && (
        <View style={{ gap: 12 }}>
          <SearchField
            scrollRef={autoScroll.scrollRef}
            label="Search exercises"
            placeholder="Name or muscle group"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {exercises.isPending ? (
            <Loading text="Loading exercises…" />
          ) : exercises.isError ? (
            <>
              <ErrorNotice message={errorMessage(exercises.error)} />
              <Button
                title="Try again"
                onPress={() => {
                  void exercises.refetch();
                }}
              />
            </>
          ) : (
            <>
              <ScrollView
                style={{ maxHeight: 240 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {exercises.data
                  .filter(
                    (e) =>
                      !savedItems.some((item) => item.exercise.id === e.id) &&
                      `${e.name} ${e.muscleGroups.map(muscleLabel).join(', ')}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${exercise.name}`}
                      onPress={() => {
                        setPending((previous) =>
                          previous?.exercise.id === exercise.id
                            ? previous
                            : { exercise, sets: [toDraft(), toDraft()] },
                        );
                        setDropdown(false);
                        setSearch('');
                      }}
                      style={{ padding: 14, borderBottomWidth: 1, borderColor: c.line }}
                    >
                      <Label syntax="name">{exercise.name}</Label>
                      <Label syntax="string" small>
                        {exercise.muscleGroups.map(muscleLabel).join(', ')}
                      </Label>
                    </Pressable>
                  ))}
                {!exercises.data.some(
                  (e) =>
                    !savedItems.some((item) => item.exercise.id === e.id) &&
                    `${e.name} ${e.muscleGroups.map(muscleLabel).join(', ')}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                ) && <Label muted>No exercises found.</Label>}
              </ScrollView>
              {search.trim() &&
                !exercises.data.some(
                  (e) => e.name.toLowerCase() === search.trim().toLowerCase(),
                ) && (
                  <Button
                    title="Create exercise"
                    variant="secondary"
                    onPress={() => setCreatingExercise(true)}
                  />
                )}
            </>
          )}
        </View>
      )}
    </Card>
  );
  return (
    <Page scrollRef={autoScroll.scrollRef} onContentSizeChange={autoScroll.onContentSizeChange}>
      <Heading large>{template ? 'Edit workout template' : 'New workout template'}</Heading>
      <Field
        label="Template name"
        syntax="name"
        value={name}
        editable={!busy}
        onChangeText={(value) => {
          setName(value);
          setDirty(true);
          setErrors({});
          save.reset();
        }}
        error={errors.name}
      />
      {items.length === 0 && !picker && <Label muted>No exercises added.</Label>}
      {items.map((item, i) => (
        <React.Fragment key={item.exercise.id}>
          {pending === item && exercisePicker}
          <Card
            style={{ padding: wide ? 24 : 16 }}
            onLayout={(event) =>
              autoScroll.register(String(item.exercise.id), event.nativeEvent.layout.y)
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${expanded.has(item.exercise.id) || pending === item ? 'Collapse' : 'Expand'} ${item.exercise.name}`}
              accessibilityState={{ expanded: expanded.has(item.exercise.id) || pending === item }}
              disabled={pending === item}
              onPress={() => {
                if (!expanded.has(item.exercise.id)) autoScroll.reveal(String(item.exercise.id));
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(item.exercise.id)) next.delete(item.exercise.id);
                  else next.add(item.exercise.id);
                  return next;
                });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Label syntax="name">{item.exercise.name}</Label>
                <Label muted small>
                  <Label syntax="number" small>
                    {item.sets.length}
                  </Label>{' '}
                  {item.sets.length === 1 ? 'set' : 'sets'}
                </Label>
              </View>
              {pending !== item && <Label>{expanded.has(item.exercise.id) ? '▴' : '▾'}</Label>}
            </Pressable>
            {pending !== item && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Button
                  title="↑"
                  accessibilityLabel={`Move ${item.exercise.name} up`}
                  variant="secondary"
                  disabled={busy || picker || i === 0}
                  onPress={() => changeItems(move(items, i, -1))}
                />
                <Button
                  title="↓"
                  accessibilityLabel={`Move ${item.exercise.name} down`}
                  variant="secondary"
                  disabled={busy || picker || i === items.length - 1}
                  onPress={() => changeItems(move(items, i, 1))}
                />
                <Button
                  title="Remove exercise"
                  accessibilityLabel={`Remove ${item.exercise.name}`}
                  variant="secondary"
                  disabled={busy || picker}
                  onPress={() => changeItems(items.filter((_, n) => n !== i))}
                />
              </View>
            )}
            {(expanded.has(item.exercise.id) || pending === item) && (
              <>
                {item.sets.length === 0 && <Label muted>No planned sets.</Label>}
                {item.sets.map((set, j) => {
                  const prefix = `${item.exercise.name} set ${j + 1}`;
                  return (
                    <View key={set.key} style={{ gap: 12, paddingVertical: 12 }}>
                      <Label syntax="property">
                        Set <Label syntax="number">{j + 1}</Label>
                      </Label>
                      <Button
                        title={set.right ? 'Use normal set' : 'Split left/right'}
                        accessibilityLabel={`${set.right ? 'Unsplit' : 'Split'} ${prefix} left/right`}
                        variant="secondary"
                        disabled={busy}
                        onPress={() =>
                          changeSet(i, j, {
                            right: set.right
                              ? undefined
                              : { min: set.min, max: set.max, weight: set.weight },
                          })
                        }
                      />
                      {(set.right ? (['Left', 'Right'] as const) : (['Both'] as const)).map(
                        (side) => {
                          const values = side === 'Right' ? set.right! : set;
                          const labelPrefix = `${prefix}${side === 'Both' ? '' : ` ${side.toLowerCase()}`}`;
                          const errorPrefix = `exercises.${i}.sets.${j}${side === 'Right' ? '.rightTarget' : ''}`;
                          const change = (
                            patch: Partial<{ min: string; max: string; weight: string }>,
                          ) =>
                            changeSet(
                              i,
                              j,
                              side === 'Right' ? { right: { ...set.right!, ...patch } } : patch,
                            );
                          return (
                            <View key={side} style={{ gap: 8 }}>
                              {side !== 'Both' && <Label syntax="property">{side}</Label>}
                              <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                  <Field
                                    label="Reps"
                                    accessibilityLabel={`${labelPrefix} reps`}
                                    value={values.min}
                                    editable={!busy}
                                    keyboardType="number-pad"
                                    error={errors[`${errorPrefix}.targetRepsMin`]}
                                    onChangeText={(min) => change({ min })}
                                  />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Field
                                    label="Max reps (optional)"
                                    accessibilityLabel={`${labelPrefix} max reps (optional)`}
                                    value={values.max}
                                    editable={!busy}
                                    keyboardType="number-pad"
                                    error={errors[`${errorPrefix}.targetRepsMax`]}
                                    onChangeText={(max) => change({ max })}
                                  />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Field
                                    label={
                                      side === 'Both'
                                        ? 'Weight (kg, optional)'
                                        : 'Weight per side (kg, optional)'
                                    }
                                    accessibilityLabel={`${labelPrefix} weight (kg, optional)`}
                                    value={values.weight}
                                    editable={!busy}
                                    keyboardType="decimal-pad"
                                    error={errors[`${errorPrefix}.targetWeightKg`]}
                                    onChangeText={(weight) => change({ weight })}
                                  />
                                </View>
                              </View>
                            </View>
                          );
                        },
                      )}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <Switch
                            accessibilityLabel={`${prefix} warm-up`}
                            value={set.warmup}
                            disabled={busy}
                            onValueChange={(warmup) => changeSet(i, j, { warmup })}
                          />
                          <Label syntax="keyword">Warm-up</Label>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <Switch
                            accessibilityLabel={`${prefix} AMRAP`}
                            value={set.amrap}
                            disabled={busy}
                            onValueChange={(amrap) => changeSet(i, j, { amrap })}
                          />
                          <Label syntax="keyword">AMRAP</Label>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        <Button
                          title="↑"
                          accessibilityLabel={`Move ${prefix} up`}
                          variant="secondary"
                          disabled={busy || j === 0}
                          onPress={() =>
                            changeItems(
                              items.map((e, n) =>
                                n === i ? { ...e, sets: move(e.sets, j, -1) } : e,
                              ),
                            )
                          }
                        />
                        <Button
                          title="↓"
                          accessibilityLabel={`Move ${prefix} down`}
                          variant="secondary"
                          disabled={busy || j === item.sets.length - 1}
                          onPress={() =>
                            changeItems(
                              items.map((e, n) =>
                                n === i ? { ...e, sets: move(e.sets, j, 1) } : e,
                              ),
                            )
                          }
                        />
                        <Button
                          title="Remove set"
                          accessibilityLabel={`Remove ${prefix}`}
                          variant="secondary"
                          disabled={busy}
                          onPress={() =>
                            changeItems(
                              items.map((e, n) =>
                                n === i ? { ...e, sets: e.sets.filter((_, k) => k !== j) } : e,
                              ),
                            )
                          }
                        />
                      </View>
                    </View>
                  );
                })}
                <View style={{ alignSelf: 'flex-start' }}>
                  <Button
                    title="+ Add set"
                    accessibilityLabel={`Add set to ${item.exercise.name}`}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => {
                      const last = item.sets.at(-1);
                      const set = last ? { ...last, key: nextKey.current++ } : toDraft();
                      changeItems(
                        items.map((e, n) => (n === i ? { ...e, sets: [...e.sets, set] } : e)),
                      );
                    }}
                  />
                </View>
              </>
            )}
          </Card>
        </React.Fragment>
      ))}
      {picker && !pending && (
        <View onLayout={(event) => autoScroll.register('picker', event.nativeEvent.layout.y)}>
          {exercisePicker}
        </View>
      )}
      {!picker && (
        <Button
          title="Add exercise"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            autoScroll.reveal('picker');
            setPicker(true);
            setDropdown(true);
            setSearch('');
            setExpanded(new Set());
          }}
        />
      )}
      {picker && !creatingExercise && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button
            title="Add exercise"
            disabled={!pending}
            onPress={() => {
              if (pending) {
                setItems([...savedItems, pending]);
                setDirty(true);
              }
              setPending(undefined);
              setPicker(false);
              setDropdown(false);
              setErrors({});
            }}
          />
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setPending(undefined);
              setPicker(false);
              setDropdown(false);
              setErrors({});
            }}
          />
        </View>
      )}
      <ErrorNotice
        message={Object.keys(errors).length > 0 ? 'Check the highlighted fields.' : undefined}
      />
      <ErrorNotice message={save.isError ? errorMessage(save.error) : undefined} />
      {!picker && (
        <>
          <Button
            title={template ? 'Save changes' : 'Create template'}
            busy={busy}
            onPress={submit}
          />
          <Button
            title="Cancel"
            variant="secondary"
            disabled={busy}
            onPress={() => (dirty ? setDiscard(true) : router.replace('/templates'))}
          />
        </>
      )}
      <ConfirmDialog
        visible={discard}
        title="Discard changes?"
        description="Your unsaved changes will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        busy={false}
        onCancel={() => setDiscard(false)}
        onConfirm={() => router.replace('/templates')}
      />
    </Page>
  );
}
