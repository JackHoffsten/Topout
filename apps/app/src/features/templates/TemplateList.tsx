import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Link } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type PlannedSet, type WorkoutTemplate, errorMessage } from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Page } from '../../ui/components/Page';
import { Heading } from '../../ui/components/Heading';
import { Loading } from '../../ui/components/Loading';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { Label } from '../../ui/components/Label';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { tokens, useTheme } from '../../ui/theme';
import { templatesKey, useTemplates } from './queries';

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
  const c = useTheme();
  const query = useTemplates();
  const { api } = useSession();
  const cache = useQueryClient();
  const [selected, setSelected] = useState<WorkoutTemplate>();
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteWorkoutTemplate(id),
    onSuccess: async () => {
      setSelected(undefined);
      await cache.invalidateQueries({ queryKey: templatesKey });
    },
  });

  return (
    <Page>
      <Heading large>Workout templates</Heading>
      <Link href="/templates/new" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="New template"
          style={{
            backgroundColor: c.primary,
            padding: 16,
            borderRadius: tokens.radius.sm,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ color: c.onPrimary, fontWeight: '600', fontFamily: tokens.font }}>
            New template
          </Text>
        </Pressable>
      </Link>
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
        query.data.map((template) => (
          <Card key={template.id}>
            <Heading name>{template.name}</Heading>
            <Label muted>
              <Label syntax="number">{template.exercises.length}</Label> exercises ·{' '}
              <Label syntax="number">
                {template.exercises.reduce((sum, e) => sum + e.sets.length, 0)}
              </Label>{' '}
              sets
            </Label>
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
          </Card>
        ))
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
