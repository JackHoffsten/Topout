import { useContext, useEffect, useRef, type RefObject } from 'react';
import { View, type ScrollView, type TextInputProps } from 'react-native';
import { useDesktop } from '../theme';
import { Field } from './Field';
import { SearchFocus } from '../searchFocus';

// Keep the query and its results above the mobile keyboard, including nested pickers.
export function SearchField({
  scrollRef,
  ...props
}: TextInputProps & { label: string; scrollRef?: RefObject<ScrollView | null> }) {
  const wide = useDesktop();
  const height = useRef(70);
  const focusSearch = useContext(SearchFocus);
  useEffect(() => () => focusSearch(null), [focusSearch]);
  return (
    <View
      collapsable={false}
      onLayout={(event) => {
        height.current = event.nativeEvent.layout.height;
      }}
    >
      <Field
        {...props}
        keyboardPlacement="results"
        onFocus={(event) => {
          if (!wide) focusSearch(height.current);
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
