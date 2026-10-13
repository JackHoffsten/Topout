import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import {
  climbingLabel,
  climbingTypes,
  gradeSystems,
  climbingEnvironments,
  climbingOutcomes,
  wallAngles,
  climbingStyles,
  climbingGrades,
  filterValues,
  toggleFilter,
  type ClimbHistoryFilters,
} from '@topout/shared';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { Label } from '../../ui/components/Label';
import { Field } from '../../ui/components/Field';
import { SearchField } from '../../ui/components/SearchField';
import { ErrorNotice } from '../../ui/components/ErrorNotice';

export function ClimbHistoryFilterEditor({
  visible,
  onApply,
  onClear,
  onClose,
  draft,
  setDraft,
  filterError,
  setFilterError,
}: {
  draft: ClimbHistoryFilters;
  setDraft: (filters: ClimbHistoryFilters) => void;
  filterError?: string;
  setFilterError: (error: string | undefined) => void;
  visible: boolean;
  onApply: (filters: ClimbHistoryFilters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeSearch, setGradeSearch] = useState('');
  if (!visible) return null;
  return (
    <Card>
      <View style={{ gap: 6 }}>
        <Label small>Projects</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(
            [
              [undefined, 'All climbs'],
              ['projects', 'Projects'],
              ['unfinished', 'Unfinished projects'],
              ['completed', 'Completed projects'],
              ['none', 'Not projects'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value ?? 'all'}
              title={label}
              accessibilityLabel={`Filter projects: ${label}`}
              selected={draft.project === value}
              variant={draft.project === value ? 'primary' : 'secondary'}
              onPress={() => setDraft({ ...draft, project: value })}
            />
          ))}
        </View>
      </View>
      {(
        [
          ['climbingType', 'Climbing type', climbingTypes],
          ['gradeSystem', 'Grade system', gradeSystems],
          ['environment', 'Environment', climbingEnvironments],
          ['outcome', 'Outcome', climbingOutcomes],
          ['wallAngle', 'Wall angle', wallAngles],
          ['style', 'Style', climbingStyles],
        ] as const
      ).map(([key, label, options]) => (
        <View key={key} style={{ gap: 6 }}>
          <Label small>{label}</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {[undefined, ...options].map((value) => (
              <Button
                key={value ?? 'all'}
                title={value ? climbingLabel(value) : 'All'}
                accessibilityLabel={`Filter ${label}: ${value ? climbingLabel(value) : 'All'}`}
                selected={
                  value
                    ? filterValues(draft[key]).includes(value)
                    : filterValues(draft[key]).length === 0
                }
                variant={
                  (
                    value
                      ? filterValues(draft[key]).includes(value)
                      : filterValues(draft[key]).length === 0
                  )
                    ? 'primary'
                    : 'secondary'
                }
                onPress={() => {
                  setDraft({
                    ...draft,
                    [key]: value ? toggleFilter(filterValues(draft[key]), value) : undefined,
                    ...(key === 'gradeSystem' ? { grade: undefined } : {}),
                  });
                  if (key === 'gradeSystem') {
                    setGradeOpen(false);
                    setGradeSearch('');
                  }
                }}
              />
            ))}
          </View>
        </View>
      ))}
      <View style={{ gap: 6 }}>
        <Label small>Grade</Label>
        {filterValues(draft.gradeSystem).length === 0 && (
          <Label small muted>
            Choose a grade system to filter by grade.
          </Label>
        )}
        <Button
          title={filterValues(draft.grade).join(', ') || 'All grades'}
          accessibilityLabel="Select grade filter"
          variant="secondary"
          disabled={filterValues(draft.gradeSystem).length === 0}
          onPress={() => {
            setGradeOpen(!gradeOpen);
            setGradeSearch('');
          }}
        />
        {gradeOpen && filterValues(draft.gradeSystem).length > 0 && (
          <View style={{ gap: 6 }}>
            <SearchField
              label="Search filter grades"
              value={gradeSearch}
              onChangeText={setGradeSearch}
            />
            <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
              <View style={{ gap: 6 }}>
                <Button
                  title="All grades"
                  accessibilityLabel="Filter grade: All"
                  variant="secondary"
                  onPress={() => {
                    setDraft({ ...draft, grade: undefined });
                    setGradeOpen(false);
                  }}
                />
                {Array.from(
                  new Set(
                    filterValues(draft.gradeSystem).flatMap(
                      (system) => climbingGrades[system as keyof typeof climbingGrades],
                    ),
                  ),
                )
                  .filter((grade) => grade.toLowerCase().includes(gradeSearch.trim().toLowerCase()))
                  .map((grade) => (
                    <Button
                      key={grade}
                      title={grade}
                      accessibilityLabel={`Filter grade: ${grade}`}
                      selected={filterValues(draft.grade).includes(grade)}
                      variant={filterValues(draft.grade).includes(grade) ? 'primary' : 'secondary'}
                      onPress={() => {
                        setDraft({
                          ...draft,
                          grade: toggleFilter(filterValues(draft.grade), grade),
                        });
                      }}
                    />
                  ))}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
      <Field
        label="From date"
        placeholder="YYYY-MM-DD"
        value={draft.from ?? ''}
        onChangeText={(from) => setDraft({ ...draft, from })}
      />
      <Field
        label="To date"
        placeholder="YYYY-MM-DD"
        value={draft.to ?? ''}
        onChangeText={(to) => setDraft({ ...draft, to })}
      />
      {filterError && <ErrorNotice message={filterError} />}
      <View
        testID="climb-filter-actions"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
      >
        <Button
          title="Apply"
          accessibilityLabel="Apply filters"
          onPress={() => {
            const validDate = (value?: string) =>
              !value ||
              (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
                value >= '0001-01-01' &&
                !Number.isNaN(Date.parse(value)) &&
                new Date(value).toISOString().slice(0, 10) === value);
            if (
              !validDate(draft.from) ||
              !validDate(draft.to) ||
              (draft.from && draft.to && draft.from > draft.to)
            ) {
              setFilterError('Choose valid dates with the end on or after the start.');
              return;
            }
            setFilterError(undefined);
            onApply(draft);
          }}
        />
        <Button
          title="Clear"
          accessibilityLabel="Clear filters"
          variant="secondary"
          onPress={() => {
            setDraft({});
            onClear();
            setFilterError(undefined);
          }}
        />
        <View style={{ marginLeft: 'auto' }}>
          <Button title="Close" variant="secondary" onPress={() => onClose()} />
        </View>
      </View>
    </Card>
  );
}
