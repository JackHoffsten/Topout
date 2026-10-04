import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  type Exercise,
  type MuscleGroup,
  errorMessage,
  muscleLabel,
  toggleFilter,
  muscleGroups,
} from '@topout/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../lib/providers';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { ListHeader } from '../../ui/components/ListHeader';
import { TotalCard } from '../../ui/components/TotalCard';
import { Label } from '../../ui/components/Label';
import { Card } from '../../ui/components/Card';
import { SearchField } from '../../ui/components/SearchField';
import { useAutoScroll } from '../../ui/useAutoScroll';
import { Loading } from '../../ui/components/Loading';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Button } from '../../ui/components/Button';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { tokens, useDesktop, useTheme } from '../../ui/theme';
import { exercisesKey, useExercises } from './queries';

export function ExerciseList() {
  const autoScroll = useAutoScroll();
  const c = useTheme();
  const wide = useDesktop();
  const { api } = useSession();
  const query = useExercises();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Exercise>();
  const [sort, setSort] = useState('name-asc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<{ muscle?: MuscleGroup[] }>({});
  const [draft, setDraft] = useState<typeof filters>({});
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteExercise(id),
    onSuccess: async () => {
      setSelected(undefined);
      await cache.invalidateQueries({ queryKey: exercisesKey });
    },
  });
  const data = query.data ?? [];
  const visible = data
    .filter(
      (x) =>
        (x.name + ' ' + x.muscleGroups.map(muscleLabel).join(', '))
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (!filters.muscle?.length ||
          filters.muscle.some((muscle) =>
            muscle === 'None'
              ? x.muscleGroups.length === 0
              : x.muscleGroups.some((group) => group === muscle),
          )),
    )
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (sort === 'name-desc') return -byName || a.id - b.id;
      return byName || a.id - b.id;
    });

  return (
    <Page scrollRef={autoScroll.scrollRef} onContentSizeChange={autoScroll.onContentSizeChange}>
      <ListHeader title="Exercises" action="New exercise" href="/exercises/new" />
      <TotalCard label="TOTAL EXERCISES" count={query.data?.length} />
      <SearchField
        scrollRef={autoScroll.scrollRef}
        label="Search exercises"
        placeholder="Search by name or muscle group"
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
        <Loading text="Loading exercises…" />
      ) : query.isError ? (
        <>
          <ErrorNotice message={errorMessage(query.error)} />
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => {
              void query.refetch();
            }}
          />
        </>
      ) : visible.length === 0 ? (
        <Card>
          <Heading>{data.length === 0 ? 'No exercises' : 'No exercises found'}</Heading>
          <Label muted>
            {data.length === 0
              ? 'Add an exercise to get started.'
              : 'Try a different search or clear the filters.'}
          </Label>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {visible.map((exercise) => (
            <Card
              key={exercise.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: wide ? 20 : 16,
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: tokens.radius.sm,
                  backgroundColor: c.soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="barbell-sharp" size={22} color={c.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                <Text
                  style={{
                    color: c.syntax.name,
                    fontSize: 15,
                    fontWeight: '600',
                    fontFamily: tokens.font,
                  }}
                >
                  {exercise.name}
                </Text>
                <Text style={{ color: c.syntax.string, fontSize: 12, fontFamily: tokens.font }}>
                  {exercise.muscleGroups.map(muscleLabel).join(', ')}
                </Text>
              </View>
              <Link
                href={{ pathname: '/exercises/[id]/edit', params: { id: exercise.id } }}
                asChild
              >
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={'Edit ' + exercise.name}
                  style={{ padding: 12 }}
                >
                  <Feather name="edit-2" size={18} color={c.ink} />
                </Pressable>
              </Link>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={'Delete ' + exercise.name}
                onPress={() => {
                  remove.reset();
                  setSelected(exercise);
                }}
                style={{ padding: 12 }}
              >
                <Feather name="trash-2" size={18} color={c.muted} />
              </Pressable>
            </Card>
          ))}
        </View>
      )}
      <ConfirmDialog
        visible={!!selected}
        title="Delete exercise?"
        description={
          selected
            ? selected.name + ' will be deleted. Exercises used in a workout cannot be deleted.'
            : ''
        }
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
