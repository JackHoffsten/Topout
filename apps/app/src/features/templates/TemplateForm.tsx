import { useSaveMutation } from '../../ui/saveFeedback';
import { SaveStatus } from '../../ui/components/SaveStatus';
import { ReorderableExercises } from '../../ui/components/ReorderableExercises';
import { useExerciseReorder } from '../../ui/useExerciseReorder';
import { TemplateSetEditor } from './TemplateSetEditor';
import {
  createDraftSet,
  parseTemplateDraft,
  moveDraftItem,
  type DraftSet,
  type DraftExercise,
} from './templateDraft';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  type PlannedSet,
  type WorkoutTemplate,
  type WorkoutTemplateInput,
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

export function TemplateForm({ template }: { template?: WorkoutTemplate }) {
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const nextKey = useRef(0);
  const toDraft = (set?: PlannedSet): DraftSet => createDraftSet(nextKey.current++, set);
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
  const save = useSaveMutation('Workout template', {
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
    const parsed = parseTemplateDraft(name, items);
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
  const [dragging, setDragging] = useState(false);
  const reorder = useExerciseReorder(
    savedItems,
    setItems,
    async (ids) => {
      if (!template) {
        setDirty(true);
        return;
      }
      await api.reorderTemplateExercises(template.id, ids);
      await Promise.all([
        cache.invalidateQueries({ queryKey: templatesKey }),
        cache.invalidateQueries({ queryKey: ['workout-logging'] }),
        cache.invalidateQueries({ queryKey: ['workout-schedule'] }),
      ]);
    },
    !!template,
  );
  const mutating = save.isPending || reorder.pending;
  const busy = mutating || dragging;
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
            setPending({ exercise, sets: [] });
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
                          previous?.exercise.id === exercise.id ? previous : { exercise, sets: [] },
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
    <Page
      scrollEnabled={!dragging}
      scrollRef={autoScroll.scrollRef}
      onContentSizeChange={autoScroll.onContentSizeChange}
    >
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
      <ReorderableExercises
        items={items}
        feedback={reorder.feedback}
        movedId={reorder.movedId}
        reveal={reorder.reveal}
        error={reorder.error}
        disabled={mutating || picker}
        onMove={(from, to) => {
          void reorder.move(from, to);
        }}
        onDragging={setDragging}
        renderItem={(item, i, controls) => (
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
                accessibilityState={{
                  expanded: expanded.has(item.exercise.id) || pending === item,
                }}
                disabled={busy || pending === item}
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
                <>
                  {controls}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Button
                      title="Remove exercise"
                      accessibilityLabel={`Remove ${item.exercise.name}`}
                      variant="secondary"
                      disabled={busy || picker}
                      onPress={() => changeItems(items.filter((_, n) => n !== i))}
                    />
                  </View>
                </>
              )}
              {(expanded.has(item.exercise.id) || pending === item) && (
                <>
                  {item.sets.length === 0 && <Label muted>No planned sets.</Label>}
                  {item.sets.map((set, j) => (
                    <TemplateSetEditor
                      key={set.key}
                      set={set}
                      exerciseName={item.exercise.name}
                      exerciseIndex={i}
                      setIndex={j}
                      totalSets={item.sets.length}
                      busy={busy}
                      errors={errors}
                      onChange={(patch) => changeSet(i, j, patch)}
                      onMove={(direction) =>
                        changeItems(
                          items.map((e, n) =>
                            n === i ? { ...e, sets: moveDraftItem(e.sets, j, direction) } : e,
                          ),
                        )
                      }
                      onRemove={() =>
                        changeItems(
                          items.map((e, n) =>
                            n === i ? { ...e, sets: e.sets.filter((_, index) => index !== j) } : e,
                          ),
                        )
                      }
                    />
                  ))}
                  <View style={{ alignSelf: 'flex-start' }}>
                    <Button
                      title="+ Add set"
                      accessibilityLabel={`Add set to ${item.exercise.name}`}
                      variant="secondary"
                      disabled={busy}
                      onPress={() => {
                        const last = item.sets.at(-1);
                        const set = last
                          ? {
                              ...last,
                              key: nextKey.current++,
                              min: '',
                              max: '',
                              right: last.right ? { ...last.right, min: '', max: '' } : undefined,
                            }
                          : toDraft();
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
        )}
      />
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
      <SaveStatus feedback={save.feedback} />
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
