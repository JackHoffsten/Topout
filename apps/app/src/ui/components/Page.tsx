import React from 'react';
import { ScrollView } from 'react-native';
import { useTheme } from '../theme';

export function Page({ children }: React.PropsWithChildren) {
  const c = useTheme();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        padding: 24,
        paddingBottom: 40,
        width: '100%',
        maxWidth: 1100,
        alignSelf: 'center',
        gap: 24,
      }}
    >
      {children}
    </ScrollView>
  );
}