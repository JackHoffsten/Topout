import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, type ScheduledWorkout } from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Field } from '../../ui/components/Field';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Loading } from '../../ui/components/Loading';
import { Page } from '../../ui/components/Page';
import { tokens, useDesktop, useTheme } from '../../ui/theme';
import { useTemplates } from '../templates/queries';
import { dateKey, monthDays } from './calendar';
import { ClimbingDay } from '../climbing/ClimbingDay';
import { useAutoScroll } from '../../ui/useAutoScroll';

const scheduleKey = ['workout-schedule'];
export function CalendarScreen() {
  const router = useRouter();
  const autoScroll = useAutoScroll();
  const contentY = useRef(0);
  const dayY = useRef(0);
  const c = useTheme();
  const wide = useDesktop();
  const [contentWidth, setContentWidth] = useState(0);
  const [gridWidth, setGridWidth] = useState(0);
  const sideBySide = contentWidth >= 950;
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
  const { api } = useSession();
  const cache = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const { date } = useLocalSearchParams<{ date?: string }>();
  useEffect(() => {
    if (date && z.iso.date().safeParse(date).success && date >= '0001-01-01') {
      setSelected(date);
      setMonth(new Date(`${date}T12:00:00`));
    }
  }, [date]);
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<ScheduledWorkout>();
  const [removingLog, setRemovingLog] = useState<ScheduledWorkout>();
  const days = monthDays(month);
  const from = dateKey(days[0]!);
  const to = dateKey(days.at(-1)!);
  const schedule = useQuery({
    queryKey: [...scheduleKey, from, to],
    queryFn: () => api.listWorkoutSchedule(from, to),
  });
  const templates = useTemplates();
  const climbs = useQuery({
    queryKey: ['climb-logs', from, to],
    queryFn: () => api.listClimbLogs(from, to),
  });
  const create = useMutation({
    mutationFn: (templateId: number | null) => api.scheduleWorkout({ date: selected, templateId }),
    onSuccess: async () => {
      setPicker(false);
      setSearch('');
      await cache.invalidateQueries({ queryKey: scheduleKey });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteScheduledWorkout(id),
    onSuccess: async () => {
      setRemoving(undefined);
      await cache.invalidateQueries({ queryKey: scheduleKey });
    },
  });
  const removeLog = useMutation({
    mutationFn: (id: number) => api.deleteWorkoutLog(id),
    onSuccess: async (_, id) => {
      setRemovingLog(undefined);
      cache.removeQueries({ queryKey: ['workout-logging', id] });
      await cache.invalidateQueries({ queryKey: ['progress'] });
      await cache.invalidateQueries({ queryKey: scheduleKey });
    },
  });
  const selectDate = (date: Date, revealDetails = true) => {
    autoScroll.reveal('day', revealDetails && !sideBySide);
    setSelected(dateKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setPicker(false);
    create.reset();
  };
  const selectedDate = new Date(`${selected}T12:00:00`);
  const plans = schedule.data?.filter((plan) => plan.date === selected) ?? [];
  return (
    <Page scrollRef={autoScroll.scrollRef} onContentSizeChange={autoScroll.onContentSizeChange}>
      <Heading large>Calendar</Heading>
      <View
        testID="calendar-content"
        onLayout={(event) => {
          contentY.current = event.nativeEvent.layout.y;
          autoScroll.register('day', contentY.current + dayY.current);
          setContentWidth(event.nativeEvent.layout.width);
        }}
        style={{ flexDirection: sideBySide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}
      >
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
              disabled={create.isPending}
              onPress={() =>
                selectDate(new Date(month.getFullYear(), month.getMonth() - 1, 1), false)
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
              disabled={create.isPending}
              onPress={() =>
                selectDate(new Date(month.getFullYear(), month.getMonth() + 1, 1), false)
              }
            />
          </View>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              title="Today"
              variant="secondary"
              disabled={create.isPending}
              onPress={() => selectDate(new Date())}
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
                const entries = schedule.data?.filter((plan) => plan.date === key) ?? [];
                const climbCount = climbs.data?.filter((log) => log.date === key).length ?? 0;
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
                    accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${today ? ', today' : ''}, ${entries.length} planned entries${logged ? ', workout logged' : ''}${climbCount ? `, ${climbCount} ${climbCount === 1 ? 'climb' : 'climbs'} logged` : ''}`}
                    accessibilityState={{ selected: key === selected, disabled: create.isPending }}
                    accessibilityHint={workouts.length ? `Workout: ${statusLabel}` : undefined}
                    disabled={create.isPending}
                    onPress={() => selectDate(date)}
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
                    {(entries.length > 0 || climbCount > 0) && (
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
                        {climbCount > 0 && (
                          <CalendarBadge
                            size={badgeSize}
                            testID={`climbs-${key}`}
                            icon="terrain"
                            color={c.syntax.string}
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
                <Text
                  style={{ fontFamily: tokens.font, fontSize: calendarFontSize, color: c.muted }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </Card>
        <Card
          style={{ flex: sideBySide ? 2 : undefined, minWidth: 0 }}
          onLayout={(event) => {
            dayY.current = event.nativeEvent.layout.y;
            autoScroll.register('day', contentY.current + dayY.current);
          }}
        >
          <Heading>
            {selectedDate.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Heading>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Heading>Workout</Heading>
            <Link
              href="/templates"
              style={{ color: c.syntax.property, fontFamily: tokens.font, fontSize: 13 }}
            >
              All templates
            </Link>
          </View>
          {schedule.isPending ? (
            <Loading text="Loading plans…" />
          ) : schedule.isError ? (
            <>
              <ErrorNotice message={errorMessage(schedule.error)} />
              <Button
                title="Try again"
                onPress={() => {
                  void schedule.refetch();
                }}
              />
            </>
          ) : (
            <>
              {plans.length === 0 && <Label muted>No workouts planned.</Label>}
              {plans.map((plan) => (
                <View
                  key={plan.id}
                  style={{ gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Label syntax={plan.isRestDay ? 'keyword' : 'name'}>
                        {plan.isRestDay ? 'Rest day' : plan.templateName}
                      </Label>
                    </View>
                    {!plan.isRestDay && plan.templateId && (
                      <Link
                        href={{ pathname: '/templates/[id]/edit', params: { id: plan.templateId } }}
                        style={{
                          color: c.syntax.property,
                          fontFamily: tokens.font,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        View template
                      </Link>
                    )}
                  </View>
                  <Label muted small>
                    {plan.status === 'InProgress' ? 'In progress' : plan.status}
                  </Label>
                  <View style={{ gap: 14 }}>
                    {!plan.isRestDay &&
                      (plan.status === 'Planned' ||
                        plan.status === 'InProgress' ||
                        plan.status === 'Completed') && (
                        <Button
                          onPress={() =>
                            router.push({ pathname: '/workouts/[id]', params: { id: plan.id } })
                          }
                          title={
                            plan.status === 'Completed'
                              ? 'View workout log'
                              : plan.status === 'InProgress'
                                ? 'Resume workout'
                                : 'Log workout'
                          }
                        />
                      )}
                    {plan.status === 'InProgress' || plan.status === 'Completed' ? (
                      <Button
                        title="Remove log"
                        accessibilityLabel={`Remove log for ${plan.templateName}`}
                        variant="secondary"
                        onPress={() => {
                          removeLog.reset();
                          setRemovingLog(plan);
                        }}
                      />
                    ) : (
                      <Button
                        title="Remove"
                        accessibilityLabel={`Remove ${plan.isRestDay ? 'rest day' : plan.templateName}`}
                        variant="secondary"
                        onPress={() => {
                          remove.reset();
                          setRemoving(plan);
                        }}
                      />
                    )}
                  </View>
                </View>
              ))}
              <ErrorNotice message={create.isError ? errorMessage(create.error) : undefined} />
              {!picker ? (
                <>
                  <Button
                    title="Plan workout"
                    disabled={create.isPending || plans.some((plan) => plan.isRestDay)}
                    onPress={() => {
                      create.reset();
                      setPicker(true);
                    }}
                  />
                  <Button
                    title="Add rest day"
                    variant="secondary"
                    disabled={
                      plans.length > 0 ||
                      climbs.isPending ||
                      climbs.isError ||
                      !!climbs.data?.some((log) => log.date === selected)
                    }
                    busy={create.isPending}
                    onPress={() => create.mutate(null)}
                  />
                </>
              ) : (
                <>
                  <Field
                    label="Search templates"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Template name"
                  />
                  {templates.isPending ? (
                    <Loading text="Loading templates…" />
                  ) : templates.isError ? (
                    <>
                      <ErrorNotice message={errorMessage(templates.error)} />
                      <Button
                        title="Retry templates"
                        onPress={() => {
                          void templates.refetch();
                        }}
                      />
                    </>
                  ) : templates.data.length === 0 ? (
                    <>
                      <Label muted>Create a template before planning a workout.</Label>
                      <Link
                        href="/templates/new"
                        style={{ color: c.syntax.property, fontFamily: tokens.font }}
                      >
                        New template
                      </Link>
                    </>
                  ) : (
                    <>
                      {templates.data
                        .filter((template) =>
                          template.name.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map((template) => (
                          <Pressable
                            key={template.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Schedule ${template.name}`}
                            disabled={create.isPending}
                            onPress={() => create.mutate(template.id)}
                            style={{
                              padding: 14,
                              borderWidth: 1,
                              borderColor: c.line,
                              opacity: create.isPending ? 0.6 : 1,
                            }}
                          >
                            <Label syntax="name">{template.name}</Label>
                            <Label muted small>
                              <Label small syntax="number">
                                {template.exercises.length}
                              </Label>{' '}
                              exercises
                            </Label>
                          </Pressable>
                        ))}
                      {!templates.data.some((template) =>
                        template.name.toLowerCase().includes(search.toLowerCase()),
                      ) && <Label muted>No templates found.</Label>}
                    </>
                  )}
                  {create.isPending && <Label muted>Saving plan…</Label>}
                  <Button
                    title="Cancel"
                    variant="secondary"
                    disabled={create.isPending}
                    onPress={() => setPicker(false)}
                  />
                </>
              )}
            </>
          )}
          <ClimbingDay
            key={selected}
            date={selected}
            logs={climbs.data?.filter((log) => log.date === selected) ?? []}
            loading={climbs.isPending}
            error={climbs.isError ? climbs.error : undefined}
            onRetry={() => {
              void climbs.refetch();
            }}
            restDay={plans.some((plan) => plan.isRestDay)}
          />
        </Card>
      </View>
      {removingLog && (
        <ConfirmDialog
          visible
          title="Remove workout log?"
          description="This permanently removes all recorded sets and notes for this workout. The planned template stays on the calendar."
          confirmLabel="Remove workout log"
          cancelLabel="Keep log"
          busy={removeLog.isPending}
          error={removeLog.isError ? errorMessage(removeLog.error) : undefined}
          onCancel={() => setRemovingLog(undefined)}
          onConfirm={() => {
            if (removingLog) removeLog.mutate(removingLog.id);
          }}
        />
      )}
      <ConfirmDialog
        visible={!!removing}
        title={removing?.isRestDay ? 'Remove rest day?' : 'Remove plan?'}
        description={
          removing?.isRestDay
            ? 'This date will no longer be marked as a rest day.'
            : 'This removes the calendar entry. Your template is kept.'
        }
        confirmLabel={removing?.isRestDay ? 'Remove rest day' : 'Remove plan'}
        cancelLabel={removing?.isRestDay ? 'Keep rest day' : 'Keep plan'}
        busy={remove.isPending}
        error={remove.isError ? errorMessage(remove.error) : undefined}
        onCancel={() => setRemoving(undefined)}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id);
        }}
      />
    </Page>
  );
}

function CalendarBadge({
  size,
  testID,
  icon,
  color,
  backgroundColor,
  label,
  count,
}: {
  size: number;
  testID: string;
  icon: 'dumbbell' | 'moon' | 'terrain';
  color: string;
  backgroundColor?: string;
  label?: string;
  count?: number;
}) {
  const c = useTheme();
  const iconSize = Math.round(size * 0.68);
  const countSize = Math.max(11, Math.round(size * 0.55));
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size,
        maxWidth: size,
        minHeight: size,
        maxHeight: size,
        flexShrink: 0,
        borderRadius: tokens.radius.md,
        backgroundColor: backgroundColor ?? c.input,
        borderWidth: 1,
        borderColor: c.line,
      }}
    >
      <CalendarIcon
        icon={icon}
        size={iconSize}
        color={color}
        style={{
          width: iconSize,
          height: iconSize,
          lineHeight: iconSize,
          textAlign: 'center',
          flexShrink: 0,
        }}
      />
      {count !== undefined && count > 1 && (
        <View
          testID={`${testID}-count`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -3,
            right: -1,
            width: countSize,
            height: countSize,
            borderRadius: countSize / 2,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: c.onPrimary,
              fontFamily: tokens.font,
              fontSize: Math.max(6, Math.round(countSize * (count > 9 ? 0.48 : 0.65))),
              lineHeight: countSize - 2,
              fontWeight: '700',
            }}
          >
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}

function CalendarIcon({
  icon,
  ...props
}: {
  icon: 'dumbbell' | 'moon' | 'terrain';
  size: number;
  color: string;
  style?: import('react-native').TextStyle;
}) {
  if (icon === 'moon') return <Ionicons name="moon" {...props} />;
  return (
    <MaterialCommunityIcons
      name={icon}
      {...props}
      style={[props.style, icon === 'terrain' ? { transform: [{ scaleY: 1.2 }] } : undefined]}
    />
  );
}
