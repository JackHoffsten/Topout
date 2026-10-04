import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function NavigationContent({ blocked, children }: PropsWithChildren<{ blocked: boolean }>) {
  return (
    <View
      style={{ flex: 1, minWidth: 0, minHeight: 0 }}
      pointerEvents={blocked ? 'none' : 'auto'}
      accessibilityElementsHidden={blocked}
      importantForAccessibility={blocked ? 'no-hide-descendants' : 'auto'}
    >
      {children}
    </View>
  );
}
