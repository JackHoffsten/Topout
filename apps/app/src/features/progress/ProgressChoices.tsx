import { View } from 'react-native';
import { Button } from '../../ui/components/Button';

export function ProgressChoices<T extends string>({
  values,
  selected,
  onChange,
  label = (x) => x,
}: {
  values: readonly T[];
  selected: T;
  onChange: (value: T) => void;
  label?: (value: T) => string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {values.map((value) => (
        <Button
          key={value}
          title={label(value)}
          selected={selected === value}
          variant={selected === value ? 'primary' : 'secondary'}
          onPress={() => onChange(value)}
        />
      ))}
    </View>
  );
}
