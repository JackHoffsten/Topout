import { z } from 'zod';
import { climbHistorySchema, climbProjectsSchema, projectAttemptsSchema } from './climbing';
import { progressSchema } from './progress';
import {
  climbLogInputSchema,
  climbLogSchema,
  climbLogsSchema,
  type ClimbLogInput,
} from './climbing';
import {
  type AccessSession,
  type ExerciseInput,
  type LoginInput,
  type RegisterInput,
  exerciseSchema,
  exercisesSchema,
  problemSchema,
  type WorkoutTemplateInput,
  workoutTemplateSchema,
  workoutTemplatesSchema,
  type ScheduleWorkoutInput,
  scheduleWorkoutInputSchema,
  scheduledWorkoutSchema,
  workoutScheduleSchema,
  type CompleteWorkoutInput,
  completeWorkoutInputSchema,
  workoutLoggingSchema,
  type RecordWorkoutSet,
  recordWorkoutSetSchema,
} from './contracts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type Fetcher = typeof fetch;

export const climbPhotoSchema = z.object({
  base64: z.string().min(1).max(2796204),
  width: z.number().int().min(1).max(1600),
  height: z.number().int().min(1).max(1600),
});

export async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const result = problemSchema.safeParse(body);
    const messages: Record<number, string> = {
      400: 'Check the details and try again.',
      401: 'Please sign in again.',
      403: 'Your session could not be verified. Please try again.',
      404: 'This item is no longer available.',
      409: 'This change could not be saved.',
      429: 'Too many attempts. Give it a moment and try again.',
    };
    const validation = result.success
      ? Object.values(result.data.errors ?? {}).flat()[0]
      : undefined;
    throw new ApiError(
      response.status,
      validation ||
        (result.success && (result.data.detail || result.data.title)) ||
        messages[response.status] ||
        'Something went wrong. Please try again.',
    );
  }
  return body;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Could not connect. Check your connection and try again.';
}

export interface SessionTransport {
  login(input: LoginInput): Promise<AccessSession>;
  register(input: RegisterInput): Promise<AccessSession>;
  refresh(): Promise<AccessSession | null>;
  revoke(): Promise<void>;
  clear(): Promise<void>;
}

export type SessionStatus = 'restoring' | 'authenticated' | 'anonymous';

export class ApiClient {
  private token: string | null = null;
  private status: SessionStatus = 'restoring';
  private listeners = new Set<() => void>();
  private initialization?: Promise<void>;
  private renewal?: Promise<void>;
  private generation = 0;

  constructor(
    private baseUrl: string,
    private transport: SessionTransport,
    private fetcher: Fetcher = fetch,
  ) {}

  getStatus = (): SessionStatus => this.status;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(session: AccessSession | null) {
    this.token = session?.accessToken ?? null;
    this.status = session ? 'authenticated' : 'anonymous';
    this.listeners.forEach((listener) => listener());
  }

  initialize() {
    return (this.initialization ??= this.refresh().catch(() => undefined));
  }

  async login(input: LoginInput) {
    const generation = ++this.generation;
    const session = await this.transport.login(input);
    if (generation === this.generation) this.set(session);
  }

  async register(input: RegisterInput) {
    const generation = ++this.generation;
    const session = await this.transport.register(input);
    if (generation === this.generation) this.set(session);
  }

  private refresh(): Promise<void> {
    if (this.renewal) return this.renewal;
    const generation = this.generation;
    this.renewal = (async () => {
      try {
        const session = await this.transport.refresh();
        if (generation === this.generation) this.set(session);
      } catch (error) {
        if (generation === this.generation) {
          try {
            await this.transport.clear();
          } finally {
            this.set(null);
          }
        }
        throw error;
      }
    })().finally(() => {
      this.renewal = undefined;
    });
    return this.renewal;
  }

  async logout() {
    // Serialize logout after an in-flight refresh so it revokes the successor.
    await this.renewal?.catch(() => undefined);
    await this.transport.revoke();
    await this.forget();
  }

  async forget() {
    ++this.generation;
    try {
      await this.transport.clear();
    } finally {
      this.set(null);
    }
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    method = 'GET',
    body?: unknown,
  ): Promise<T> {
    const generation = this.generation;
    // Browser fetch must not be invoked with ApiClient as its receiver.
    const fetcher = this.fetcher;
    const send = () =>
      fetcher(this.baseUrl + path, {
        method,
        ...(path === '/api/account' ? { credentials: 'include' as const } : {}),
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const sentToken = this.token;
    let response = await send();

    if (response.status === 401) {
      if (sentToken === this.token) await this.refresh();
      if (!this.token || generation !== this.generation)
        throw new ApiError(401, 'Please sign in again.');
      response = await send();
      if (response.status === 401) await this.forget();
    }

    if (generation !== this.generation)
      throw new ApiError(401, 'Your session changed. Please sign in again.');
    return schema.parse(await readResponse(response));
  }

  listExercises() {
    return this.request('/api/exercises', exercisesSchema);
  }

  async deleteAccount(password: string) {
    await this.renewal?.catch(() => undefined);
    await this.request('/api/account', z.undefined(), 'DELETE', { password });
    await this.forget();
  }

  getProgress(from?: string, to?: string) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return this.request('/api/progress' + (params.size ? '?' + params : ''), progressSchema);
  }

  listClimbLogs(from: string, to: string) {
    return this.request(
      `/api/climb-logs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      climbLogsSchema,
    );
  }

  listClimbingDays(from: string, to: string) {
    return this.request(
      `/api/climb-logs/days?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      z.array(z.iso.date()),
    );
  }
  setClimbingDay(date: string, marked: boolean) {
    z.iso.date().parse(date);
    return this.request(`/api/climb-logs/days/${date}`, z.undefined(), marked ? 'PUT' : 'DELETE');
  }

  listClimbProjects() {
    return this.request('/api/climb-logs/projects', climbProjectsSchema);
  }
  getProjectAttempts(id: number) {
    return this.request(`/api/climb-logs/projects/${id}/attempts`, projectAttemptsSchema);
  }

  createClimbLog(input: ClimbLogInput) {
    return this.request(
      '/api/climb-logs',
      climbLogSchema,
      'POST',
      climbLogInputSchema.parse(input),
    );
  }

  getClimbLog(id: number) {
    return this.request('/api/climb-logs/' + id, climbLogSchema);
  }
  listClimbHistory(page = 1, filters: import('./climbing').ClimbHistoryFilters = {}) {
    const params = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else if (value) params.set(key, value);
    });
    return this.request('/api/climb-logs/history?' + params, climbHistorySchema);
  }

  updateClimbLog(id: number, input: ClimbLogInput) {
    return this.request(
      '/api/climb-logs/' + id,
      climbLogSchema,
      'PUT',
      climbLogInputSchema.parse(input),
    );
  }

  deleteClimbLog(id: number) {
    return this.request('/api/climb-logs/' + id, z.undefined(), 'DELETE');
  }

  getClimbPhoto(id: number) {
    return this.request(`/api/climb-logs/${id}/photo`, climbPhotoSchema.nullable());
  }

  saveClimbPhoto(id: number, base64: string) {
    return this.request(`/api/climb-logs/${id}/photo`, climbPhotoSchema, 'PUT', {
      base64: z.string().min(1).max(2796204).parse(base64),
    });
  }

  deleteClimbPhoto(id: number) {
    return this.request(`/api/climb-logs/${id}/photo`, z.undefined(), 'DELETE');
  }

  listWorkoutTemplates() {
    return this.request('/api/workout-templates', workoutTemplatesSchema);
  }

  listWorkoutSchedule(from: string, to: string) {
    return this.request(
      `/api/workout-schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      workoutScheduleSchema,
    );
  }

  scheduleWorkout(input: ScheduleWorkoutInput) {
    return this.request(
      '/api/workout-schedule',
      scheduledWorkoutSchema,
      'POST',
      scheduleWorkoutInputSchema.parse(input),
    );
  }

  deleteScheduledWorkout(id: number) {
    return this.request('/api/workout-schedule/' + id, z.undefined(), 'DELETE');
  }

  deleteWorkoutLog(scheduleId: number) {
    return this.request(`/api/workout-schedule/${scheduleId}/log`, z.undefined(), 'DELETE');
  }

  getWorkoutLogging(scheduleId: number) {
    return this.request(`/api/workout-schedule/${scheduleId}/log`, workoutLoggingSchema);
  }

  listLogLocations(activity: 'workout' | 'climb', search = '') {
    return this.request(
      `/api/log-locations?activity=${activity}&search=${encodeURIComponent(search.trim())}`,
      z.array(z.string().max(200)).max(8),
    );
  }

  setWorkoutLocation(scheduleId: number, location: string | null) {
    return this.request(
      `/api/workout-schedule/${scheduleId}/log/location`,
      workoutLoggingSchema,
      'PUT',
      {
        location: z.string().trim().max(200).nullable().parse(location),
      },
    );
  }

  completeWorkout(scheduleId: number, input: CompleteWorkoutInput) {
    return this.request(
      `/api/workout-schedule/${scheduleId}/log`,
      workoutLoggingSchema,
      'POST',
      completeWorkoutInputSchema.parse(input),
    );
  }

  updateWorkout(scheduleId: number, input: CompleteWorkoutInput) {
    return this.request(
      `/api/workout-schedule/${scheduleId}/log`,
      workoutLoggingSchema,
      'PUT',
      completeWorkoutInputSchema.parse(input),
    );
  }

  recordWorkoutSet(scheduleId: number, input: RecordWorkoutSet) {
    return this.request(
      `/api/workout-schedule/${scheduleId}/log/sets`,
      workoutLoggingSchema,
      'PUT',
      recordWorkoutSetSchema.parse(input),
    );
  }

  removeWorkoutSet(
    scheduleId: number,
    exerciseId: number,
    order: number,
    side: 'Both' | 'Left' | 'Right' = 'Both',
  ) {
    return this.request(
      `/api/workout-schedule/${scheduleId}/log/sets/${exerciseId}/${order}${side === 'Both' ? '' : `?side=${side}`}`,
      workoutLoggingSchema,
      'DELETE',
    );
  }

  getWorkoutTemplate(id: number) {
    return this.request('/api/workout-templates/' + id, workoutTemplateSchema);
  }

  createWorkoutTemplate(input: WorkoutTemplateInput) {
    return this.request('/api/workout-templates', workoutTemplateSchema, 'POST', input);
  }

  updateWorkoutTemplate(id: number, input: WorkoutTemplateInput) {
    return this.request('/api/workout-templates/' + id, workoutTemplateSchema, 'PUT', input);
  }

  deleteWorkoutTemplate(id: number) {
    return this.request('/api/workout-templates/' + id, z.undefined(), 'DELETE');
  }

  createExercise(input: ExerciseInput) {
    return this.request('/api/exercises', exerciseSchema, 'POST', input);
  }

  updateExercise(id: number, input: ExerciseInput) {
    return this.request('/api/exercises/' + id, exerciseSchema, 'PUT', input);
  }

  deleteExercise(id: number) {
    return this.request('/api/exercises/' + id, z.undefined(), 'DELETE');
  }
}
