import { View } from 'react-native';
import { type WorkoutLogging } from '@topout/shared';
import { draftDefaults, signature, type DraftExercise, type DraftSet } from './workoutDraft';
import { templateFromLoggedSet } from './templateFromLog';
import { displayDate } from '../../lib/dates';
import { Button } from '../../ui/components/Button';
import { Label } from '../../ui/components/Label';
import { Field } from '../../ui/components/Field';
import { useDesktop } from '../../ui/theme';
import { SaveStatus } from '../../ui/components/SaveStatus';
import type { SaveFeedback } from '../../ui/saveFeedback';
export function WorkoutSetEditor({
  workout,
  item,
  set,
  exerciseIndex,
  setIndex,
  busy,
  feedback,
  errors,
  actions,
}: {
  workout: WorkoutLogging;
  item: DraftExercise;
  set: DraftSet;
  exerciseIndex: number;
  setIndex: number;
  busy: boolean;
  feedback?: SaveFeedback;
  errors: Record<string, string>;
  actions: {
    change: (patch: Partial<DraftSet>) => void;
    record: () => void;
    toggleSplit: () => void;
    remove: () => void;
    updateTemplate: () => void;
  };
}) {
  const wide = useDesktop();

  const group = item.sets.filter((s) => s.order === set.order);
  const firstSide = item.sets.findIndex((s) => s.order === set.order) === setIndex;
  const basePrefix = `${item.exercise.name} set ${set.order}`;
  const recorded =
    workout.log?.exercises
      .find((e) => e.exercise.id === item.exercise.id)
      ?.sets.filter((s) => s.order === set.order) ?? [];
  const modeChanged =
    !!recorded.length &&
    recorded.some((s) => ((s.side ?? 'Both') === 'Both') !== (set.side === 'Both'));
  const prefix = `${item.exercise.name} set ${set.order}${set.side === 'Both' ? '' : ` ${set.side.toLowerCase()}`}`;
  const previous = workout.previousSets?.find(
    (s) =>
      s.exerciseId === item.exercise.id && s.order === set.order && (s.side ?? 'Both') === set.side,
  );
  return (
    <View key={`${set.order}-${set.side}`} style={{ gap: 10, paddingVertical: 10 }}>
      <Label syntax="property">
        Set <Label syntax="number">{set.order}</Label>
        {set.side !== 'Both' && ` · ${set.side}`}
      </Label>
      {firstSide && (
        <Button
          title={set.side === 'Both' ? 'Split left/right' : 'Use normal set'}
          accessibilityLabel={`${set.side === 'Both' ? 'Split' : 'Unsplit'} ${basePrefix} left/right`}
          variant="secondary"
          disabled={busy || group.some((s) => !!s.saved)}
          onPress={actions.toggleSplit}
        />
      )}
      {firstSide && modeChanged && workout.log?.completedAt && (
        <Label small muted>
          Save changes to apply the set type.
        </Label>
      )}
      {previous ? (
        <View style={{ gap: 4 }}>
          <Label small muted>
            Last logged ({displayDate(previous.date)}
            {previous.location?.trim() ? ` · ${previous.location.trim()}` : ''}):{' '}
            <Label syntax="number" small>
              {previous.reps}
            </Label>{' '}
            reps ·{' '}
            <Label syntax="number" small>
              {previous.weightKg}
            </Label>{' '}
            kg{previous.isWarmup ? ' · Warm-up' : ''}
          </Label>
          {!!previous.notes?.trim() && (
            <Label small muted>
              Previous note: {previous.notes}
            </Label>
          )}
        </View>
      ) : (
        set.target?.targetRepsMin != null && (
          <Label small muted>
            Planned:{' '}
            {set.target.targetRepsMin != null ? (
              <>
                <Label syntax="number" small>
                  {set.target.targetRepsMin}
                  {set.target.targetRepsMax != null && `–${set.target.targetRepsMax}`}
                </Label>{' '}
                reps
              </>
            ) : (
              'Reps not planned'
            )}
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
            placeholder={draftDefaults(workout, item.exercise.id, set).reps?.toString() ?? ''}
            onChangeText={(reps) => actions.change({ reps })}
            keyboardType="number-pad"
            editable={!busy}
            error={errors[`exercises.${exerciseIndex}.sets.${setIndex}.reps`]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={set.side === 'Both' ? 'Weight (kg)' : 'Weight per side (kg)'}
            accessibilityLabel={`${prefix} weight (kg)`}
            value={set.weight}
            placeholder={draftDefaults(workout, item.exercise.id, set).weight?.toString() ?? ''}
            onChangeText={(weight) => actions.change({ weight })}
            keyboardType="decimal-pad"
            editable={!busy}
            error={errors[`exercises.${exerciseIndex}.sets.${setIndex}.weightKg`]}
          />
        </View>
      </View>
      <Field
        label="Set notes (optional)"
        accessibilityLabel={`${prefix} notes`}
        value={set.notes}
        onChangeText={(notes) => actions.change({ notes })}
        maxLength={2000}
        editable={!busy}
        error={errors[`exercises.${exerciseIndex}.sets.${setIndex}.notes`]}
      />
      <SaveStatus feedback={feedback} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          title={set.saved === signature(set) ? 'Logged' : set.saved ? 'Save set' : 'Log set'}
          accessibilityLabel={`Log ${prefix}`}
          disabled={busy || set.saved === signature(set) || modeChanged}
          onPress={actions.record}
        />
        <Button
          title={set.warmup ? 'Warm-up: on' : 'Warm-up: off'}
          accessibilityLabel={`${prefix} toggle warm-up`}
          variant="secondary"
          disabled={busy}
          onPress={() => actions.change({ warmup: !set.warmup })}
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
            onPress={actions.updateTemplate}
          />
        )}
        <Button
          title="Remove set"
          accessibilityLabel={`Remove ${prefix}`}
          variant="secondary"
          disabled={busy}
          onPress={actions.remove}
        />
      </View>
    </View>
  );
}
