import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { type Exercise, errorMessage, muscleLabel } from '@topout/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../lib/providers';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Card } from '../../ui/components/Card';
import { Field } from '../../ui/components/Field';
import { Loading } from '../../ui/components/Loading';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Button } from '../../ui/components/Button';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { tokens, useDesktop, useTheme } from '../../ui/theme';
import { exercisesKey, useExercises } from './queries';

export function ExerciseList() {
  const c = useTheme();
  const wide = useDesktop();
  const { api } = useSession();
  const query = useExercises();
  const cache = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Exercise>();
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteExercise(id),
    onSuccess: async () => {
      setSelected(undefined);
      await cache.invalidateQueries({ queryKey: exercisesKey });
    },
  });
  const data = query.data ?? [];
  const visible = data.filter((x) =>
    (x.name + ' ' + x.muscleGroups.map(muscleLabel).join(', '))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <Page>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Heading large>Exercises</Heading>
        {wide && (
          <Link href="/exercises/new" asChild>
            <Pressable
              accessibilityRole="link"
              style={{ backgroundColor: c.primary, borderRadius: tokens.radius.sm, padding: 16 }}
            >
              <Text style={{ color: c.onPrimary, fontWeight: '600', fontFamily: tokens.font }}>
                ＋ New exercise
              </Text>
            </Pressable>
          </Link>
        )}
      </View>
      <Label muted>Search, add, edit, or delete exercises.</Label>
      <Card style={{ padding: 20, gap: 8 }}>
        <Text
          style={{
            color: c.muted,
            fontSize: 10,
            letterSpacing: 1.5,
            fontWeight: '700',
            fontFamily: tokens.font,
          }}
        >
          TOTAL EXERCISES
        </Text>
        <Text
          style={{
            color: c.syntax.number,
            fontSize: 28,
            fontWeight: '600',
            fontFamily: tokens.font,
          }}
        >
          {data.length}
        </Text>
      </Card>
      {!wide && (
        <Link href="/exercises/new" asChild>
          <Pressable
            accessibilityRole="link"
            style={{
              backgroundColor: c.primary,
              borderRadius: tokens.radius.sm,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: c.onPrimary, fontWeight: '600', fontFamily: tokens.font }}>
              ＋ New exercise
            </Text>
          </Pressable>
        </Link>
      )}
      <Field
        label="Search exercises"
        placeholder="Search by name or muscle group"
        value={search}
        onChangeText={setSearch}
      />
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
              : 'Try a different name or muscle group.'}
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
