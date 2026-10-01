import { View, Text } from 'react-native';
import { useTheme, tokens } from '../theme';

export function ErrorNotice({ message }: { message?: string }) {
  const c = useTheme();
  return message ? (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: c.errorBg,
        padding: 16,
        borderRadius: tokens.radius.sm,
        borderWidth: 1,
        borderColor: c.error,
      }}
    >
      <Text style={{ color: c.error, lineHeight: 22, fontFamily: tokens.font }}>{message}</Text>
    </View>
  ) : null;
}