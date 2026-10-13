import { Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { tokens, useTheme } from '../../ui/theme';

export function CalendarBadge({
  size,
  testID,
  icon,
  color,
  backgroundColor,
  label,
  count,
}: {
  size: number;
  testID: string;
  icon: 'dumbbell' | 'moon' | 'terrain';
  color: string;
  backgroundColor?: string;
  label?: string;
  count?: number;
}) {
  const c = useTheme();
  const iconSize = Math.round(size * 0.68);
  const compactCount = size < 24;
  const countSize = compactCount
    ? Math.max(8, Math.round(size * 0.42))
    : Math.max(11, Math.round(size * 0.55));
  const countLabel =
    compactCount && count !== undefined && count > 9
      ? '9+'
      : count !== undefined && count > 99
        ? '99+'
        : count;
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size,
        maxWidth: size,
        minHeight: size,
        maxHeight: size,
        flexShrink: 0,
        borderRadius: tokens.radius.md,
        backgroundColor: backgroundColor ?? c.input,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <CalendarIcon
        icon={icon}
        size={iconSize}
        color={color}
        style={{
          width: iconSize,
          height: iconSize,
          lineHeight: iconSize,
          textAlign: 'center',
          flexShrink: 0,
        }}
      />
      {count !== undefined && count > 1 && (
        <View
          testID={`${testID}-count`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: compactCount ? -4 : -3,
            right: compactCount ? -3 : -1,
            width: countSize,
            height: countSize,
            borderRadius: countSize / 2,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: c.onPrimary,
              fontFamily: tokens.font,
              fontSize: Math.max(6, Math.round(countSize * (count > 9 ? 0.48 : 0.65))),
              lineHeight: countSize - 2,
              fontWeight: '700',
            }}
          >
            {countLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

export function CalendarIcon({
  icon,
  ...props
}: {
  icon: 'dumbbell' | 'moon' | 'terrain';
  size: number;
  color: string;
  style?: import('react-native').TextStyle;
}) {
  if (icon === 'moon') return <Ionicons name="moon" {...props} />;
  return (
    <MaterialCommunityIcons
      name={icon}
      {...props}
      style={[props.style, icon === 'terrain' ? { transform: [{ scaleY: 1.2 }] } : undefined]}
    />
  );
}
