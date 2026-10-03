import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  climbingTypes,
  climbingEnvironments,
  climbingOutcomes,
  climbingStyles,
  wallAngles,
  climbingGrades,
  climbingLabel,
  systemsForType,
  climbLogInputSchema,
  errorMessage,
  type ClimbLog,
  type ClimbLogInput,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Button } from '../../ui/components/Button';
import { Field } from '../../ui/components/Field';
import { Label } from '../../ui/components/Label';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { useTheme } from '../../ui/theme';

function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Label small>{label}</Label>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${climbingLabel(option)}`}
            accessibilityState={{ checked: value === option, disabled }}
            aria-checked={value === option}
            aria-disabled={disabled}
            disabled={disabled}
            onPress={() => onChange(option)}
            {...(Platform.OS === 'web'
              ? {
                  tabIndex: value === option ? (0 as const) : (-1 as const),
                  onKeyDown: (event: {
                    key: string;
                    preventDefault: () => void;
                    currentTarget: HTMLElement;
                  }) => {
                    if (disabled) return;
                    // React Native Web only activates button-role Pressables with Space.
                    if (event.key === ' ') {
                      event.preventDefault();
                      onChange(option);
                    }
                    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
                      ? 1
                      : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                        ? -1
                        : 0;
                    if (direction) {
                      event.preventDefault();
                      const index =
                        (options.indexOf(option) + direction + options.length) % options.length;
                      onChange(options[index]!);
                      event.currentTarget.parentElement
                        ?.querySelectorAll<HTMLElement>('[role="radio"]')
                        [index]?.focus();
                    }
                  },
                }
              : {})}
            style={{
              minHeight: 42,
              justifyContent: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: value === option ? c.focus : c.line,
              backgroundColor: value === option ? c.soft : c.input,
            }}
          >
            <Label small syntax={value === option ? 'keyword' : undefined}>
              {climbingLabel(option)}
            </Label>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ClimbEditor({
  date,
  log,
  onClose,
  showHeading = true,
}: {
  date: string;
  log?: ClimbLog;
  onClose: (date?: string) => void;
  showHeading?: boolean;
}) {
  const { api } = useSession();
  const cache = useQueryClient();
  const c = useTheme();
  const [draft, setDraft] = useState<ClimbLogInput>(() =>
    log
      ? { ...log }
      : {
          date,
          climbingType: 'Bouldering',
          gradeSystem: 'Font',
          grade: '',
          environment: 'Indoor',
          attempts: 1,
          outcome: 'Redpoint',
          wallAngle: null,
          styles: [],
          name: null,
          location: null,
        },
  );
  const [attempts, setAttempts] = useState(String(draft.attempts));
  const [gradeSearch, setGradeSearch] = useState('');
  const [validation, setValidation] = useState<string>();
  const save = useMutation({
    mutationFn: (input: ClimbLogInput) =>
      log ? api.updateClimbLog(log.id, input) : api.createClimbLog(input),
    onSuccess: async (_, input) => {
      await cache.invalidateQueries({ queryKey: ['climb-logs'] });
      onClose(input.date);
    },
  });
  const patch = (input: Partial<ClimbLogInput>) => {
    setDraft((x) => ({ ...x, ...input }));
    setValidation(undefined);
    save.reset();
  };
  return (
    <View testID="climb-editor" style={{ gap: 16 }}>
      {showHeading && <Label syntax="name">{log ? 'Edit climb' : 'Log climb'}</Label>}
      {!log && (
        <Field
          label="Date"
          placeholder="YYYY-MM-DD"
          value={draft.date}
          editable={!save.isPending}
          onChangeText={(date) => patch({ date })}
        />
      )}
      <Choices
        label="Climbing type"
        options={climbingTypes}
        value={draft.climbingType}
        disabled={save.isPending}
        onChange={(climbingType) => {
          const gradeSystem = systemsForType(climbingType)[0]!;
          patch({
            climbingType,
            gradeSystem,
            grade: '',
            environment:
              climbingType !== 'Bouldering' && draft.environment === 'Board'
                ? 'Indoor'
                : draft.environment,
          });
          setGradeSearch('');
        }}
      />
      <Choices
        label="Grade system"
        options={systemsForType(draft.climbingType)}
        value={draft.gradeSystem}
        disabled={save.isPending}
        onChange={(gradeSystem) => {
          patch({ gradeSystem, grade: '' });
          setGradeSearch('');
        }}
      />
      {!!draft.grade && (
        <Label small syntax="number">
          Grade: {draft.grade}
        </Label>
      )}
      {
        <View style={{ gap: 8 }}>
          <Field
            label="Search grades"
            value={gradeSearch}
            onChangeText={setGradeSearch}
            editable={!save.isPending}
            autoCapitalize="none"
            placeholder={
              draft.gradeSystem === 'Font'
                ? '7A'
                : draft.gradeSystem === 'French'
                  ? '7a'
                  : draft.gradeSystem === 'V'
                    ? 'V5'
                    : '5.10a'
            }
          />
          <ScrollView
            style={{ maxHeight: 220 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {climbingGrades[draft.gradeSystem]
                .filter((grade) => grade.toLowerCase().includes(gradeSearch.trim().toLowerCase()))
                .map((grade) => (
                  <Button
                    key={grade}
                    title={grade}
                    accessibilityLabel={`Choose grade ${grade}`}
                    variant={draft.grade === grade ? 'primary' : 'secondary'}
                    disabled={save.isPending}
                    onPress={() => {
                      patch({ grade });
                    }}
                  />
                ))}
            </View>
          </ScrollView>
          {!climbingGrades[draft.gradeSystem].some((grade) =>
            grade.toLowerCase().includes(gradeSearch.trim().toLowerCase()),
          ) && <Label muted>No grades found.</Label>}
        </View>
      }
      <Choices
        label="Environment"
        options={draft.climbingType === 'Bouldering' ? climbingEnvironments : ['Indoor', 'Outdoor']}
        value={draft.environment}
        disabled={save.isPending}
        onChange={(environment) => patch({ environment })}
      />
      <Choices
        label="Outcome"
        options={climbingOutcomes}
        value={draft.outcome}
        disabled={save.isPending}
        onChange={(outcome) => {
          patch({ outcome });
          if (outcome === 'Flash' || outcome === 'Onsight') setAttempts('1');
        }}
      />
      <Field
        label="Attempts this day"
        value={attempts}
        keyboardType="number-pad"
        editable={!save.isPending}
        onChangeText={(value) => {
          setAttempts(value);
          setValidation(undefined);
        }}
      />
      <Label muted small>
        Flash: first attempt with prior information. Onsight: first attempt without prior
        information. Redpoint / sent: completed after practice or previous attempts.
      </Label>
      <Choices
        label="Wall angle"
        options={['Unspecified', ...wallAngles]}
        value={draft.wallAngle ?? 'Unspecified'}
        disabled={save.isPending}
        onChange={(value) =>
          patch({
            wallAngle: value === 'Unspecified' ? null : (value as ClimbLogInput['wallAngle']),
          })
        }
      />
      <Label small>Styles (optional, select multiple)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {climbingStyles.map((style) => (
          <Pressable
            key={style}
            accessibilityRole="checkbox"
            accessibilityLabel={style}
            accessibilityState={{ checked: draft.styles.includes(style), disabled: save.isPending }}
            aria-checked={draft.styles.includes(style)}
            aria-disabled={save.isPending}
            {...(Platform.OS === 'web'
              ? {
                  onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                    if (event.key === ' ' && !save.isPending) {
                      event.preventDefault();
                      patch({
                        styles: draft.styles.includes(style)
                          ? draft.styles.filter((x) => x !== style)
                          : [...draft.styles, style],
                      });
                    }
                  },
                }
              : {})}
            disabled={save.isPending}
            onPress={() =>
              patch({
                styles: draft.styles.includes(style)
                  ? draft.styles.filter((x) => x !== style)
                  : [...draft.styles, style],
              })
            }
            style={{
              minHeight: 42,
              justifyContent: 'center',
              padding: 10,
              borderWidth: 1,
              borderColor: draft.styles.includes(style) ? c.focus : c.line,
              backgroundColor: c.input,
            }}
          >
            <Label small syntax={draft.styles.includes(style) ? 'keyword' : undefined}>
              {style}
            </Label>
          </Pressable>
        ))}
      </View>
      <Field
        label="Route name (optional)"
        value={draft.name ?? ''}
        maxLength={100}
        editable={!save.isPending}
        onChangeText={(name) => patch({ name })}
      />
      <Field
        label="Location (optional)"
        value={draft.location ?? ''}
        maxLength={200}
        editable={!save.isPending}
        onChangeText={(location) => patch({ location })}
      />
      <ErrorNotice message={validation ?? (save.isError ? errorMessage(save.error) : undefined)} />
      <Button
        title={log ? 'Save changes' : 'Save climb'}
        busy={save.isPending}
        onPress={() => {
          if (!/^\d+$/.test(attempts) || Number(attempts) < 1 || Number(attempts) > 1000) {
            setValidation('Enter attempts as a whole number from 1 to 1000.');
            return;
          }
          const result = climbLogInputSchema.safeParse({
            ...draft,
            attempts: Number(attempts),
          });
          if (!result.success) {
            setValidation(result.error.issues[0]?.message ?? 'Check the climb details.');
            return;
          }
          save.mutate(result.data);
        }}
      />
      <Button
        title="Cancel"
        variant="secondary"
        disabled={save.isPending}
        onPress={() => onClose()}
      />
    </View>
  );
}
