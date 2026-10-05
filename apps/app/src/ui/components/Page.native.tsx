import React, { useRef, useState } from 'react';
import { View, useWindowDimensions, type ScrollView, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView, useKeyboardState } from 'react-native-keyboard-controller';
import { useTheme } from '../theme';
import { SearchFocus, searchKeyboardOffset } from '../searchFocus';

export function Page({
  children,
  scrollRef,
  onContentSizeChange,
}: React.PropsWithChildren<{
  scrollRef?: React.Ref<ScrollView>;
  onContentSizeChange?: ScrollViewProps['onContentSizeChange'];
}>) {
  const c = useTheme();
  const frame = useRef<View>(null);
  const [pageTop, setPageTop] = useState(0);
  const [searchHeight, setSearchHeight] = useState<number | null>(null);
  const { height } = useWindowDimensions();
  const keyboardHeight = useKeyboardState((state) => state.height);
  return (
    <SearchFocus.Provider value={setSearchHeight}>
      <View
        ref={frame}
        style={{ flex: 1, minHeight: 0, backgroundColor: c.bg }}
        onLayout={() => frame.current?.measureInWindow((_x, y) => setPageTop(y))}
      >
        <KeyboardAwareScrollView
          ref={(instance) => {
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
          onContentSizeChange={onContentSizeChange}
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
        </KeyboardAwareScrollView>
      </View>
    </SearchFocus.Provider>
  );
}
