import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Link } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type PlannedSet,
  type WorkoutTemplate,
  type MuscleGroup,
  errorMessage,
  muscleGroups,
  muscleLabel,
  toggleFilter,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { Loading } from '../../ui/components/Loading';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { Label } from '../../ui/components/Label';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { SearchField } from '../../ui/components/SearchField';
import { ListHeader } from '../../ui/components/ListHeader';
import { TotalCard } from '../../ui/components/TotalCard';
import { tokens, useTheme } from '../../ui/theme';
import { templatesKey, useTemplates } from './queries';
import { useAutoScroll } from '../../ui/useAutoScroll';

function TargetValues({
  target,
}: {
  target: Pick<PlannedSet, 'targetRepsMin' | 'targetRepsMax' | 'targetWeightKg'>;
}) {
  return (
    <>
      <Label syntax="number">
        {target.targetRepsMin}
        {target.targetRepsMax != null && `–${target.targetRepsMax}`}
      </Label>{' '}
      <Label syntax="string">
        {target.targetRepsMin === 1 && target.targetRepsMax == null ? 'rep' : 'reps'}
      </Label>
      {target.targetWeightKg != null && (
        <>
          {' ('}
          <Label syntax="number">{target.targetWeightKg}</Label>
          <Label syntax="string"> kg</Label>
          {')'}
        </>
      )}
    </>
  );
}

export function TemplateList() {
  const autoScroll = useAutoScroll();
  const c = useTheme();
  const query = useTemplates();
  const { api } = useSession();
  const cache = useQueryClient();
  const [selected, setSelected] = useState<WorkoutTemplate>();
  const [expanded, setExpanded] = useState<number>();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name-asc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{ muscle?: MuscleGroup[] }>({});
  const [draft, setDraft] = useState<typeof filters>({});
  const results = (query.data ?? [])
    .filter((template) => {
      const term = search.trim().toLowerCase();
      if (
        term &&
        !template.name.toLowerCase().includes(term) &&
        !template.exercises.some((item) => item.exercise.name.toLowerCase().includes(term))
      )
        return false;
      if (
        filters.muscle?.length &&
        !template.exercises.some((item) =>
          filters.muscle!.some((muscle) =>
            muscle === 'None'
              ? item.exercise.muscleGroups.length === 0
              : item.exercise.muscleGroups.some((group) => group === muscle),
          ),
        )
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const comparison = a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return (
        (sort.endsWith('desc') ? -comparison : comparison) ||
        a.name.localeCompare(b.name) ||
        a.id - b.id
      );
    });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteWorkoutTemplate(id),
    onSuccess: async () => {
      setSelected(undefined);
      await cache.invalidateQueries({ queryKey: templatesKey });
    },
  });

  return (
    <Page scrollRef={autoScroll.scrollRef} onContentSizeChange={autoScroll.onContentSizeChange}>
      <ListHeader title="Workout templates" action="New template" href="/templates/new" />
      <TotalCard label="TOTAL TEMPLATES" count={query.data?.length} />
      <SearchField
        scrollRef={autoScroll.scrollRef}
        label="Search templates"
        placeholder="Search by template or exercise name"
        value={search}
        onChangeText={setSearch}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(
          [
            ['name-asc', 'Name A–Z'],
            ['name-desc', 'Name Z–A'],
          ] as const
        ).map(([value, title]) => (
          <Button
            key={value}
            title={title}
            variant={sort === value ? 'primary' : 'secondary'}
            onPress={() => setSort(value)}
          />
        ))}
        <Button
          title="Filters"
          variant={showFilters ? 'primary' : 'secondary'}
          selected={showFilters}
          onPress={() => setShowFilters(!showFilters)}
        />
      </View>
      {!!filters.muscle?.length && (
        <View style={{ gap: 6 }}>
          <Label small muted>
            {filters.muscle!.map(muscleLabel).join(', ')}
          </Label>
          <Button
            title="Clear"
            accessibilityLabel="Reset filters"
            variant="secondary"
            onPress={() => {
              setFilters({});
              setDraft({});
            }}
          />
        </View>
      )}
      {showFilters && (
        <Card>
          <Label small>Muscle group</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {[undefined, ...muscleGroups].map((muscle) => (
              <Button
                key={muscle ?? 'all'}
                title={muscle ? muscleLabel(muscle) : 'All'}
                accessibilityLabel={`Filter muscle group: ${muscle ? muscleLabel(muscle) : 'All'}`}
                selected={muscle ? (draft.muscle ?? []).includes(muscle) : !draft.muscle?.length}
                variant={
                  (muscle ? (draft.muscle ?? []).includes(muscle) : !draft.muscle?.length)
                    ? 'primary'
                    : 'secondary'
                }
                onPress={() =>
                  setDraft({
                    ...draft,
                    muscle: muscle ? toggleFilter(draft.muscle ?? [], muscle) : undefined,
                  })
                }
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Button
              title="Apply"
              accessibilityLabel="Apply filters"
              onPress={() => {
                setFilters(draft);
                setShowFilters(false);
              }}
            />
            <Button
              title="Clear"
              accessibilityLabel="Clear filters"
              variant="secondary"
              onPress={() => {
                setFilters({});
                setDraft({});
              }}
            />
            <View style={{ marginLeft: 'auto' }}>
              <Button title="Close" variant="secondary" onPress={() => setShowFilters(false)} />
            </View>
          </View>
        </Card>
      )}
      {query.isPending ? (
        <Loading text="Loading templates…" />
      ) : query.isError ? (
        <>
          <ErrorNotice message={errorMessage(query.error)} />
          <Button
            title="Try again"
            onPress={() => {
              void query.refetch();
            }}
          />
        </>
      ) : query.data.length === 0 ? (
        <Card>
          <Heading>No templates</Heading>
          <Label muted>Create a template to plan your exercises and sets.</Label>
        </Card>
      ) : (
        <>
          {!results.length && <Label muted>No templates match these filters.</Label>}
          {results.map((template) => (
            <Card
              key={template.id}
              onLayout={(event) =>
                autoScroll.register(String(template.id), event.nativeEvent.layout.y)
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${expanded === template.id ? 'Collapse' : 'Expand'} template ${template.name}`}
                accessibilityState={{ expanded: expanded === template.id }}
                aria-expanded={expanded === template.id}
                onPress={() => {
                  if (expanded !== template.id) autoScroll.reveal(String(template.id));
                  setExpanded(expanded === template.id ? undefined : template.id);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  <Heading name>{template.name}</Heading>
                  <Label muted>
                    <Label syntax="number">{template.exercises.length}</Label> exercises ·{' '}
                    <Label syntax="number">
                      {template.exercises.reduce((sum, e) => sum + e.sets.length, 0)}
                    </Label>{' '}
                    sets
                  </Label>
                </View>
                <Label muted>{expanded === template.id ? '−' : '+'}</Label>
              </Pressable>
              {expanded === template.id && (
                <>
                  {template.exercises.map((exercise) => (
                    <View key={exercise.exercise.id} style={{ marginTop: 12 }}>
                      <Text
                        style={{
                          color: c.syntax.name,
                          fontFamily: tokens.font,
                          fontWeight: '600',
                        }}
                      >
                        {exercise.exercise.name}
                      </Text>
                      {exercise.sets.length === 0 ? (
                        <Label muted>No sets</Label>
                      ) : (
                        exercise.sets.map((set, index) => (
                          <View key={index} style={{ gap: 4 }}>
                            <Label muted>
                              <Label syntax="property">Set </Label>
                              <Label syntax="number">{index + 1}</Label>
                              {set.isWarmup && <Label syntax="keyword"> (Warmup)</Label>}
                              {set.isAmrap && <Label syntax="keyword"> (Amrap)</Label>}
                              {!set.rightTarget && (
                                <>
                                  {': '}
                                  <TargetValues target={set} />
                                </>
                              )}
                            </Label>
                            {set.rightTarget && (
                              <View style={{ paddingLeft: 12, gap: 4 }}>
                                <Label muted>
                                  <Label syntax="property">Left: </Label>
                                  <TargetValues target={set} />
                                </Label>
                                <Label muted>
                                  <Label syntax="property">Right: </Label>
                                  <TargetValues target={set.rightTarget} />
                                </Label>
                              </View>
                            )}
                          </View>
                        ))
                      )}
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                    <Link
                      href={{ pathname: '/templates/[id]/edit', params: { id: template.id } }}
                      asChild
                    >
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={'Edit ' + template.name}
                        style={{ padding: 14 }}
                      >
                        <Text style={{ color: c.ink, fontFamily: tokens.font }}>Edit</Text>
                      </Pressable>
                    </Link>
                    <Button
                      title={'Delete ' + template.name}
                      variant="secondary"
                      onPress={() => {
                        remove.reset();
                        setSelected(template);
                      }}
                    />
                  </View>
                </>
              )}
            </Card>
          ))}
        </>
      )}
      <ConfirmDialog
        visible={!!selected}
        title="Delete template?"
        description={
          selected
            ? `${selected.name} will be deleted. Templates used by scheduled workouts cannot be deleted.`
            : ''
        }
        confirmLabel="Delete template"
        cancelLabel="Keep template"
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : undefined}
        onCancel={() => setSelected(undefined)}
        onConfirm={() => {
          if (selected) remove.mutate(selected.id);
        }}
      />
    </Page>
  );
}
