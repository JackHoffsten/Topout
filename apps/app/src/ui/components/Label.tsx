import React from 'react';
import { Text } from 'react-native';
import { useTheme, tokens, type SyntaxKind } from '../theme';

export function Label({
  children,
  muted = false,
  small = false,
  syntax,
  selectable,
}: React.PropsWithChildren<{
  muted?: boolean;
  small?: boolean;
  syntax?: SyntaxKind;
  selectable?: boolean;
}>) {
  const c = useTheme();
  return (
    <Text
      selectable={selectable}
      style={{
        color: syntax ? c.syntax[syntax] : muted ? c.muted : c.ink,
        fontSize: small ? 13 : 16,
        lineHeight: small ? 20 : 25,
        fontFamily: tokens.font,
      }}
    >
      {children}
    </Text>
  );
}
