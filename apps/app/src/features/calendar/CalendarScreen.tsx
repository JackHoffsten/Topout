import { MonthCalendar } from './MonthCalendar';
import { refreshTraining } from '../training/queries';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorMessage, type ScheduledWorkout } from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { Heading } from '../../ui/components/Heading';
import { Label } from '../../ui/components/Label';
import { Loading } from '../../ui/components/Loading';
import { Page } from '../../ui/components/Page';
import { tokens, useTheme } from '../../ui/theme';
import { useTemplates } from '../templates/queries';
import { dateKey, monthDays } from './calendar';
import { displayDate } from '../../lib/dates';
import { ClimbingDay } from '../climbing/ClimbingDay';
import { useAutoScroll } from '../../ui/useAutoScroll';
import { SearchField } from '../../ui/components/SearchField';

const scheduleKey = ['workout-schedule'];

export function CalendarScreen() {
  const router = useRouter();
  const autoScroll = useAutoScroll();
  const contentY = useRef(0);
  const dayY = useRef(0);
  const c = useTheme();

  const [contentWidth, setContentWidth] = useState(0);

  const sideBySide = contentWidth >= 950;

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
  const climbingDays = useQuery({
    queryKey: ['climbing-days', from, to],
    queryFn: () => api.listClimbingDays(from, to),
  });
  const markClimbingDay = useMutation({
    mutationFn: (marked: boolean) => api.setClimbingDay(selected, marked),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['climbing-days'] });
    },
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
      await refreshTraining(cache, 'workout');
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
        <MonthCalendar
          month={month}
          selected={selected}
          scheduledWorkouts={schedule.data ?? []}
          climbDates={climbs.data?.map((log) => log.date) ?? []}
          markedDates={climbingDays.data ?? []}
          disabled={create.isPending}
          sideBySide={sideBySide}
          onSelectDate={selectDate}
        />
        <Card
          style={{ flex: sideBySide ? 2 : undefined, minWidth: 0 }}
          onLayout={(event) => {
            dayY.current = event.nativeEvent.layout.y;
            autoScroll.register('day', contentY.current + dayY.current);
          }}
        >
          <Heading>
            {displayDate(selectedDate, {
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
                      climbingDays.isPending ||
                      climbingDays.isError ||
                      !!climbingDays.data?.includes(selected) ||
                      !!climbs.data?.some((log) => log.date === selected)
                    }
                    busy={create.isPending}
                    onPress={() => create.mutate(null)}
                  />
                </>
              ) : (
                <>
                  <SearchField
                    scrollRef={autoScroll.scrollRef}
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
            marked={climbingDays.data?.includes(selected) ?? false}
            onMark={(marked) => markClimbingDay.mutate(marked)}
            markBusy={markClimbingDay.isPending}
            markUnavailable={climbingDays.isPending || climbingDays.isError}
            markError={
              markClimbingDay.isError
                ? markClimbingDay.error
                : climbingDays.isError
                  ? climbingDays.error
                  : undefined
            }
          />
          {climbingDays.isError && (
            <Button title="Retry climbing days" onPress={() => void climbingDays.refetch()} />
          )}
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
