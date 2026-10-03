import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ChartPoint } from '@topout/shared';
import { Card } from '../../ui/components/Card';
import { Label } from '../../ui/components/Label';
import { Button } from '../../ui/components/Button';
import { tokens, useTheme } from '../../ui/theme';

export type ChartSeries = { name: string; color: string; points: ChartPoint[] };
const stamp = (date: string) => Date.parse(date + 'T12:00:00Z');
const shortDate = (date: string) =>
  new Date(stamp(date)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** View-based plotting works on native and web without a separate browser chart library. */
export function ProgressChart({
  title,
  subtitle,
  series,
  format = (value) => String(Math.round(value)),
  bars = false,
  ordinal = false,
  ceiling,
}: {
  title: string;
  subtitle?: string;
  series: ChartSeries[];
  format?: (value: number) => string;
  bars?: boolean;
  ordinal?: boolean;
  ceiling?: number;
}) {
  const c = useTheme();
  const [width, setWidth] = useState(240);
  const [selected, setSelected] = useState<string>();
  const [table, setTable] = useState(false);
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const min = ordinal && values.length ? Math.max(1, Math.min(...values) - 1) : 0;
  const max = Math.max(min + 1, ceiling ?? 0, ...values);
  const height = 180;
  const plotWidth = Math.max(1, width - 44);
  const start = stamp(dates[0] ?? '2000-01-01');
  const end = stamp(dates.at(-1) ?? '2000-01-01');
  const x = (date: string) =>
    end === start ? width / 2 : 22 + ((stamp(date) - start) / (end - start)) * plotWidth;
  const y = (value: number) => 12 + height - ((value - min) / (max - min)) * height;
  const chosen = dates.includes(selected ?? '') ? selected! : dates.at(-1);
  const ticks = [
    ...new Set(
      [0, 1, 2, 3].map((i) =>
        ordinal || ceiling === 7
          ? Math.round(min + ((max - min) * i) / 3)
          : min + ((max - min) * i) / 3,
      ),
    ),
  ];
  const barWidth = Math.min(
    32,
    (plotWidth / Math.max(1, dates.length) / Math.max(1, series.length)) * 0.65,
  );
  return (
    <Card>
      <Label syntax="name">{title}</Label>
      {!!subtitle && (
        <Label small muted>
          {subtitle}
        </Label>
      )}
      {!dates.length ? (
        <Label muted>No logged data for this selection.</Label>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {series.map((s, index) => (
              <View key={s.name} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: index === 0 ? 4 : 1,
                    backgroundColor: s.color,
                  }}
                />
                <Label small>{s.name}</Label>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', height: height + 44 }}>
            <View style={{ width: 54 }}>
              {ticks.map((value) => (
                <Text
                  key={value}
                  style={{
                    position: 'absolute',
                    top: y(value) - 8,
                    fontFamily: tokens.font,
                    fontSize: 11,
                    color: c.muted,
                  }}
                >
                  {format(value)}
                </Text>
              ))}
            </View>
            <View
              onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
              style={{ flex: 1, minWidth: 0 }}
            >
              {ticks.map((value) => (
                <View
                  key={value}
                  style={{
                    position: 'absolute',
                    top: y(value),
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: c.line,
                  }}
                />
              ))}
              {chosen && (
                <View
                  style={{
                    position: 'absolute',
                    left: x(chosen),
                    top: 8,
                    height: height + 4,
                    width: 1,
                    backgroundColor: c.muted,
                    opacity: 0.4,
                  }}
                />
              )}
              {series.map((s, seriesIndex) => (
                <View
                  key={s.name}
                  pointerEvents="box-none"
                  style={{ position: 'absolute', inset: 0 }}
                >
                  {!bars &&
                    s.points.slice(1).map((point, i) => {
                      const prev = s.points[i];
                      const dx = x(point.date) - x(prev.date),
                        dy = y(point.value) - y(prev.value);
                      const length = Math.sqrt(dx * dx + dy * dy);
                      return (
                        <View
                          key={point.date}
                          pointerEvents="none"
                          style={{
                            position: 'absolute',
                            left: (x(prev.date) + x(point.date)) / 2 - length / 2,
                            top: (y(prev.value) + y(point.value)) / 2 - 1,
                            width: length,
                            height: 2,
                            backgroundColor: seriesIndex === 0 ? s.color : 'transparent',
                            borderTopWidth: seriesIndex === 0 ? 0 : 2,
                            borderColor: s.color,
                            borderStyle: seriesIndex === 0 ? 'solid' : 'dashed',
                            transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                          }}
                        />
                      );
                    })}
                  {s.points.map((point) => (
                    <Pressable
                      key={point.date}
                      accessibilityRole="button"
                      accessibilityLabel={`${title}, ${s.name}, ${point.date}, ${format(point.value)}`}
                      accessibilityState={{ selected: chosen === point.date }}
                      onPress={() => setSelected(point.date)}
                      style={{
                        position: 'absolute',
                        left: x(point.date) - 22,
                        top: y(point.value) - 22,
                        width: 44,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        pointerEvents="none"
                        style={
                          bars
                            ? {
                                position: 'absolute',
                                top: 22,
                                left:
                                  22 +
                                  (seriesIndex - (series.length - 1) / 2) * barWidth -
                                  barWidth / 2,
                                width: Math.max(2, barWidth - 2),
                                height: Math.max(2, height + 12 - y(point.value)),
                                backgroundColor: s.color,
                                borderTopLeftRadius: 3,
                                borderTopRightRadius: 3,
                                opacity: 0.85,
                              }
                            : {
                                width: chosen === point.date ? 9 : 6,
                                height: chosen === point.date ? 9 : 6,
                                borderRadius: seriesIndex === 0 ? 5 : 1,
                                backgroundColor: s.color,
                                borderWidth: 1,
                                borderColor: c.surface,
                              }
                        }
                      />
                    </Pressable>
                  ))}
                </View>
              ))}
              <View
                style={{
                  position: 'absolute',
                  top: height + 22,
                  left: 0,
                  right: 0,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Label small muted>
                  {shortDate(dates[0])}
                </Label>
                {dates.length > 1 && (
                  <Label small muted>
                    {shortDate(dates.at(-1)!)}
                  </Label>
                )}
              </View>
            </View>
          </View>
          {!!chosen && (
            <View style={{ gap: 8 }}>
              <Label small>
                {chosen} ·{' '}
                {series
                  .flatMap((s) => {
                    const point = s.points.find((p) => p.date === chosen);
                    return point ? [`${s.name}: ${format(point.value)}`] : [];
                  })
                  .join(' · ')}
              </Label>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  title="Previous"
                  accessibilityLabel={`Previous point in ${title}`}
                  variant="secondary"
                  disabled={dates.indexOf(chosen) === 0}
                  onPress={() => setSelected(dates[dates.indexOf(chosen) - 1])}
                />
                <Button
                  title="Next"
                  accessibilityLabel={`Next point in ${title}`}
                  variant="secondary"
                  disabled={dates.indexOf(chosen) === dates.length - 1}
                  onPress={() => setSelected(dates[dates.indexOf(chosen) + 1])}
                />
                <Button
                  title={table ? 'Hide values' : 'Show values'}
                  variant="secondary"
                  onPress={() => setTable(!table)}
                />
              </View>
            </View>
          )}
          {table &&
            dates.map((date) => (
              <Label key={date} small>
                {date} ·{' '}
                {series
                  .flatMap((s) => {
                    const p = s.points.find((x) => x.date === date);
                    return p ? [`${s.name}: ${format(p.value)}`] : [];
                  })
                  .join(' · ')}
              </Label>
            ))}
        </>
      )}
    </Card>
  );
}
