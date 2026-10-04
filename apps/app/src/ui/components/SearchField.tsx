import { useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, View, type ScrollView, type TextInputProps } from 'react-native';
import { useDesktop } from '../theme';
import { Field } from './Field';

// Keep the query and its results above the mobile keyboard, including nested pickers.
export function SearchField({
  scrollRef,
  ...props
}: TextInputProps & { label: string; scrollRef: RefObject<ScrollView | null> }) {
  const wide = useDesktop();
  const field = useRef<View>(null);
  const [focused, setFocused] = useState(false);
  const reveal = () => {
    if (wide) return;
    const scroll = scrollRef.current;
    const content = scroll?.getInnerViewNode();
    if (!scroll || !content) return;
    field.current?.measureLayout(
      content,
      (_x, y) => {
        scroll.scrollTo({ y: Math.max(0, y - 12), animated: true });
      },
      () => {},
    );
  };
  useEffect(() => {
    if (!focused || wide) return;
    const frame = requestAnimationFrame(reveal);
    const listener = Keyboard.addListener('keyboardDidShow', reveal);
    return () => {
      cancelAnimationFrame(frame);
      listener.remove();
    };
  }, [focused, wide]);
  return (
    <View ref={field} collapsable={false}>
      <Field
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onChangeText={(value) => {
          props.onChangeText?.(value);
          if (focused) requestAnimationFrame(reveal);
        }}
      />
    </View>
  );
}
