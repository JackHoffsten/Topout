import { View, type ViewStyle, type ViewProps } from 'react-native';
import { useTheme, tokens } from '../theme';

export function Card({
  children,
  style,
  onLayout,
}: React.PropsWithChildren<{ style?: ViewStyle; onLayout?: ViewProps['onLayout'] }>) {
  const c = useTheme();
  return (
    <View
      onLayout={onLayout}
      style={[
        {
          padding: 20,
          borderRadius: tokens.radius.md,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
