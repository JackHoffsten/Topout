import { useSaveMutation } from '../../ui/saveFeedback';
import { SaveStatus } from '../../ui/components/SaveStatus';
import { ClimbGradePicker } from './ClimbGradePicker';
import { createClimbSave, ClimbPhotoSaveError } from './climbSave';
import { refreshTraining } from '../training/queries';
import { useRef, useState, type RefObject } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  climbingTypes,
  climbingEnvironments,
  climbingOutcomes,
  climbingStyles,
  wallAngles,
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
import { ClimbingChoices } from './ClimbingChoices';

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
  const [saveWorkflow] = useState(() => createClimbSave(api, log?.id));
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
  const save = useSaveMutation(
    'Climb and photo',
    {
      mutationFn: async (input: ClimbLogInput) => {
        try {
          return await saveWorkflow.save(input, undefined, (result) => {
            setSavedId(result.id);
            if (result.projectId)
              setDraft((current) => ({ ...current, projectId: result.projectId, isProject: true }));
          });
        } catch (error) {
          if (error instanceof ClimbPhotoSaveError) {
            await refreshTraining(cache, 'climb');
            setPhotoError(error.message);
            throw error;
          }
          throw error;
        }
      },
      onSuccess: async (_, input) => {
        await refreshTraining(cache, 'climb');
        onClose(input.date);
      },
    },
    (error) => error instanceof ClimbPhotoSaveError,
  );
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
      if (selected) {
        saveWorkflow.replacePendingPhoto(selected);
        setPhoto(selected);
      }
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
      <ClimbingChoices
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
      <ClimbingChoices
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
        <ClimbGradePicker
          system={draft.gradeSystem}
          value={draft.grade}
          search={gradeSearch}
          onSearch={setGradeSearch}
          disabled={save.isPending}
          onChange={(grade) => patch({ grade })}
        />
      }
      <ClimbingChoices
        label="Environment"
        options={draft.climbingType === 'Bouldering' ? climbingEnvironments : ['Indoor', 'Outdoor']}
        value={draft.environment}
        disabled={save.isPending}
        onChange={(environment) => patch({ environment })}
      />
      <ClimbingChoices
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
        <ClimbingChoices
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
              onPress={() => {
                saveWorkflow.replacePendingPhoto(null);
                setPhoto(null);
              }}
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
      <SaveStatus feedback={save.feedback} />
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
