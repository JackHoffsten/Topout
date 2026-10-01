import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
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

const scheduleKey = ['workout-schedule'];
export function HomeScreen() {
  const c = useTheme();
  const wide = useDesktop();
  const { api } = useSession();
  const cache = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<ScheduledWorkout>();
  const days = monthDays(month);
  const from = dateKey(days[0]!);
  const to = dateKey(days.at(-1)!);
  const schedule = useQuery({
    queryKey: [...scheduleKey, from, to],
    queryFn: () => api.listWorkoutSchedule(from, to),
  });
  const templates = useTemplates();
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
  const selectDate = (date: Date) => {
    setSelected(dateKey(date));
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setPicker(false);
    create.reset();
  };
  const selectedDate = new Date(`${selected}T12:00:00`);
  const plans = schedule.data?.filter((plan) => plan.date === selected) ?? [];
  return (
    <Page>
      <Heading large>Home</Heading>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 20, alignItems: 'stretch' }}>
        <Card style={{ flex: wide ? 3 : undefined, padding: wide ? 20 : 12 }}>
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
              onPress={() => selectDate(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            />
            <Label syntax="name">
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Label>
            <Button
              title="›"
              accessibilityLabel="Next month"
              variant="secondary"
              disabled={create.isPending}
              onPress={() => selectDate(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
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
                  fontSize: 12,
                }}
              >
                {day}
              </Text>
            ))}
          </View>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <View key={week} style={{ flexDirection: 'row' }}>
              {days.slice(week * 7, week * 7 + 7).map((date) => {
                const key = dateKey(date);
                const entries = schedule.data?.filter((plan) => plan.date === key) ?? [];
                const today = key === dateKey(new Date());
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${today ? ', today' : ''}, ${entries.length} planned entries`}
                    accessibilityState={{ selected: key === selected, disabled: create.isPending }}
                    disabled={create.isPending}
                    onPress={() => selectDate(date)}
                    style={{
                      width: `${100 / 7}%`,
                      minHeight: wide ? 96 : 54,
                      padding: 5,
                      borderWidth: 1,
                      borderColor: key === selected ? c.focus : c.line,
                      backgroundColor: key === selected ? c.soft : c.surface,
                      gap: 5,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: tokens.font,
                        fontSize: 14,
                        fontWeight: today ? '700' : '400',
                        color: date.getMonth() === month.getMonth() ? c.syntax.number : c.muted,
                      }}
                    >
                      {date.getDate()}
                    </Text>
                    {wide
                      ? entries.slice(0, 2).map((plan) => (
                          <Text
                            key={plan.id}
                            numberOfLines={1}
                            style={{
                              fontFamily: tokens.font,
                              fontSize: 11,
                              color: plan.isRestDay ? c.syntax.keyword : c.syntax.name,
                            }}
                          >
                            {plan.isRestDay ? 'Rest' : plan.templateName}
                          </Text>
                        ))
                      : entries.length > 0 && (
                          <Text
                            style={{ fontFamily: tokens.font, fontSize: 11, color: c.syntax.name }}
                          >
                            {entries.length} •
                          </Text>
                        )}
                    {wide && entries.length > 2 && (
                      <Text style={{ fontFamily: tokens.font, fontSize: 11, color: c.muted }}>
                        +{entries.length - 2}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Card>
        <Card style={{ flex: wide ? 2 : undefined }}>
          <Heading>
            {selectedDate.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Heading>
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
                  <Label syntax={plan.isRestDay ? 'keyword' : 'name'}>
                    {plan.isRestDay ? 'Rest day' : plan.templateName}
                  </Label>
                  <Label muted small>
                    {plan.status}
                  </Label>
                  {!plan.isRestDay && plan.templateId && (
                    <Link
                      href={{ pathname: '/templates/[id]/edit', params: { id: plan.templateId } }}
                      style={{ color: c.syntax.property, fontFamily: tokens.font }}
                    >
                      View template
                    </Link>
                  )}
                  {plan.status !== 'Completed' && (
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
              ))}
              <ErrorNotice message={create.isError ? errorMessage(create.error) : undefined} />
              {!picker ? (
                <>
                  <Button
                    title="Plan workout"
                    disabled={create.isPending}
                    onPress={() => {
                      create.reset();
                      setPicker(true);
                    }}
                  />
                  <Button
                    title="Add rest day"
                    variant="secondary"
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
        </Card>
      </View>
      <ConfirmDialog
        visible={!!removing}
        title="Remove plan?"
        description="This removes the calendar entry. Your template is kept."
        confirmLabel="Remove plan"
        cancelLabel="Keep plan"
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
