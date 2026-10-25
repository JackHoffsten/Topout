import { useContext, useEffect, useRef, type RefObject } from 'react';
import type { View } from 'react-native';
import { ScrollAreaContext } from './scrollArea';

export type ReorderReveal = { id: number; revision: number };

export function useReorderReveal(
  request: ReorderReveal | undefined,
  rows: RefObject<Map<number, View>>,
  dragging: boolean,
  reducedMotion: boolean,
) {
  const area = useContext(ScrollAreaContext);
  const latestArea = useRef(area);
  const handled = useRef<number | undefined>(undefined);
  latestArea.current = area;
  useEffect(() => {
    if (!request || dragging || !latestArea.current || handled.current === request.revision) return;
    handled.current = request.revision;
    const scrollArea = latestArea.current;
    const interaction = scrollArea.interaction.current;
    let cancelled = false;
    let frame: number | undefined;
    const interrupted = () => cancelled || scrollArea.interaction.current !== interaction;
    // Measure after the optimistic order (or rollback), status, and error layouts have settled.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (interrupted()) return;
        rows.current.get(request.id)?.measureInWindow((_left, top) => {
          if (interrupted()) return;
          const bounds = scrollArea.metrics.current;
          const from = bounds.offset;
          const target = Math.max(
            0,
            Math.min(from + top - bounds.top - 12, bounds.contentHeight - bounds.height),
          );
          if (reducedMotion || Math.abs(target - from) < 1) {
            scrollArea.scrollTo(target);
            return;
          }
          let started: number | undefined;
          const step = (time: number) => {
            if (interrupted()) return;
            started ??= time;
            const progress = Math.min(1, (time - started) / 260);
            const eased = 1 - Math.pow(1 - progress, 3);
            scrollArea.scrollTo(from + (target - from) * eased);
            if (progress < 1) frame = requestAnimationFrame(step);
          };
          frame = requestAnimationFrame(step);
        });
      });
    });
    return () => {
      cancelled = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [request, rows, dragging, reducedMotion]);
}
