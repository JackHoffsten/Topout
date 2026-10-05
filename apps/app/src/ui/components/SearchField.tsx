import { useContext, useEffect, useRef, type RefObject } from 'react';
import { Platform, View, type ScrollView, type TextInputProps } from 'react-native';
import { useDesktop } from '../theme';
import { Field } from './Field';
import { SearchFocus } from '../searchFocus';

export function revealSearchField(scroll: ScrollView | null, field: View | null) {
  const content =
    Platform.OS === 'web'
      ? scroll?.getInnerViewNode()
      : (scroll as (ScrollView & { getInnerViewRef(): View | null }) | null)?.getInnerViewRef();
  if (!scroll || !content) return;
  field?.measureLayout(
    content,
    (_x, y) => {
      scroll.scrollTo({ y: Math.max(0, y), animated: false });
    },
    () => {},
  );
}

// Keep the query and its results above the mobile keyboard, including nested pickers.
export function SearchField({
  scrollRef,
  ...props
}: TextInputProps & { label: string; scrollRef: RefObject<ScrollView | null> }) {
  const wide = useDesktop();
  const field = useRef<View>(null);
  const height = useRef(70);
  const focusSearch = useContext(SearchFocus);
  useEffect(() => () => focusSearch(null), [focusSearch]);
  const reveal = () => {
    if (wide || Platform.OS !== 'web') return;
    // Fabric requires a native component ref, not the numeric handle returned by
    // getInnerViewNode. Numeric handles silently prevent the measurement callback.
    revealSearchField(scrollRef.current, field.current);
  };
  return (
    <View
      ref={field}
      collapsable={false}
      onLayout={(event) => {
        height.current = event.nativeEvent.layout.height;
      }}
    >
      <Field
        {...props}
        onFocus={(event) => {
          if (!wide) focusSearch(height.current);
          reveal();
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          focusSearch(null);
          props.onBlur?.(event);
        }}
      />
    </View>
  );
}
