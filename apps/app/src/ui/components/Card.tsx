import { View, type ViewStyle } from 'react-native';
import { useTheme, tokens } from '../theme';

export function Card({ children, style }: React.PropsWithChildren<{ style?: ViewStyle }>) {
  const c = useTheme();
  return (
    <View
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