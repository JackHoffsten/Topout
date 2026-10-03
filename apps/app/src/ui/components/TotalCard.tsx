import { Text } from 'react-native';
import { Card } from './Card';
import { tokens, useTheme } from '../theme';

export function TotalCard({ label, count }: { label: string; count?: number }) {
  const c = useTheme();
  return (
    <Card style={{ padding: 20, gap: 8 }}>
      <Text
        style={{
          color: c.muted,
          fontSize: 10,
          letterSpacing: 1.5,
          fontWeight: '700',
          fontFamily: tokens.font,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ color: c.syntax.number, fontSize: 28, fontWeight: '600', fontFamily: tokens.font }}
      >
        {count ?? '—'}
      </Text>
    </Card>
  );
}
