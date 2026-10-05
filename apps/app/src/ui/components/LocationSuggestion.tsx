import { Button } from './Button';

export function LocationSuggestion({
  location,
  disabled,
  onSelect,
}: {
  location: string;
  disabled: boolean;
  onSelect: (location: string) => void;
}) {
  return (
    <Button
      title={location}
      accessibilityLabel={`Use location ${location}`}
      variant="secondary"
      disabled={disabled}
      onPressIn={() => onSelect(location)}
      onPress={() => onSelect(location)}
    />
  );
}
