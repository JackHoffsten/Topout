import React, { useRef } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useTheme } from '../theme';
import { ScrollAreaContext, type ScrollMetrics } from '../scrollArea';
import { CarriedSaveStatus } from './SaveStatus';

export function Page({
  children,
  scrollRef,
  onContentSizeChange,
  onScroll,
  scrollEnabled = true,
}: React.PropsWithChildren<{
  scrollRef?: React.Ref<ScrollView>;
  onContentSizeChange?: ScrollViewProps['onContentSizeChange'];
  onScroll?: ScrollViewProps['onScroll'];
  scrollEnabled?: boolean;
}>) {
  const c = useTheme();
  const ref = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const interaction = useRef(0);
  const metrics = useRef<ScrollMetrics>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    contentHeight: 0,
    offset: 0,
  });
  const scrollTo = (offset: number) => {
    const value = Math.max(
      0,
      Math.min(offset, metrics.current.contentHeight - metrics.current.height),
    );
    metrics.current.offset = value;
    ref.current?.scrollTo({ y: value, animated: false });
  };
  return (
    <ScrollAreaContext.Provider value={{ ref, metrics, interaction, scrollTo }}>
      <View
        {...{
          onWheel: () => {
            interaction.current++;
          },
          onPointerDown: () => {
            interaction.current++;
          },
          onKeyDown: (event: { key: string }) => {
            if (
              ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)
            )
              interaction.current++;
          },
        }}
        ref={viewport}
        collapsable={false}
        style={{ flex: 1, minHeight: 0 }}
        onLayout={() =>
          viewport.current?.measureInWindow((left, top, width, height) => {
            Object.assign(metrics.current, { left, top, width, height });
          })
        }
      >
        <ScrollView
          testID="page-scroll"
          ref={(view) => {
            ref.current = view;
            if (typeof scrollRef === 'function') scrollRef(view);
            else if (scrollRef) scrollRef.current = view;
          }}
          scrollEnabled={scrollEnabled}
          onScrollBeginDrag={() => {
            interaction.current++;
          }}
          onTouchStart={() => {
            interaction.current++;
          }}
          onContentSizeChange={(width, height) => {
            metrics.current.contentHeight = height;
            onContentSizeChange?.(width, height);
          }}
          onScroll={(event) => {
            metrics.current.offset = event.nativeEvent.contentOffset.y;
            onScroll?.(event);
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
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
          <CarriedSaveStatus />
          {children}
        </ScrollView>
      </View>
    </ScrollAreaContext.Provider>
  );
}
