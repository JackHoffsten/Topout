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
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', minWidth: 0 }}
      onMouseDownCapture={(event) => {
        // Cancel the browser's focus transfer before blur removes the option.
        // Selection still happens on click, not on mouse-down, so drags can cancel.
        event.preventDefault();
      }}
    >
      <Button
        title={location}
        accessibilityLabel={`Use location ${location}`}
        variant="secondary"
        disabled={disabled}
        onPress={() => onSelect(location)}
      />
    </div>
  );
}
