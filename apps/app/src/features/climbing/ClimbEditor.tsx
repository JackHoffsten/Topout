import { useRef, useState, type RefObject } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  climbingTypes,
  climbingEnvironments,
  climbingOutcomes,
  climbingStyles,
  wallAngles,
  climbingGrades,
  gradeEndpoints,
  climbingLabel,
  systemsForType,
  climbLogInputSchema,
  errorMessage,
  type ClimbLog,
  type ClimbLogInput,
} from '@topout/shared';
import { useSession } from '../../lib/providers';
import { Button } from '../../ui/components/Button';
import { Card } from '../../ui/components/Card';
import { Field } from '../../ui/components/Field';
import { SearchField } from '../../ui/components/SearchField';
import { LocationField } from '../../ui/components/LocationField';
import { Label } from '../../ui/components/Label';
import { Heading } from '../../ui/components/Heading';
import { ErrorNotice } from '../../ui/components/ErrorNotice';
import { useTheme } from '../../ui/theme';
import { pickClimbPhoto, type ClimbPhotoDraft } from './pickClimbPhoto';
import { PhotoPreview } from './ClimbPhoto';

function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  disabledOptions = [],
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
  disabledOptions?: readonly T[];
}) {
  const c = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Label small>{label}</Label>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${climbingLabel(option)}`}
            accessibilityState={{
              checked: value === option,
              disabled: disabled || disabledOptions.includes(option),
            }}
            aria-checked={value === option}
            aria-disabled={disabled || disabledOptions.includes(option)}
            disabled={disabled || disabledOptions.includes(option)}
            onPress={() => onChange(option)}
            {...(Platform.OS === 'web'
              ? {
                  tabIndex: value === option ? (0 as const) : (-1 as const),
                  onKeyDown: (event: {
                    key: string;
                    preventDefault: () => void;
                    currentTarget: HTMLElement;
                  }) => {
                    if (disabled || disabledOptions.includes(option)) return;
                    // React Native Web only activates button-role Pressables with Space.
                    if (event.key === ' ') {
                      event.preventDefault();
                      onChange(option);
                    }
                    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
                      ? 1
                      : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                        ? -1
                        : 0;
                    if (direction) {
                      event.preventDefault();
                      let index = options.indexOf(option);
                      do {
                        index = (index + direction + options.length) % options.length;
                      } while (
                        disabledOptions.includes(options[index]!) &&
                        index !== options.indexOf(option)
                      );
                      onChange(options[index]!);
                      event.currentTarget.parentElement
                        ?.querySelectorAll<HTMLElement>('[role="radio"]')
                        [index]?.focus();
                    }
                  },
                }
              : {})}
            style={{
              minHeight: 42,
              justifyContent: 'center',
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: value === option ? c.focus : c.line,
              backgroundColor: value === option ? c.soft : c.input,
              opacity: disabled || disabledOptions.includes(option) ? 0.5 : 1,
            }}
          >
            <Label small syntax={value === option ? 'keyword' : undefined}>
              {climbingLabel(option)}
            </Label>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ClimbEditor({
  date,
  log,
  onClose,
  showHeading = true,
  scrollRef,
}: {
  date: string;
  log?: ClimbLog;
  onClose: (date?: string) => void;
  showHeading?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const { api } = useSession();
  const cache = useQueryClient();
  const c = useTheme();
  const fallbackScroll = useRef<ScrollView>(null);
  const [draft, setDraft] = useState<ClimbLogInput>(() =>
    log
      ? { ...log, isProject: !!log.projectId }
      : {
          date,
          climbingType: 'Bouldering',
          gradeSystem: 'Font',
          grade: '',
          environment: 'Indoor',
          attempts: 1,
          outcome: 'Redpoint',
          wallAngle: null,
          styles: [],
          name: null,
          location: null,
        },
  );
  const [attempts, setAttempts] = useState(draft.attempts == null ? '' : String(draft.attempts));
  const [gradeSearch, setGradeSearch] = useState('');
  const [projectPicker, setProjectPicker] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ClimbLog | undefined>(
    log?.projectId ? log : undefined,
  );
  const [projectSearch, setProjectSearch] = useState('');
  const projects = useQuery({
    queryKey: ['climb-projects'],
    queryFn: () => api.listClimbProjects(),
    enabled: !log && projectPicker,
  });
  const [validation, setValidation] = useState<string>();
  const [savedId, setSavedId] = useState(log?.id);
  const projectAttempts = useQuery({
    queryKey: ['climb-projects', draft.projectId, 'attempts'],
    queryFn: () => api.getProjectAttempts(draft.projectId!),
    enabled: !!draft.isProject && !!draft.projectId,
  });
  const priorAttempts = (projectAttempts.data ?? []).filter(
    (entry) =>
      entry.date < draft.date || (entry.date === draft.date && (!savedId || entry.id < savedId)),
  );
  const uncertainHistory = !!draft.isProject && !!draft.projectId && !projectAttempts.data;
  const restrictedOutcomes: ClimbLogInput['outcome'][] = [
    ...(uncertainHistory || (draft.isProject && priorAttempts.length > 0)
      ? ['Flash' as const, 'Onsight' as const]
      : []),
    ...(uncertainHistory ||
    (draft.isProject && priorAttempts.some((entry) => entry.date === draft.date))
      ? ['DayFlash' as const]
      : []),
  ];
  const firstAttempt = ['Flash', 'Onsight', 'DayFlash'].includes(draft.outcome);
  const [photo, setPhoto] = useState<ClimbPhotoDraft | null | undefined>();
  const [picking, setPicking] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const existingPhoto = useQuery({
    queryKey: ['climb-photo', log?.id],
    queryFn: () => api.getClimbPhoto(log!.id),
    enabled: !!log,
    gcTime: 0,
  });
  const displayedPhoto = photo === undefined ? existingPhoto.data : photo;
  const save = useMutation({
    mutationFn: async (input: ClimbLogInput) => {
      const result = savedId
        ? await api.updateClimbLog(savedId, input)
        : await api.createClimbLog(input);
      // Preserve the created ID if a photo upload fails, so retry cannot create duplicates.
      setSavedId(result.id);
      if (result.projectId)
        setDraft((current) => ({ ...current, projectId: result.projectId, isProject: true }));
      if (photo !== undefined) {
        try {
          if (photo) await api.saveClimbPhoto(result.id, photo.base64);
          else await api.deleteClimbPhoto(result.id);
        } catch (error) {
          await cache.invalidateQueries({ queryKey: ['climb-logs'] });
          setPhotoError('The climb was saved, but the photo change was not. Try saving again.');
          throw error;
        }
      }
      return result;
    },
    onSuccess: async (_, input) => {
      await cache.invalidateQueries({ queryKey: ['progress'] });
      await cache.invalidateQueries({ queryKey: ['climb-logs'] });
      await cache.invalidateQueries({ queryKey: ['log-locations', 'climb'] });
      await cache.invalidateQueries({ queryKey: ['climb-photo'] });
      await cache.invalidateQueries({ queryKey: ['climb-projects'] });
      onClose(input.date);
    },
  });
  const patch = (input: Partial<ClimbLogInput>) => {
    setDraft((x) => ({ ...x, ...input }));
    setValidation(undefined);
    save.reset();
  };
  const choosePhoto = async (source: 'library' | 'camera') => {
    setPicking(true);
    setPhotoError(undefined);
    try {
      const selected = await pickClimbPhoto(source);
      if (selected) setPhoto(selected);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The photo could not be opened.');
    } finally {
      setPicking(false);
    }
  };
  return (
    <View testID="climb-editor" style={{ gap: 16 }}>
      {showHeading && <Label syntax="name">{log ? 'Edit climb' : 'Log climb'}</Label>}
      {!!draft.isProject && selectedProject && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: c.accent, gap: 6 }}>
          <Label small syntax="property">
            Selected project
          </Label>
          <Heading name>
            {selectedProject.name ||
              (selectedProject.climbingType === 'Bouldering'
                ? 'Boulder'
                : climbingLabel(selectedProject.climbingType))}
          </Heading>
          <Label syntax="number">{selectedProject.grade.replace('-', ' - ')}</Label>
          <Label small muted>
            {climbingLabel(selectedProject.climbingType)} ·{' '}
            {climbingLabel(selectedProject.environment)}
          </Label>
          {!!selectedProject.location && <Label>{selectedProject.location}</Label>}
        </Card>
      )}
      {!log && (
        <>
          <Button
            title={
              draft.projectId && draft.isProject ? 'Change project' : 'Choose unfinished project'
            }
            accessibilityLabel="Choose unfinished project"
            variant="secondary"
            disabled={save.isPending}
            onPress={() => setProjectPicker(!projectPicker)}
          />
          {projectPicker && (
            <View style={{ gap: 8 }}>
              <SearchField
                scrollRef={scrollRef ?? fallbackScroll}
                label="Search projects"
                placeholder="Name, grade or location"
                value={projectSearch}
                onChangeText={setProjectSearch}
                editable={!save.isPending}
              />
              {projects.isPending ? (
                <Label muted>Loading projects…</Label>
              ) : projects.isError ? (
                <>
                  <ErrorNotice message={errorMessage(projects.error)} />
                  <Button title="Retry projects" onPress={() => void projects.refetch()} />
                </>
              ) : (
                <>
                  {projects.data
                    .filter(({ climb }) =>
                      [
                        climb.name,
                        climb.grade,
                        climb.location,
                        climbingLabel(climb.climbingType),
                      ].some((text) =>
                        text?.toLowerCase().includes(projectSearch.trim().toLowerCase()),
                      ),
                    )
                    .map((project) => (
                      <Button
                        key={project.id}
                        title={`${project.climb.name || (project.climb.climbingType === 'Bouldering' ? 'Boulder' : climbingLabel(project.climb.climbingType))} · ${project.climb.grade.replace('-', ' - ')}${project.climb.location ? ` · ${project.climb.location}` : ''}`}
                        accessibilityLabel={`Choose project ${project.climb.name || project.climb.grade}`}
                        variant="secondary"
                        selected={draft.isProject && draft.projectId === project.id}
                        disabled={save.isPending}
                        onPress={() => {
                          setSelectedProject(project.climb);
                          const {
                            id: _id,
                            projectCompleted: _completed,
                            ...details
                          } = project.climb;
                          setDraft({
                            ...details,
                            date: draft.date,
                            attempts: 1,
                            attemptsMode: 'Exact',
                            outcome: 'Attempted',
                            isProject: true,
                            projectId: project.id,
                          });
                          setAttempts('1');
                          setGradeSearch('');
                          setProjectPicker(false);
                          setProjectSearch('');
                          setValidation(undefined);
                          save.reset();
                        }}
                      />
                    ))}
                  {!projects.data.length && <Label muted>No unfinished projects.</Label>}
                  {!!projects.data.length &&
                    !projects.data.some(({ climb }) =>
                      [
                        climb.name,
                        climb.grade,
                        climb.location,
                        climbingLabel(climb.climbingType),
                      ].some((text) =>
                        text?.toLowerCase().includes(projectSearch.trim().toLowerCase()),
                      ),
                    ) && <Label muted>No matching projects.</Label>}
                </>
              )}
              <Button
                title="Close projects"
                variant="secondary"
                onPress={() => setProjectPicker(false)}
              />
            </View>
          )}
        </>
      )}
      <Button
        title={draft.isProject ? 'Project: on' : 'Mark as project'}
        accessibilityLabel="Mark climb as project"
        selected={!!draft.isProject}
        variant={draft.isProject ? 'primary' : 'secondary'}
        disabled={save.isPending}
        onPress={() => {
          setSelectedProject(undefined);
          patch({ isProject: !draft.isProject, projectId: null });
        }}
      />
      {!!draft.isProject && (
        <Label small muted>
          {draft.outcome === 'Attempted'
            ? 'This project stays unfinished until you log a send.'
            : 'Saving a send completes this project.'}
        </Label>
      )}
      {!log && (
        <Field
          label="Date"
          placeholder="YYYY-MM-DD"
          value={draft.date}
          editable={!save.isPending}
          onChangeText={(date) => patch({ date })}
        />
      )}
      <Choices
        label="Climbing type"
        options={climbingTypes}
        value={draft.climbingType}
        disabled={save.isPending}
        onChange={(climbingType) => {
          const gradeSystem = systemsForType(climbingType)[0]!;
          patch({
            climbingType,
            gradeSystem,
            grade: '',
            environment:
              climbingType !== 'Bouldering' && draft.environment === 'Board'
                ? 'Indoor'
                : draft.environment,
          });
          setGradeSearch('');
        }}
      />
      <Choices
        label="Grade system"
        options={systemsForType(draft.climbingType)}
        value={draft.gradeSystem}
        disabled={save.isPending}
        onChange={(gradeSystem) => {
          patch({ gradeSystem, grade: '' });
          setGradeSearch('');
        }}
      />
      <View style={{ gap: 4 }}>
        <Label syntax="property">Selected grade</Label>
        {draft.grade ? (
          <Heading>{draft.grade.replace('-', ' - ')}</Heading>
        ) : (
          <Label muted>No grade selected</Label>
        )}
        <Label small muted>
          Choose up to two grades, at most three steps apart. Tap a selected grade to remove it.
        </Label>
      </View>
      {
        <View style={{ gap: 8 }}>
          <SearchField
            label="Search grades"
            value={gradeSearch}
            onChangeText={setGradeSearch}
            editable={!save.isPending}
            autoCapitalize="none"
            placeholder="Search grades"
          />
          <ScrollView
            style={{ maxHeight: 220 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {climbingGrades[draft.gradeSystem]
                .filter((grade) => grade.toLowerCase().includes(gradeSearch.trim().toLowerCase()))
                .map((grade) => (
                  <Button
                    key={grade}
                    title={grade}
                    accessibilityLabel={`Choose grade ${grade}`}
                    variant={
                      gradeEndpoints(draft.gradeSystem, draft.grade).includes(grade)
                        ? 'primary'
                        : 'secondary'
                    }
                    selected={gradeEndpoints(draft.gradeSystem, draft.grade).includes(grade)}
                    disabled={
                      save.isPending ||
                      (gradeEndpoints(draft.gradeSystem, draft.grade).length === 2 &&
                        !gradeEndpoints(draft.gradeSystem, draft.grade).includes(grade)) ||
                      (gradeEndpoints(draft.gradeSystem, draft.grade).length === 1 &&
                        Math.abs(
                          climbingGrades[draft.gradeSystem].indexOf(grade) -
                            climbingGrades[draft.gradeSystem].indexOf(draft.grade),
                        ) > 3)
                    }
                    onPress={() => {
                      const selected = gradeEndpoints(draft.gradeSystem, draft.grade);
                      const next = selected.includes(grade)
                        ? selected.filter((x) => x !== grade)
                        : [...selected, grade];
                      if (next.length > 2) return;
                      const scale = climbingGrades[draft.gradeSystem];
                      if (
                        next.length === 2 &&
                        Math.abs(scale.indexOf(next[0]!) - scale.indexOf(next[1]!)) > 3
                      )
                        return;
                      patch({
                        grade: next.sort((a, b) => scale.indexOf(a) - scale.indexOf(b)).join('-'),
                      });
                    }}
                  />
                ))}
            </View>
          </ScrollView>
          {!climbingGrades[draft.gradeSystem].some((grade) =>
            grade.toLowerCase().includes(gradeSearch.trim().toLowerCase()),
          ) && <Label muted>No grades found.</Label>}
        </View>
      }
      <Choices
        label="Environment"
        options={draft.climbingType === 'Bouldering' ? climbingEnvironments : ['Indoor', 'Outdoor']}
        value={draft.environment}
        disabled={save.isPending}
        onChange={(environment) => patch({ environment })}
      />
      <Choices
        label="Outcome"
        options={climbingOutcomes}
        value={draft.outcome}
        disabled={save.isPending}
        disabledOptions={restrictedOutcomes}
        onChange={(outcome) => {
          patch({ outcome });
          if (['Flash', 'Onsight', 'DayFlash'].includes(outcome)) {
            setAttempts('1');
            patch({ outcome, attemptsMode: 'Exact' });
          }
        }}
      />
      {!firstAttempt && (
        <Choices
          label="Attempt count"
          options={['Exact', 'MoreThan', 'Unknown'] as const}
          value={draft.attemptsMode ?? 'Exact'}
          disabled={save.isPending}
          onChange={(attemptsMode) => patch({ attemptsMode })}
        />
      )}
      {!firstAttempt && draft.attemptsMode !== 'Unknown' && (
        <Field
          label="Attempts this day"
          value={attempts}
          keyboardType="number-pad"
          editable={!save.isPending}
          onChangeText={(value) => {
            setAttempts(value);
            setValidation(undefined);
          }}
        />
      )}
      {!firstAttempt && draft.attemptsMode === 'MoreThan' && (
        <Label small muted>
          More than 5 displays as 5+ attempts.
        </Label>
      )}
      {!!draft.isProject && priorAttempts.length > 0 && (
        <Label small muted>
          Flash and onsight are unavailable after previous project attempts.
        </Label>
      )}
      {!!draft.isProject && priorAttempts.some((entry) => entry.date === draft.date) && (
        <Label small muted>
          Day flash is unavailable after an earlier attempt today.
        </Label>
      )}
      {!!draft.isProject && !!draft.projectId && projectAttempts.isPending && (
        <Label small muted>
          Checking previous attempts…
        </Label>
      )}
      {!!draft.isProject && projectAttempts.isError && (
        <>
          <ErrorNotice message={errorMessage(projectAttempts.error)} />
          <Button title="Retry project attempts" onPress={() => void projectAttempts.refetch()} />
        </>
      )}
      <Label muted small>
        {
          {
            Attempted: 'Not sent yet. Record the attempts made this day.',
            Flash: 'Sent on the first attempt with prior information.',
            Onsight: 'Sent on the first attempt without prior information.',
            DayFlash: 'Sent on the first attempt of the day, after attempts on an earlier day.',
            Redpoint:
              'Sent after practice or previous attempts. An exact one-attempt send is automatically classified as flashed or day flashed when eligible.',
          }[draft.outcome]
        }
      </Label>
      <View style={{ gap: 8 }}>
        <Label small>Wall angles (optional, select multiple)</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {wallAngles.map((angle) => {
            const selected = draft.wallAngles ?? (draft.wallAngle ? [draft.wallAngle] : []);
            return (
              <Button
                key={angle}
                title={angle}
                accessibilityLabel={`Wall angle: ${angle}`}
                selected={selected.includes(angle)}
                variant={selected.includes(angle) ? 'primary' : 'secondary'}
                disabled={save.isPending}
                onPress={() => {
                  const next = selected.includes(angle)
                    ? selected.filter((value) => value !== angle)
                    : [...selected, angle];
                  patch({ wallAngles: next, wallAngle: next[0] ?? null });
                }}
              />
            );
          })}
        </View>
      </View>
      <Label small>Styles (optional, select multiple)</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {climbingStyles.map((style) => (
          <Pressable
            key={style}
            accessibilityRole="checkbox"
            accessibilityLabel={style}
            accessibilityState={{ checked: draft.styles.includes(style), disabled: save.isPending }}
            aria-checked={draft.styles.includes(style)}
            aria-disabled={save.isPending}
            {...(Platform.OS === 'web'
              ? {
                  onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                    if (event.key === ' ' && !save.isPending) {
                      event.preventDefault();
                      patch({
                        styles: draft.styles.includes(style)
                          ? draft.styles.filter((x) => x !== style)
                          : [...draft.styles, style],
                      });
                    }
                  },
                }
              : {})}
            disabled={save.isPending}
            onPress={() =>
              patch({
                styles: draft.styles.includes(style)
                  ? draft.styles.filter((x) => x !== style)
                  : [...draft.styles, style],
              })
            }
            style={{
              minHeight: 42,
              justifyContent: 'center',
              padding: 10,
              borderWidth: 1,
              borderColor: draft.styles.includes(style) ? c.focus : c.line,
              backgroundColor: c.input,
            }}
          >
            <Label small syntax={draft.styles.includes(style) ? 'keyword' : undefined}>
              {style}
            </Label>
          </Pressable>
        ))}
      </View>
      <Field
        label="Route name (optional)"
        value={draft.name ?? ''}
        maxLength={100}
        editable={!save.isPending}
        onChangeText={(name) => patch({ name })}
      />
      <LocationField
        scrollRef={scrollRef}
        activity="climb"
        value={draft.location ?? ''}
        disabled={save.isPending}
        onChange={(location) => patch({ location })}
      />
      <ErrorNotice message={validation ?? (save.isError ? errorMessage(save.error) : undefined)} />
      <View style={{ gap: 8 }}>
        <Label small>Photo (optional)</Label>
        {displayedPhoto && <PhotoPreview photo={displayedPhoto} />}
        {log && existingPhoto.isPending && (
          <Label small muted>
            Loading photo…
          </Label>
        )}
        {existingPhoto.isError && <ErrorNotice message="The existing photo could not be loaded." />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            title="Upload photo"
            variant="secondary"
            busy={picking}
            disabled={save.isPending}
            onPress={() => {
              void choosePhoto('library');
            }}
          />
          <Button
            title="Take photo"
            variant="secondary"
            busy={picking}
            disabled={save.isPending}
            onPress={() => {
              void choosePhoto('camera');
            }}
          />
          {!!displayedPhoto && (
            <Button
              title="Remove photo"
              variant="secondary"
              disabled={save.isPending || picking}
              onPress={() => setPhoto(null)}
            />
          )}
        </View>
        {!!displayedPhoto && (
          <Label small muted>
            Uploading or taking another photo will replace the current photo when you save.
          </Label>
        )}
        <ErrorNotice message={photoError} />
      </View>
      <Button
        title={log ? 'Save changes' : 'Save climb'}
        busy={save.isPending}
        disabled={picking}
        onPress={() => {
          if (restrictedOutcomes.includes(draft.outcome)) {
            setValidation('Choose an outcome available for this project’s previous attempts.');
            return;
          }
          const actualAttempts = firstAttempt ? '1' : attempts;
          const attemptsMode = firstAttempt ? 'Exact' : (draft.attemptsMode ?? 'Exact');
          if (
            attemptsMode !== 'Unknown' &&
            (!/^\d+$/.test(actualAttempts) ||
              Number(actualAttempts) < 1 ||
              Number(actualAttempts) > 1000)
          ) {
            setValidation('Enter attempts as a whole number from 1 to 1000.');
            return;
          }
          const result = climbLogInputSchema.safeParse({
            ...draft,
            attempts: attemptsMode === 'Unknown' ? null : Number(actualAttempts),
            attemptsMode,
            outcome:
              draft.outcome === 'Redpoint' &&
              attemptsMode === 'Exact' &&
              Number(actualAttempts) === 1 &&
              !priorAttempts.some((entry) => entry.date === draft.date) &&
              !uncertainHistory
                ? priorAttempts.length
                  ? 'DayFlash'
                  : 'Flash'
                : draft.outcome,
          });
          if (!result.success) {
            setValidation(result.error.issues[0]?.message ?? 'Check the climb details.');
            return;
          }
          save.mutate(result.data);
        }}
      />
      <Button
        title="Cancel"
        variant="secondary"
        disabled={save.isPending}
        onPress={() => onClose()}
      />
    </View>
  );
}
