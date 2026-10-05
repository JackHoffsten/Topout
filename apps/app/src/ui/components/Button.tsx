import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, type GestureResponderEvent } from 'react-native';
import { useTheme, tokens } from '../theme';

export function Button({
  title,
  onPress,
  onPressIn,
  variant = 'primary',
  busy = false,
  disabled = false,
  testID,
  accessibilityLabel,
  selected,
}: {
  title: string;
  onPress: () => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  selected?: boolean;
}) {
  const c = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || busy, busy, selected }}
      aria-pressed={selected}
      disabled={disabled || busy}
      onPress={onPress}
      onPressIn={onPressIn}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: 42,
        borderRadius: tokens.radius.sm,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor:
          variant === 'primary' ? c.primary : variant === 'danger' ? c.error : c.soft,
        borderWidth: 1,
        borderColor: focused ? c.focus : 'transparent',
        opacity: disabled || busy ? 0.6 : pressed ? 0.8 : 1,
      })}
    >
      {busy && <ActivityIndicator color={variant === 'secondary' ? c.ink : c.onPrimary} />}
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: variant === 'secondary' ? c.ink : c.onPrimary,
          fontFamily: tokens.font,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
