import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  climbingLabel,
  errorMessage,
  climbingTypes,
  gradeSystems,
  climbingEnvironments,
  climbingOutcomes,
  wallAngles,
  climbingStyles,
  climbingGrades,
  filterValues,
  toggleFilter,
  type ClimbLog,
  type ClimbHistoryFilters,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { ListHeader } from '../../ui/components/ListHeader';
import { Label } from '../../ui/components/Label';
import { Loading } from '../../ui/components/Loading';
import { Page } from '../../ui/components/Page';
import { ClimbEditor } from './ClimbEditor';
import { ClimbPhoto } from './ClimbPhoto';
import { ClimbSummary } from './ClimbSummary';
import { Field } from '../../ui/components/Field';
import { SearchField } from '../../ui/components/SearchField';
import { TotalCard } from '../../ui/components/TotalCard';

export function ClimbHistory() {
  const { api } = useSession();
  const cache = useQueryClient();
  const router = useRouter();
  const { climb } = useLocalSearchParams<{ climb?: string }>();
  const selectedId =
    climb && /^\d+$/.test(climb) && Number.isSafeInteger(Number(climb)) && Number(climb) > 0
      ? Number(climb)
      : undefined;
  const [expanded, setExpanded] = useState(selectedId);
  const [editing, setEditing] = useState<number>();
  const [removing, setRemoving] = useState<ClimbLog>();
  const [filters, setFilters] = useState<ClimbHistoryFilters>({});
  const [draft, setDraft] = useState<ClimbHistoryFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [filterError, setFilterError] = useState<string>();
  const [search, setSearch] = useState('');
  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeSearch, setGradeSearch] = useState('');
  const [totalCount, setTotalCount] = useState<number>();
  const scroll = useRef<ScrollView>(null);
  const pendingScroll = useRef(selectedId);
  const positions = useRef(new Map<number, number>());
  const scrollFrame = useRef<number | undefined>(undefined);
  const scrollToSelected = () => {
    if (
      !pendingScroll.current ||
      expanded !== pendingScroll.current ||
      !records.some((log) => log.id === pendingScroll.current)
    )
      return;
    if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = requestAnimationFrame(() => {
      const id = pendingScroll.current;
      const y = id === undefined ? undefined : positions.current.get(id);
      if (y !== undefined && scroll.current) {
        scroll.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
        pendingScroll.current = undefined;
      }
    });
  };
  useEffect(
    () => () => {
      if (scrollFrame.current !== undefined) cancelAnimationFrame(scrollFrame.current);
    },
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = search.trim() || undefined;
      setFilters((current) => (current.search === value ? current : { ...current, search: value }));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    pendingScroll.current = selectedId;
    positions.current.clear();
    setExpanded(selectedId);
    setEditing(undefined);
    if (selectedId) {
      setFilters({});
      setSearch('');
      setShowFilters(false);
    }
  }, [selectedId]);
  const history = useInfiniteQuery({
    queryKey: ['climb-logs', 'history', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      Object.keys(filters).length
        ? api.listClimbHistory(pageParam, filters)
        : api.listClimbHistory(pageParam),
    getNextPageParam: (page) => page.nextPage ?? undefined,
  });
  const selected = useQuery({
    queryKey: ['climb-logs', 'detail', selectedId],
    enabled: !!selectedId,
    queryFn: () => api.getClimbLog(selectedId!),
  });
  useEffect(() => {
    const count = history.data?.pages[0]?.totalCount;
    if (count !== undefined) setTotalCount(count);
  }, [history.data]);
  const records = history.data?.pages.flatMap((page) => page.items) ?? [];
  const logs = [...new Map(records.map((log) => [log.id, log])).values()];
  // Only use the standalone detail as a fallback if the list failed entirely.
  if (history.isError && !records.length && selected.data) logs.push(selected.data);
  useEffect(() => {
    if (
      pendingScroll.current === selectedId &&
      expanded === selectedId &&
      selected.data &&
      !records.some((log) => log.id === selectedId) &&
      history.hasNextPage &&
      !history.isFetching &&
      !history.isError
    ) {
      void history.fetchNextPage();
    }
  }, [
    selectedId,
    expanded,
    selected.data,
    history.data,
    history.hasNextPage,
    history.isFetching,
    history.isError,
    history.fetchNextPage,
  ]);
  const remove = useMutation({
    mutationFn: (id: number) => api.deleteClimbLog(id),
    onSuccess: async (_, id) => {
      setRemoving(undefined);
      setEditing(undefined);
      setExpanded(undefined);
      if (selectedId === id) router.replace('/climbs');
      cache.removeQueries({ queryKey: ['climb-logs', 'detail', id] });
      await cache.invalidateQueries({ queryKey: ['progress'] });
      await cache.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'climb-logs' &&
          !(query.queryKey[1] === 'detail' && query.queryKey[2] === id),
      });
    },
  });
  return (
    <Page scrollRef={scroll} onContentSizeChange={scrollToSelected}>
      <ListHeader
        title="Climbs"
        action="Log climb"
        showPlus={false}
        onPress={() => router.push({ pathname: '/climbs/new', params: { returnTo: 'climbs' } })}
      />
      <TotalCard label="TOTAL CLIMBS" count={totalCount} />
      <SearchField
        scrollRef={scroll}
        label="Search climbs"
        placeholder="Name, location, grade or climbing type"
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setExpanded(undefined);
          setEditing(undefined);
        }}
        maxLength={200}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(
          [
            ['date-desc', 'Newest'],
            ['date-asc', 'Oldest'],
            ['grade-desc', 'Hardest'],
            ['grade-asc', 'Easiest'],
          ] as const
        ).map(([sort, title]) => (
          <Button
            key={sort}
            title={title}
            variant={(filters.sort ?? 'date-desc') === sort ? 'primary' : 'secondary'}
            onPress={() => {
              setFilters({ ...filters, sort });
              setExpanded(undefined);
              setEditing(undefined);
            }}
          />
        ))}
        <Button
          title="Filters"
          variant={showFilters ? 'primary' : 'secondary'}
          selected={showFilters}
          onPress={() => setShowFilters(!showFilters)}
        />
      </View>
      {filters.sort?.startsWith('grade') && (
        <Label small muted>
          Grades are sorted within each grade system.
        </Label>
      )}
      {Object.entries(filters).some(
        ([key, value]) => key !== 'sort' && key !== 'search' && filterValues(value).length > 0,
      ) && (
        <View style={{ gap: 6 }}>
          <Label small muted>
            {Object.entries(filters)
              .filter(
                ([key, value]) =>
                  key !== 'sort' && key !== 'search' && filterValues(value).length > 0,
              )
              .map(([, value]) => filterValues(value).map(climbingLabel).join(', '))
              .join(' · ')}
          </Label>
          <Button
            title="Clear"
            accessibilityLabel="Reset filters"
            variant="secondary"
            onPress={() => {
              setFilters({ sort: filters.sort, search: filters.search });
              setDraft({});
              setFilterError(undefined);
            }}
          />
        </View>
      )}
      {showFilters && (
        <Card>
          {(
            [
              ['climbingType', 'Climbing type', climbingTypes],
              ['gradeSystem', 'Grade system', gradeSystems],
              ['environment', 'Environment', climbingEnvironments],
              ['outcome', 'Outcome', climbingOutcomes],
              ['wallAngle', 'Wall angle', wallAngles],
              ['style', 'Style', climbingStyles],
            ] as const
          ).map(([key, label, options]) => (
            <View key={key} style={{ gap: 6 }}>
              <Label small>{label}</Label>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[undefined, ...options].map((value) => (
                  <Button
                    key={value ?? 'all'}
                    title={value ? climbingLabel(value) : 'All'}
                    accessibilityLabel={`Filter ${label}: ${value ? climbingLabel(value) : 'All'}`}
                    selected={
                      value
                        ? filterValues(draft[key]).includes(value)
                        : filterValues(draft[key]).length === 0
                    }
                    variant={
                      (
                        value
                          ? filterValues(draft[key]).includes(value)
                          : filterValues(draft[key]).length === 0
                      )
                        ? 'primary'
                        : 'secondary'
                    }
                    onPress={() => {
                      setDraft({
                        ...draft,
                        [key]: value ? toggleFilter(filterValues(draft[key]), value) : undefined,
                        ...(key === 'gradeSystem' ? { grade: undefined } : {}),
                      });
                      if (key === 'gradeSystem') {
                        setGradeOpen(false);
                        setGradeSearch('');
                      }
                    }}
                  />
                ))}
              </View>
            </View>
          ))}
          <View style={{ gap: 6 }}>
            <Label small>Grade</Label>
            {filterValues(draft.gradeSystem).length === 0 && (
              <Label small muted>
                Choose a grade system to filter by grade.
              </Label>
            )}
            <Button
              title={filterValues(draft.grade).join(', ') || 'All grades'}
              accessibilityLabel="Select grade filter"
              variant="secondary"
              disabled={filterValues(draft.gradeSystem).length === 0}
              onPress={() => {
                setGradeOpen(!gradeOpen);
                setGradeSearch('');
              }}
            />
            {gradeOpen && filterValues(draft.gradeSystem).length > 0 && (
              <View style={{ gap: 6 }}>
                <Field
                  label="Search filter grades"
                  value={gradeSearch}
                  onChangeText={setGradeSearch}
                />
                <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                  <View style={{ gap: 6 }}>
                    <Button
                      title="All grades"
                      accessibilityLabel="Filter grade: All"
                      variant="secondary"
                      onPress={() => {
                        setDraft({ ...draft, grade: undefined });
                        setGradeOpen(false);
                      }}
                    />
                    {Array.from(
                      new Set(
                        filterValues(draft.gradeSystem).flatMap(
                          (system) => climbingGrades[system as keyof typeof climbingGrades],
                        ),
                      ),
                    )
                      .filter((grade) =>
                        grade.toLowerCase().includes(gradeSearch.trim().toLowerCase()),
                      )
                      .map((grade) => (
                        <Button
                          key={grade}
                          title={grade}
                          accessibilityLabel={`Filter grade: ${grade}`}
                          selected={filterValues(draft.grade).includes(grade)}
                          variant={
                            filterValues(draft.grade).includes(grade) ? 'primary' : 'secondary'
                          }
                          onPress={() => {
                            setDraft({
                              ...draft,
                              grade: toggleFilter(filterValues(draft.grade), grade),
                            });
                          }}
                        />
                      ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
          <Field
            label="From date"
            placeholder="YYYY-MM-DD"
            value={draft.from ?? ''}
            onChangeText={(from) => setDraft({ ...draft, from })}
          />
          <Field
            label="To date"
            placeholder="YYYY-MM-DD"
            value={draft.to ?? ''}
            onChangeText={(to) => setDraft({ ...draft, to })}
          />
          {filterError && <ErrorNotice message={filterError} />}
          <View
            testID="climb-filter-actions"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            <Button
              title="Apply"
              accessibilityLabel="Apply filters"
              onPress={() => {
                const validDate = (value?: string) =>
                  !value ||
                  (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
                    value >= '0001-01-01' &&
                    !Number.isNaN(Date.parse(value)) &&
                    new Date(value).toISOString().slice(0, 10) === value);
                if (
                  !validDate(draft.from) ||
                  !validDate(draft.to) ||
                  (draft.from && draft.to && draft.from > draft.to)
                ) {
                  setFilterError('Choose valid dates with the end on or after the start.');
                  return;
                }
                setFilterError(undefined);
                setFilters({ ...draft, sort: filters.sort, search: filters.search });
                setExpanded(undefined);
                setEditing(undefined);
                setShowFilters(false);
              }}
            />
            <Button
              title="Clear"
              accessibilityLabel="Clear filters"
              variant="secondary"
              onPress={() => {
                setDraft({});
                setFilters({ sort: filters.sort, search: filters.search });
                setFilterError(undefined);
                setExpanded(undefined);
                setEditing(undefined);
              }}
            />
            <View style={{ marginLeft: 'auto' }}>
              <Button title="Close" variant="secondary" onPress={() => setShowFilters(false)} />
            </View>
          </View>
        </Card>
      )}
      {climb && !selectedId && <ErrorNotice message="Choose a valid climb." />}
      {selectedId && selected.isPending && <Loading text="Loading selected climb…" />}
      {selected.isError && (
        <>
          <ErrorNotice message={errorMessage(selected.error)} />
          <Button
            title="Retry selected climb"
            onPress={() => {
              void selected.refetch();
            }}
          />
        </>
      )}
      {history.isPending && <Loading text="Loading climbs…" />}
      {history.isError && !history.data && (
        <>
          <ErrorNotice message={errorMessage(history.error)} />
          <Button
            title="Retry climbs"
            onPress={() => {
              void history.refetch();
            }}
          />
        </>
      )}
      {
        <>
          {!history.isPending && !history.isError && !logs.length && (
            <Label muted>
              {Object.entries(filters).some(
                ([key, value]) => key !== 'sort' && filterValues(value).length > 0,
              )
                ? 'No climbs match these filters.'
                : 'No climbs logged.'}
            </Label>
          )}
          {logs.map((log) => (
            <Card
              key={log.id}
              onLayout={(event) => {
                positions.current.set(log.id, event.nativeEvent.layout.y);
                if (log.id === pendingScroll.current) scrollToSelected();
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${expanded === log.id ? 'Collapse' : 'Expand'} climb ${log.name || log.grade}`}
                accessibilityState={{
                  expanded: expanded === log.id,
                  disabled: editing !== undefined,
                }}
                aria-expanded={expanded === log.id}
                disabled={editing !== undefined}
                onPress={() => {
                  if (expanded !== log.id) pendingScroll.current = log.id;
                  setExpanded(expanded === log.id ? undefined : log.id);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  <Label small muted>
                    {new Date(`${log.date}T12:00:00`).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Label>
                  <ClimbSummary log={log} />
                </View>
                <Label muted>{expanded === log.id ? '−' : '+'}</Label>
              </Pressable>
              {expanded === log.id && (
                <View style={{ gap: 10 }}>
                  {editing !== log.id && <ClimbPhoto id={log.id} />}
                  <Label small muted>
                    {climbingLabel(log.climbingType)} · {climbingLabel(log.gradeSystem)} ·{' '}
                    {log.environment}
                  </Label>
                  {log.wallAngle && (
                    <Label small muted>
                      Wall angle: {log.wallAngle}
                    </Label>
                  )}
                  {log.styles.length > 0 && (
                    <Label small muted>
                      {log.styles.join(' · ')}
                    </Label>
                  )}
                  {log.location && (
                    <Label small syntax="string">
                      {log.location}
                    </Label>
                  )}
                  {editing === log.id ? (
                    <ClimbEditor date={log.date} log={log} onClose={() => setEditing(undefined)} />
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Button
                        title="Edit"
                        accessibilityLabel={`Edit climb ${log.name || log.grade}`}
                        variant="secondary"
                        onPress={() => setEditing(log.id)}
                      />
                      <Button
                        title="Delete"
                        accessibilityLabel={`Delete climb ${log.name || log.grade}`}
                        variant="secondary"
                        onPress={() => {
                          remove.reset();
                          setRemoving(log);
                        }}
                      />
                    </View>
                  )}
                </View>
              )}
            </Card>
          ))}
          {history.hasNextPage && (
            <Button
              title="Load more climbs"
              variant="secondary"
              busy={history.isFetchingNextPage}
              onPress={() => {
                void history.fetchNextPage();
              }}
            />
          )}
          {history.isError && !!history.data && (
            <ErrorNotice message={errorMessage(history.error)} />
          )}
        </>
      }
      <ConfirmDialog
        visible={!!removing}
        title="Delete climb?"
        description="This permanently deletes this climbing log."
        confirmLabel="Delete climb"
        cancelLabel="Keep climb"
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
