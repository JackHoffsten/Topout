import React from 'react';
import { Text } from 'react-native';
import { useTheme, tokens } from '../theme';

export function Heading({
  children,
  large = false,
  name = false,
}: React.PropsWithChildren<{ large?: boolean; name?: boolean }>) {
  const c = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: name ? c.syntax.name : c.ink,
        fontSize: large ? 30 : 22,
        lineHeight: large ? 38 : 30,
        fontWeight: '600',
        fontFamily: tokens.font,
      }}
    >
      {children}
    </Text>
  );
}
