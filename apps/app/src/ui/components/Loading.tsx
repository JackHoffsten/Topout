import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../theme';
import { Label } from './Label';

export function Loading({ text = 'Loading…' }: { text?: string }) {
  const c = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        gap: 16,
        backgroundColor: c.bg,
      }}
    >
      <ActivityIndicator color={c.primary} />
      <Label muted>{text}</Label>
    </View>
  );
}