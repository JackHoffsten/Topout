import React, { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions, type ScrollView, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView, useKeyboardState } from 'react-native-keyboard-controller';
import { useTheme } from '../theme';
import { SearchFocus, searchKeyboardOffset } from '../searchFocus';
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
  const frame = useRef<View>(null);
  const ref = useRef<ScrollView>(null);
  const interaction = useRef(0);
  const metrics = useRef<ScrollMetrics>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    contentHeight: 0,
    offset: 0,
  });
  const [pageTop, setPageTop] = useState(0);
  const [searchHeight, setSearchHeight] = useState<number | null>(null);
  const { height } = useWindowDimensions();
  const keyboardHeight = useKeyboardState((state) => state.height);
  const measure = () =>
    frame.current?.measureInWindow((left, top, width, viewportHeight) => {
      setPageTop(top);
      Object.assign(metrics.current, {
        left,
        top,
        width,
        height: Math.max(0, Math.min(viewportHeight, height - keyboardHeight - top)),
      });
    });
  useEffect(measure, [height, keyboardHeight]);
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
      <SearchFocus.Provider value={setSearchHeight}>
        <View
          ref={frame}
          style={{ flex: 1, minHeight: 0, backgroundColor: c.bg }}
          collapsable={false}
          onLayout={measure}
        >
          <KeyboardAwareScrollView
            testID="page-scroll"
            scrollEnabled={scrollEnabled}
            onScrollBeginDrag={() => {
              interaction.current++;
            }}
            onTouchStart={() => {
              interaction.current++;
            }}
            ref={(instance) => {
              ref.current = instance;
              if (typeof scrollRef === 'function') scrollRef(instance);
              else if (scrollRef) scrollRef.current = instance;
            }}
            bottomOffset={
              searchHeight === null
                ? 12
                : searchKeyboardOffset(height, keyboardHeight, pageTop, searchHeight)
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={(width, contentHeight) => {
              metrics.current.contentHeight = contentHeight;
              onContentSizeChange?.(width, contentHeight);
            }}
            onScroll={(event) => {
              metrics.current.offset = event.nativeEvent.contentOffset.y;
              onScroll?.(event);
            }}
            scrollEventThrottle={16}
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
            <CarriedSaveStatus />
            {children}
          </KeyboardAwareScrollView>
        </View>
      </SearchFocus.Provider>
    </ScrollAreaContext.Provider>
  );
}
