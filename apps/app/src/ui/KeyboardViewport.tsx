import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function KeyboardViewport({ children }: PropsWithChildren) {
  return <View style={{ flex: 1, minHeight: 0 }}>{children}</View>;
}
