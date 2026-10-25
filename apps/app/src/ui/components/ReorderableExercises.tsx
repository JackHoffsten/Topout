import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, View, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { Label } from './Label';
import { SaveStatus } from './SaveStatus';
import { ErrorNotice } from './ErrorNotice';
import { useTheme, tokens } from '../theme';
import { ScrollAreaContext } from '../scrollArea';
import { useReducedMotion } from '../useReducedMotion';
import type { SaveFeedback } from '../saveFeedback';
import { useReorderReveal, type ReorderReveal } from '../useReorderReveal';

type Item = { exercise: { id: number; name: string }; sets?: readonly unknown[] };
type Box = { index: number; top: number; bottom: number };
type Drag = { from: number; to: number; startY: number; x: number; y: number; moved: boolean };

function MovingRow({
  shift,
  reduced,
  children,
}: {
  shift: number;
  reduced: boolean;
  children: ReactNode;
}) {
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(offset, {
      toValue: shift,
      duration: reduced ? 0 : 150,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [offset, shift, reduced]);
  return <Animated.View style={{ transform: [{ translateY: offset }] }}>{children}</Animated.View>;
}

export function ReorderableExercises<T extends Item>({
  items,
  disabled,
  onMove,
  onDragging,
  renderItem,
  feedback,
  movedId,
  reveal,
  error,
}: {
  items: T[];
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  onDragging: (dragging: boolean) => void;
  renderItem: (item: T, index: number, controls: ReactNode) => ReactNode;
  feedback?: SaveFeedback;
  movedId?: number;
  reveal?: ReorderReveal;
  error?: string;
}) {
  const c = useTheme();
  const reduced = useReducedMotion();
  const area = useContext(ScrollAreaContext);
  const root = useRef<View>(null);
  const rows = useRef(new Map<number, View>());
  const boxes = useRef<Box[]>([]);
  const list = useRef({ top: 0, left: 0, width: 280 });
  const drag = useRef<Drag | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const [preview, setPreview] = useState<Drag>();
  const currentOffset = () => area?.metrics.current.offset ?? 0;
  const stopFrame = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  };
  const cancel = () => {
    stopFrame();
    drag.current = undefined;
    setPreview(undefined);
    onDragging(false);
  };
  useEffect(
    () => () => {
      stopFrame();
      drag.current = undefined;
    },
    [],
  );
  const isDragging = !!preview;
  useReorderReveal(reveal, rows, isDragging, reduced);
  useEffect(() => {
    if (Platform.OS !== 'web' || !isDragging) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', cancel);
    };
  }, [isDragging]);
  const track = (x: number, y: number) => {
    const current = drag.current;
    if (!current) return;
    current.x = x;
    current.y = y;
    current.moved ||= Math.abs(y - current.startY) > 6;
    if (current.moved && boxes.current.length) {
      const contentY = y + currentOffset();
      const sorted = [...boxes.current].sort((a, b) => a.index - b.index);
      const containing = sorted.find((box) => contentY >= box.top && contentY <= box.bottom);
      current.to =
        containing?.index ??
        sorted.reduce(
          (best, box) =>
            Math.abs(contentY - (box.top + box.bottom) / 2) <
            Math.abs(contentY - (best.top + best.bottom) / 2)
              ? box
              : best,
          sorted[0]!,
        ).index;
    }
    setPreview({ ...current });
  };
  const start = (index: number, x: number, y: number) => {
    const current: Drag = { from: index, to: index, startY: y, x, y, moved: false };
    drag.current = current;
    boxes.current = [];
    const offset = currentOffset();
    root.current?.measureInWindow((left, top, width) => {
      list.current = { left, top: top + offset, width };
    });
    rows.current.forEach((row, id) =>
      row.measureInWindow((_x, top, _width, height) => {
        if (drag.current === current)
          boxes.current.push({
            index: items.findIndex((entry) => entry.exercise.id === id),
            top: top + offset,
            bottom: top + offset + height,
          });
      }),
    );
    setPreview({ ...current });
    onDragging(true);
    let previous = 0;
    const tick = (time: number) => {
      if (drag.current !== current) return;
      const elapsed = previous ? Math.min(32, time - previous) : 16;
      previous = time;
      const bounds = area?.metrics.current;
      if (
        area &&
        bounds &&
        current.moved &&
        current.x >= bounds.left &&
        current.x <= bounds.left + bounds.width &&
        current.y >= bounds.top &&
        current.y <= bounds.top + bounds.height
      ) {
        const zone = Math.min(96, bounds.height / 4);
        const top = Math.max(0, 1 - (current.y - bounds.top) / zone);
        const bottom = Math.max(0, 1 - (bounds.top + bounds.height - current.y) / zone);
        const speed = (bottom * bottom - top * top) * 850;
        if (speed) {
          area.scrollTo(bounds.offset + (speed * elapsed) / 1000);
          track(current.x, current.y);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  const finish = (x: number, y: number) => {
    track(x, y);
    const current = drag.current;
    cancel();
    if (current?.moved && current.from !== current.to && !disabled)
      onMove(current.from, current.to);
  };
  const source = preview ? boxes.current.find((b) => b.index === preview.from) : undefined;
  const target = preview ? boxes.current.find((b) => b.index === preview.to) : undefined;
  const sourceHeight = source ? source.bottom - source.top : 0;
  const gapTop =
    source && target && preview
      ? (preview.to > preview.from ? target.bottom - sourceHeight : target.top) - list.current.top
      : 0;
  const selected = preview ? items[preview.from] : undefined;
  const setCount = selected
    ? new Set(selected.sets?.map((set, index) => (set as { order?: number }).order ?? index) ?? [])
        .size
    : 0;
  return (
    <View ref={root} collapsable={false} style={{ gap: 24 }}>
      {items.map((item, index) => {
        const name = item.exercise.name;
        const blocked = disabled || items.length < 2;
        const responder = PanResponder.create({
          onStartShouldSetPanResponder: () => !blocked && !drag.current,
          onPanResponderGrant: (event) =>
            start(index, event.nativeEvent.pageX, event.nativeEvent.pageY),
          onPanResponderMove: (event) => track(event.nativeEvent.pageX, event.nativeEvent.pageY),
          onPanResponderRelease: (event) =>
            finish(event.nativeEvent.pageX, event.nativeEvent.pageY),
          onPanResponderTerminate: cancel,
          onPanResponderTerminationRequest: () => false,
        });
        const controls = (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View
                {...responder.panHandlers}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Drag ${name} to reorder`}
                accessibilityHint="Drag to another position. Hold near the top or bottom to scroll. You can also use the move buttons."
                accessibilityState={{ disabled: blocked }}
                onAccessibilityEscape={cancel}
                style={
                  {
                    minWidth: 42,
                    minHeight: 42,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: tokens.radius.sm,
                    backgroundColor: c.soft,
                    opacity: blocked ? 0.6 : 1,
                    ...(Platform.OS === 'web'
                      ? {
                          touchAction: 'none',
                          userSelect: 'none',
                          cursor: blocked ? 'default' : isDragging ? 'grabbing' : 'grab',
                        }
                      : {}),
                  } as ViewStyle
                }
              >
                <Label>⠿</Label>
              </View>
              <Button
                title="↑"
                accessibilityLabel={`Move ${name} up`}
                variant="secondary"
                disabled={disabled || index === 0 || isDragging}
                onPress={() => onMove(index, index - 1)}
              />
              <Button
                title="↓"
                accessibilityLabel={`Move ${name} down`}
                variant="secondary"
                disabled={disabled || index === items.length - 1 || isDragging}
                onPress={() => onMove(index, index + 1)}
              />
            </View>
            {movedId === item.exercise.id && (
              <>
                <SaveStatus feedback={feedback} />
                <ErrorNotice message={error} />
              </>
            )}
          </View>
        );
        const shift =
          preview &&
          source &&
          preview.to > preview.from &&
          index > preview.from &&
          index <= preview.to
            ? -(sourceHeight + 24)
            : preview &&
                source &&
                preview.to < preview.from &&
                index >= preview.to &&
                index < preview.from
              ? sourceHeight + 24
              : 0;
        return (
          <View
            key={item.exercise.id}
            collapsable={false}
            ref={(row) => {
              if (row) rows.current.set(item.exercise.id, row);
              else rows.current.delete(item.exercise.id);
            }}
            style={{
              borderWidth: 2,
              borderRadius: tokens.radius.md,
              borderColor:
                !preview && movedId === item.exercise.id && feedback?.phase === 'saved'
                  ? c.accent
                  : 'transparent',
              opacity: preview?.from === index ? 0 : 1,
            }}
          >
            <MovingRow shift={shift} reduced={reduced}>
              {renderItem(item, index, controls)}
            </MovingRow>
          </View>
        );
      })}
      {preview && source && (
        <View
          testID="drag-placeholder"
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: gapTop,
            left: 0,
            right: 0,
            height: sourceHeight,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: c.accent,
            backgroundColor: c.soft,
            borderRadius: tokens.radius.md,
          }}
        >
          <View
            testID="drag-insertion-line"
            style={{
              position: 'absolute',
              top: -3,
              left: -2,
              right: -2,
              height: 4,
              backgroundColor: c.accent,
            }}
          />
          <View style={{ padding: 12 }}>
            <Label small>Drop in position {preview.to + 1}</Label>
          </View>
        </View>
      )}
      {preview && selected && (
        <View
          testID="drag-preview"
          pointerEvents="none"
          style={{
            position: 'absolute',
            zIndex: 100,
            elevation: 8,
            top:
              Math.max(preview.y, (area?.metrics.current.top ?? 0) + 80) +
              currentOffset() -
              list.current.top -
              72,
            left: Math.max(
              4,
              Math.min(preview.x - list.current.left + 16, list.current.width - 264),
            ),
            width: Math.min(260, list.current.width),
            padding: 12,
            gap: 4,
            borderWidth: 2,
            borderColor: c.accent,
            borderRadius: tokens.radius.md,
            backgroundColor: c.surface,
          }}
        >
          <Label syntax="name">{selected.exercise.name}</Label>
          <Label small>
            {setCount} {setCount === 1 ? 'set' : 'sets'} · Position {preview.to + 1}
          </Label>
        </View>
      )}
    </View>
  );
}
