import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  type Exercise,
  type ExerciseInput,
  exerciseInputSchema,
  errorMessage,
  muscleGroups,
  muscleLabel,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Loading } from '../../ui/components/Loading';
import { Page } from '../../ui/components/Page';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Button } from '../../ui/components/Button';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Card } from '../../ui/components/Card';
import { Field } from '../../ui/components/Field';
import { tokens, useTheme } from '../../ui/theme';
import { exercisesKey, useExercises } from './queries';

export function ExerciseEditor({ id }: { id?: number }) {
  const query = useExercises();

  if (id !== undefined) {
    if (query.isPending) return <Loading />;
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
        </Page>
      );

    const exercise = query.data?.find((x) => x.id === id);

    if (!exercise)
      return (
        <Page>
          <Heading>Exercise not found.</Heading>
          <Link href="/exercises">Back to exercises</Link>
        </Page>
      );

    return <ExerciseForm key={exercise.id} exercise={exercise} />;
  }

  return <ExerciseForm />;
}
export function ExerciseForm({
  exercise,
  initialName = '',
  embedded = false,
  onCreated,
  onCancel,
}: {
  exercise?: Exercise;
  initialName?: string;
  embedded?: boolean;
  onCreated?: (exercise: Exercise) => void;
  onCancel?: () => void;
}) {
  const c = useTheme();
  const { api } = useSession();
  const cache = useQueryClient();
  const router = useRouter();
  const { control, handleSubmit, setError } = useForm<ExerciseInput>({
    defaultValues: {
      name: exercise?.name ?? initialName,
      muscleGroups: exercise?.muscleGroups ?? [],
    },
  });
  const save = useMutation({
    mutationFn: (input: ExerciseInput) =>
      exercise ? api.updateExercise(exercise.id, input) : api.createExercise(input),
    onSuccess: async (created) => {
      await cache.invalidateQueries({ queryKey: exercisesKey });
      await cache.invalidateQueries({ queryKey: ['progress'] });
      if (onCreated) onCreated(created);
      else router.replace('/exercises');
    },
  });
  const submit = handleSubmit((values) => {
    const parsed = exerciseInputSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        setError(issue.path[0] as keyof ExerciseInput, { message: issue.message }),
      );
      return;
    }
    save.mutate(parsed.data);
  });

  const content = (
    <>
      {!embedded && (
        <Link
          href="/exercises"
          style={{ color: c.muted, fontSize: 14, paddingVertical: 10, fontFamily: tokens.font }}
        >
          ← Exercises
        </Link>
      )}
      <Heading large={!embedded}>{exercise ? 'Edit exercise' : 'New exercise'}</Heading>
      <Label muted>
        {exercise
          ? 'Update the exercise name or muscle groups.'
          : 'Enter a name and select muscle groups.'}
      </Label>
      {embedded && <Label muted>Creating this exercise saves it to your exercise library.</Label>}
      <Card style={{ maxWidth: 680, width: '100%', gap: 24 }}>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Field
              label="Exercise name"
              syntax="name"
              placeholder="e.g. Weighted pull-up"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              onSubmitEditing={submit}
            />
          )}
        />
        <Controller
          control={control}
          name="muscleGroups"
          render={({ field }) => (
            <View style={{ gap: 12 }}>
              <Label>Muscle groups (optional)</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {muscleGroups
                  .filter((group) => group !== 'None')
                  .map((group) => (
                    <Pressable
                      key={group}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: field.value.includes(group) }}
                      aria-checked={field.value.includes(group)}
                      accessibilityLabel={muscleLabel(group)}
                      {...(Platform.OS === 'web'
                        ? {
                            onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                              // React Native Web does not activate checkbox-role Pressables with Space.
                              if (event.key === ' ') {
                                event.preventDefault();
                                field.onChange(
                                  field.value.includes(group)
                                    ? field.value.filter((value) => value !== group)
                                    : [...field.value, group],
                                );
                              }
                            },
                          }
                        : {})}
                      onPress={() =>
                        field.onChange(
                          field.value.includes(group)
                            ? field.value.filter((value) => value !== group)
                            : [...field.value, group],
                        )
                      }
                      style={{
                        borderRadius: tokens.radius.sm,
                        paddingHorizontal: 16,
                        paddingVertical: 13,
                        backgroundColor: field.value.includes(group) ? c.primary : c.soft,
                      }}
                    >
                      <Text
                        style={{
                          color: field.value.includes(group) ? c.onPrimary : c.ink,
                          fontFamily: tokens.font,
                        }}
                      >
                        {muscleLabel(group)}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </View>
          )}
        />
        <ErrorNotice message={save.isError ? errorMessage(save.error) : undefined} />
        <Button
          title={exercise ? 'Save changes' : 'Create exercise'}
          busy={save.isPending}
          onPress={submit}
        />
        <Button
          title="Cancel"
          variant="secondary"
          disabled={save.isPending}
          onPress={() => (onCancel ? onCancel() : router.replace('/exercises'))}
        />
      </Card>
    </>
  );
  return embedded ? content : <Page>{content}</Page>;
}
