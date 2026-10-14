import { useEffect, useRef } from 'react';
import { Keyboard, type ScrollView, type ScrollViewProps } from 'react-native';
import { useDesktop } from './theme';

// Reveal content after an explicit interaction, once layout has settled.
export function useAutoScroll() {
  const wide = useDesktop();
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef(new Map<string, number>());
  const pending = useRef<string | number | undefined>(undefined);
  const offset = useRef(0);
  const rememberedOffset = useRef(0);
  const waitingForKeyboard = useRef(false);
  const frame = useRef<number | undefined>(undefined);
  const flush = () => {
    if (pending.current === undefined || waitingForKeyboard.current) return;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      const y =
        typeof pending.current === 'number'
          ? pending.current
          : positions.current.get(pending.current!);
      if (y !== undefined && scrollRef.current) {
        const restoring = typeof pending.current === 'number';
        scrollRef.current.scrollTo({
          y: Math.max(0, restoring ? y : y - 12),
          animated: !restoring,
        });
        pending.current = undefined;
      }
    });
  };
  useEffect(flush);
  useEffect(() => {
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      if (!waitingForKeyboard.current) return;
      waitingForKeyboard.current = false;
      flush();
    });
    return () => hidden.remove();
  }, []);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );
  return {
    scrollRef,
    onScroll: ((event) => {
      offset.current = event.nativeEvent.contentOffset.y;
    }) satisfies NonNullable<ScrollViewProps['onScroll']>,
    onContentSizeChange: flush,
    remember: () => {
      rememberedOffset.current = offset.current;
    },
    restore: () => {
      pending.current = rememberedOffset.current;
      waitingForKeyboard.current = Keyboard.isVisible();
      Keyboard.dismiss();
      flush();
    },
    register: (key: string, y: number) => {
      positions.current.set(key, y);
      flush();
    },
    reveal: (key: string, enabled = !wide) => {
      pending.current = enabled ? key : undefined;
      if (!enabled && frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
        frame.current = undefined;
      }
    },
  };
}
