import { Platform, Pressable, View } from 'react-native';
import { climbingLabel } from '@topout/shared';
import { Label } from '../../ui/components/Label';
import { useTheme } from '../../ui/theme';

export function ClimbingChoices<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  disabledOptions = [],
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
  disabledOptions?: readonly T[];
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
            accessibilityState={{
              checked: value === option,
              disabled: disabled || disabledOptions.includes(option),
            }}
            aria-checked={value === option}
            aria-disabled={disabled || disabledOptions.includes(option)}
            disabled={disabled || disabledOptions.includes(option)}
            onPress={() => onChange(option)}
            {...(Platform.OS === 'web'
              ? {
                  tabIndex: value === option ? (0 as const) : (-1 as const),
                  onKeyDown: (event: {
                    key: string;
                    preventDefault: () => void;
                    currentTarget: HTMLElement;
                  }) => {
                    if (disabled || disabledOptions.includes(option)) return;
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
                      let index = options.indexOf(option);
                      do {
                        index = (index + direction + options.length) % options.length;
                      } while (
                        disabledOptions.includes(options[index]!) &&
                        index !== options.indexOf(option)
                      );
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
              opacity: disabled || disabledOptions.includes(option) ? 0.5 : 1,
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
