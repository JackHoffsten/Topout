import { useEffect, useRef } from 'react';
import type { ScrollView } from 'react-native';
import { useDesktop } from './theme';

// Reveal content after an explicit interaction, once layout has settled.
export function useAutoScroll() {
  const wide = useDesktop();
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef(new Map<string, number>());
  const pending = useRef<string | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const flush = () => {
    if (!pending.current) return;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      const y = positions.current.get(pending.current!);
      if (y !== undefined && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
        pending.current = undefined;
      }
    });
  };
  useEffect(flush);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );
  return {
    scrollRef,
    onContentSizeChange: flush,
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
