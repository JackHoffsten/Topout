import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { type ScheduledWorkout } from '@topout/shared';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { tokens, useDesktop, useTheme } from '../../ui/theme';
import { displayDate } from '../../lib/dates';
import { dateKey, monthDays } from './calendar';
import { CalendarBadge, CalendarIcon } from './CalendarBadge';
export function MonthCalendar({
  month,
  selected,
  scheduledWorkouts,
  climbDates,
  markedDates,
  disabled,
  sideBySide,
  onSelectDate,
}: {
  month: Date;
  selected: string;
  scheduledWorkouts: ScheduledWorkout[];
  climbDates: string[];
  markedDates: string[];
  disabled: boolean;
  sideBySide: boolean;
  onSelectDate: (date: Date, revealDetails?: boolean) => void;
}) {
  const wide = useDesktop();
  const c = useTheme();
  const days = monthDays(month);
  const [gridWidth, setGridWidth] = useState(0);
  const cellWidth = gridWidth ? gridWidth / 7 : wide ? 80 : 54;
  const badgeInset = cellWidth >= 64 ? 5 : 1;
  const badgeGap = cellWidth >= 64 ? 4 : 2;
  const badgeSize = Math.max(
    12,
    Math.min(
      28,
      Math.max(cellWidth <= 56 ? 14 : 16, Math.round(cellWidth * (cellWidth <= 56 ? 0.28 : 0.3))),
      Math.floor((cellWidth - badgeInset * 2 - badgeGap - 2) / 2),
    ),
  );
  const dayFontSize = Math.max(10, Math.round(badgeSize * 0.68));
  const calendarFontSize = Math.max(11, Math.round(badgeSize * 0.55));
  return (
    <Card style={{ flex: sideBySide ? 3 : undefined, minWidth: 0, padding: wide ? 20 : 12 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Button
          title="‹"
          accessibilityLabel="Previous month"
          variant="secondary"
          disabled={disabled}
          onPress={() =>
            onSelectDate(new Date(month.getFullYear(), month.getMonth() - 1, 1), false)
          }
        />
        <Text
          style={{
            fontFamily: tokens.font,
            fontSize: Math.max(16, dayFontSize + 2),
            color: c.syntax.name,
          }}
        >
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Button
          title="›"
          accessibilityLabel="Next month"
          variant="secondary"
          disabled={disabled}
          onPress={() =>
            onSelectDate(new Date(month.getFullYear(), month.getMonth() + 1, 1), false)
          }
        />
      </View>
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          title="Today"
          variant="secondary"
          disabled={disabled}
          onPress={() => onSelectDate(new Date())}
        />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <Text
            key={day}
            style={{
              width: `${100 / 7}%`,
              textAlign: 'center',
              color: c.syntax.property,
              fontFamily: tokens.font,
              fontSize: calendarFontSize,
            }}
          >
            {day}
          </Text>
        ))}
      </View>
      {Array.from({ length: days.length / 7 }, (_, week) => (
        <View
          key={week}
          testID={week === 0 ? 'calendar-grid' : undefined}
          onLayout={
            week === 0 ? (event) => setGridWidth(event.nativeEvent.layout.width) : undefined
          }
          style={{ flexDirection: 'row' }}
        >
          {days.slice(week * 7, week * 7 + 7).map((date) => {
            const key = dateKey(date);
            const entries = scheduledWorkouts.filter((plan) => plan.date === key);
            const climbCount = climbDates.filter((date) => date === key).length;
            const markedClimbingDay = markedDates.includes(key);
            const logged = entries.some(
              (plan) => plan.status === 'InProgress' || plan.status === 'Completed',
            );
            const workouts = entries.filter((plan) => !plan.isRestDay);
            const workoutStatus = workouts.some((plan) => plan.status === 'InProgress')
              ? 'InProgress'
              : workouts.length > 0 && workouts.every((plan) => plan.status === 'Completed')
                ? 'Completed'
                : 'Planned';
            const statusLabel = workoutStatus === 'InProgress' ? 'In progress' : workoutStatus;
            const statusColors = c.workoutStatus[workoutStatus];
            const today = key === dateKey(new Date());
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${displayDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${entries.length} planned entries${logged ? ', workout logged' : ''}${climbCount ? `, ${climbCount} ${climbCount === 1 ? 'climb' : 'climbs'} logged` : markedClimbingDay ? ', climbing day' : ''}`}
                accessibilityState={{ selected: key === selected, disabled: disabled }}
                accessibilityHint={workouts.length ? `Workout: ${statusLabel}` : undefined}
                disabled={disabled}
                onPress={() => onSelectDate(date)}
                style={{
                  width: `${100 / 7}%`,
                  aspectRatio: 1,
                  borderWidth: 1,
                  borderColor: key === selected ? c.focus : c.line,
                  backgroundColor: key === selected ? c.soft : c.surface,
                  gap: 5,
                }}
              >
                <View
                  testID={`date-header-${key}`}
                  style={{
                    position: 'absolute',
                    left: badgeInset,
                    right: badgeInset,
                    top: badgeInset + 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <Text
                    testID={`date-number-${key}`}
                    style={{
                      fontFamily: tokens.font,
                      fontSize: dayFontSize,
                      lineHeight: Math.round(dayFontSize * 1.15),
                      fontWeight: today ? '700' : '400',
                      color: date.getMonth() === month.getMonth() ? c.syntax.number : c.muted,
                    }}
                  >
                    {date.getDate()}
                  </Text>
                </View>
                {(entries.length > 0 || climbCount > 0 || markedClimbingDay) && (
                  <View
                    testID={`activity-badges-${key}`}
                    style={{
                      position: 'absolute',
                      left: badgeInset,
                      bottom: badgeInset + 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: badgeGap,
                    }}
                  >
                    {entries.length > 0 && (
                      <CalendarBadge
                        size={badgeSize}
                        testID={`plans-${key}`}
                        icon={entries[0]!.isRestDay ? 'moon' : 'dumbbell'}
                        color={entries[0]!.isRestDay ? c.syntax.keyword : statusColors.color}
                        backgroundColor={
                          entries[0]!.isRestDay ? undefined : statusColors.background
                        }
                        label={entries[0]!.isRestDay ? 'Rest day' : `Workout: ${statusLabel}`}
                        count={entries[0]!.isRestDay ? undefined : workouts.length}
                      />
                    )}
                    {(climbCount > 0 || markedClimbingDay) && (
                      <CalendarBadge
                        size={badgeSize}
                        testID={`climbs-${key}`}
                        icon="terrain"
                        color={c.syntax.string}
                        label={climbCount > 0 ? 'Climbs logged' : 'Climbing day'}
                        count={climbCount}
                      />
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 4 }}>
        {(
          [
            ['dumbbell', 'Planned', c.workoutStatus.Planned.color],
            ['dumbbell', 'In progress', c.workoutStatus.InProgress.color],
            ['dumbbell', 'Completed', c.workoutStatus.Completed.color],
            ['moon', 'Rest', c.syntax.keyword],
            ['terrain', 'Climbs', c.syntax.string],
          ] as const
        ).map(([icon, label, color]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <CalendarIcon icon={icon} size={calendarFontSize} color={color} />
            <Text style={{ fontFamily: tokens.font, fontSize: calendarFontSize, color: c.muted }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
