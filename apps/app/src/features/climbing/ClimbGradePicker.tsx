import { View, ScrollView } from 'react-native';
import { climbingGrades, gradeEndpoints, type GradeSystem } from '@topout/shared';
import { Button } from '../../ui/components/Button';
import { Label } from '../../ui/components/Label';
import { SearchField } from '../../ui/components/SearchField';
export function ClimbGradePicker({
  system,
  value,
  search,
  onSearch,
  disabled,
  onChange,
}: {
  system: GradeSystem;
  value: string;
  search: string;
  onSearch: (value: string) => void;
  disabled: boolean;
  onChange: (grade: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <SearchField
        label="Search grades"
        value={search}
        onChangeText={onSearch}
        editable={!disabled}
        autoCapitalize="none"
        placeholder="Search grades"
      />
      <ScrollView
        style={{ maxHeight: 220 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {climbingGrades[system]
            .filter((grade) => grade.toLowerCase().includes(search.trim().toLowerCase()))
            .map((grade) => (
              <Button
                key={grade}
                title={grade}
                accessibilityLabel={`Choose grade ${grade}`}
                variant={gradeEndpoints(system, value).includes(grade) ? 'primary' : 'secondary'}
                selected={gradeEndpoints(system, value).includes(grade)}
                disabled={
                  disabled ||
                  (gradeEndpoints(system, value).length === 2 &&
                    !gradeEndpoints(system, value).includes(grade)) ||
                  (gradeEndpoints(system, value).length === 1 &&
                    Math.abs(
                      climbingGrades[system].indexOf(grade) - climbingGrades[system].indexOf(value),
                    ) > 3)
                }
                onPress={() => {
                  const selected = gradeEndpoints(system, value);
                  const next = selected.includes(grade)
                    ? selected.filter((x) => x !== grade)
                    : [...selected, grade];
                  if (next.length > 2) return;
                  const scale = climbingGrades[system];
                  if (
                    next.length === 2 &&
                    Math.abs(scale.indexOf(next[0]!) - scale.indexOf(next[1]!)) > 3
                  )
                    return;
                  onChange(next.sort((a, b) => scale.indexOf(a) - scale.indexOf(b)).join('-'));
                }}
              />
            ))}
        </View>
      </ScrollView>
      {!climbingGrades[system].some((grade) =>
        grade.toLowerCase().includes(search.trim().toLowerCase()),
      ) && <Label muted>No grades found.</Label>}
    </View>
  );
}
