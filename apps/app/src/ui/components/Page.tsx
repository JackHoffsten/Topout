import React from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';
import { useTheme } from '../theme';

export function Page({
  children,
  scrollRef,
  onContentSizeChange,
}: React.PropsWithChildren<{
  scrollRef?: React.Ref<ScrollView>;
  onContentSizeChange?: ScrollViewProps['onContentSizeChange'];
}>) {
  const c = useTheme();
  return (
    <ScrollView
      ref={scrollRef}
      onContentSizeChange={onContentSizeChange}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator
      style={{ flex: 1, minHeight: 0, backgroundColor: c.bg }}
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
