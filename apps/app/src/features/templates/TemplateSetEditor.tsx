import { View, Switch } from 'react-native';
import { Button } from '../../ui/components/Button';
import { Label } from '../../ui/components/Label';
import { Field } from '../../ui/components/Field';
import { useDesktop } from '../../ui/theme';
import { type DraftSet } from './templateDraft';

export function TemplateSetEditor({
  set,
  exerciseName,
  exerciseIndex,
  setIndex,
  totalSets,
  busy,
  errors,
  onChange,
  onMove,
  onRemove,
}: {
  set: DraftSet;
  exerciseName: string;
  exerciseIndex: number;
  setIndex: number;
  totalSets: number;
  busy: boolean;
  errors: Record<string, string>;
  onChange: (patch: Partial<DraftSet>) => void;
  onMove: (direction: number) => void;
  onRemove: () => void;
}) {
  const wide = useDesktop();

  const prefix = `${exerciseName} set ${setIndex + 1}`;
  return (
    <View key={set.key} style={{ gap: 12, paddingVertical: 12 }}>
      <Label syntax="property">
        Set <Label syntax="number">{setIndex + 1}</Label>
      </Label>
      <Button
        title={set.right ? 'Use normal set' : 'Split left/right'}
        accessibilityLabel={`${set.right ? 'Unsplit' : 'Split'} ${prefix} left/right`}
        variant="secondary"
        disabled={busy}
        onPress={() =>
          onChange({
            right: set.right ? undefined : { min: set.min, max: set.max, weight: set.weight },
          })
        }
      />
      {(set.right ? (['Left', 'Right'] as const) : (['Both'] as const)).map((side) => {
        const values = side === 'Right' ? set.right! : set;
        const labelPrefix = `${prefix}${side === 'Both' ? '' : ` ${side.toLowerCase()}`}`;
        const errorPrefix = `exercises.${exerciseIndex}.sets.${setIndex}${side === 'Right' ? '.rightTarget' : ''}`;
        const change = (patch: Partial<{ min: string; max: string; weight: string }>) =>
          onChange(side === 'Right' ? { right: { ...set.right!, ...patch } } : patch);
        return (
          <View key={side} style={{ gap: 8 }}>
            {side !== 'Both' && <Label syntax="property">{side}</Label>}
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Reps (optional)"
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
                    side === 'Both' ? 'Weight (kg, optional)' : 'Weight per side (kg, optional)'
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
      })}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Switch
            accessibilityLabel={`${prefix} warm-up`}
            value={set.warmup}
            disabled={busy}
            onValueChange={(warmup) => onChange({ warmup })}
          />
          <Label syntax="keyword">Warm-up</Label>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Switch
            accessibilityLabel={`${prefix} AMRAP`}
            value={set.amrap}
            disabled={busy}
            onValueChange={(amrap) => onChange({ amrap })}
          />
          <Label syntax="keyword">AMRAP</Label>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          title="↑"
          accessibilityLabel={`Move ${prefix} up`}
          variant="secondary"
          disabled={busy || setIndex === 0}
          onPress={() => onMove(-1)}
        />
        <Button
          title="↓"
          accessibilityLabel={`Move ${prefix} down`}
          variant="secondary"
          disabled={busy || setIndex === totalSets - 1}
          onPress={() => onMove(1)}
        />
        <Button
          title="Remove set"
          accessibilityLabel={`Remove ${prefix}`}
          variant="secondary"
          disabled={busy}
          onPress={onRemove}
        />
      </View>
    </View>
  );
}
