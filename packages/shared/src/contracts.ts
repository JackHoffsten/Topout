import { z } from 'zod';

export const muscleGroups = [
  'None',
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'FullBody',
] as const;

export const muscleGroupSchema = z.enum(muscleGroups);

export type MuscleGroup = z.infer<typeof muscleGroupSchema>;

export const exerciseMuscleGroupsSchema = z
  .array(muscleGroupSchema.exclude(['None']))
  .refine(
    (groups) => new Set(groups).size === groups.length,
    'Muscle groups must not be repeated.',
  );

export const exerciseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  muscleGroups: exerciseMuscleGroupsSchema,
  isCustom: z.boolean(),
});

export const exercisesSchema = z.array(exerciseSchema);

export type Exercise = z.infer<typeof exerciseSchema>;

export const exerciseInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Give your exercise a name.')
    .max(100, 'Use 100 characters or fewer.'),
  muscleGroups: exerciseMuscleGroupsSchema,
});

export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

const plannedSideSchema = z
  .object({
    targetRepsMin: z.number().int().min(1).max(1000),
    targetRepsMax: z.number().int().min(1).max(1000).nullish(),
    targetWeightKg: z.number().min(0).max(2000).nullish(),
  })
  .refine((s) => s.targetRepsMax == null || s.targetRepsMax >= s.targetRepsMin, {
    message: 'Maximum reps must be at least minimum reps.',
    path: ['targetRepsMax'],
  });

export const plannedSetSchema = plannedSideSchema.safeExtend({
  isWarmup: z.boolean(),
  isAmrap: z.boolean(),
  rightTarget: plannedSideSchema.nullish(),
});

export type PlannedSet = z.infer<typeof plannedSetSchema>;

export const workoutTemplateInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a template name.')
      .max(100, 'Use 100 characters or fewer.'),
    exercises: z.array(
      z.object({ exerciseId: z.number().int().positive(), sets: z.array(plannedSetSchema) }),
    ),
  })
  .refine((t) => new Set(t.exercises.map((e) => e.exerciseId)).size === t.exercises.length, {
    message: 'An exercise can appear only once in a template.',
    path: ['exercises'],
  });

export type WorkoutTemplateInput = z.infer<typeof workoutTemplateInputSchema>;

export const workoutTemplateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  exercises: z.array(z.object({ exercise: exerciseSchema, sets: z.array(plannedSetSchema) })),
});

export const workoutTemplatesSchema = z.array(workoutTemplateSchema);

export type WorkoutTemplate = z.infer<typeof workoutTemplateSchema>;

export const scheduleWorkoutInputSchema = z.object({
  date: z.iso.date(),
  templateId: z.number().int().positive().nullable(),
});
export type ScheduleWorkoutInput = z.infer<typeof scheduleWorkoutInputSchema>;
export const scheduledWorkoutSchema = z.object({
  id: z.number().int().positive(),
  date: z.iso.date(),
  templateId: z.number().int().positive().nullable(),
  templateName: z.string().nullable(),
  isRestDay: z.boolean(),
  status: z.enum(['Planned', 'InProgress', 'Completed', 'Skipped']),
});
export const workoutScheduleSchema = z.array(scheduledWorkoutSchema);
export type ScheduledWorkout = z.infer<typeof scheduledWorkoutSchema>;

export const loggedSetSchema = z.object({
  side: z.enum(['Both', 'Left', 'Right']).default('Both'),
  reps: z.number().int().min(1, 'Enter 1–1000 reps.').max(1000, 'Enter 1–1000 reps.'),
  weightKg: z.number().min(0, 'Enter 0–2000 kg.').max(2000, 'Enter 0–2000 kg.'),
  isWarmup: z.boolean(),
  notes: z.string().trim().max(2000).nullable(),
});
export const completeWorkoutInputSchema = z
  .object({
    notes: z.string().trim().max(2000).nullable(),
    exercises: z
      .array(
        z.object({
          exerciseId: z.number().int().positive(),
          sets: z
            .array(loggedSetSchema.extend({ order: z.number().int().min(1).max(100).optional() }))
            .min(1, 'Add at least one set.')
            .max(200)
            .refine((sets) => {
              const groups = new Map<number, string[]>();
              sets.forEach((set, index) => {
                const order = set.order ?? index + 1;
                groups.set(order, [...(groups.get(order) ?? []), set.side]);
              });
              return [...groups.values()].every(
                (sides) =>
                  new Set(sides).size === sides.length &&
                  !(sides.length > 1 && sides.includes('Both')),
              );
            }, 'Each set may contain either one normal result or separate left/right results.'),
        }),
      )
      .min(1, 'Add at least one exercise.')
      .max(100),
  })
  .refine(
    (input) => new Set(input.exercises.map((e) => e.exerciseId)).size === input.exercises.length,
    { message: 'An exercise can appear only once in a workout.', path: ['exercises'] },
  );
export type CompleteWorkoutInput = z.input<typeof completeWorkoutInputSchema>;
export const workoutLogSchema = z.object({
  id: z.number().int().positive(),
  date: z.iso.date(),
  notes: z.string().nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  exercises: z.array(
    z.object({
      exercise: exerciseSchema,
      sets: z.array(loggedSetSchema.extend({ order: z.number().int().min(1).max(100) })),
    }),
  ),
});
export const workoutLoggingSchema = z.object({
  scheduleId: z.number().int().positive(),
  date: z.iso.date(),
  templateName: z.string().nullable(),
  template: workoutTemplateSchema.nullable(),
  log: workoutLogSchema.nullable(),
  previousSets: z
    .array(
      z.object({
        exerciseId: z.number().int().positive(),
        order: z.number().int().min(1).max(100),
        date: z.iso.date(),
        reps: z.number().int().min(1).max(1000),
        weightKg: z.number().min(0).max(2000),
        isWarmup: z.boolean(),
        side: z.enum(['Both', 'Left', 'Right']).default('Both'),
      }),
    )
    .default([]),
});
export type WorkoutLogging = z.infer<typeof workoutLoggingSchema>;
export const recordWorkoutSetSchema = loggedSetSchema.extend({
  exerciseId: z.number().int().positive(),
  order: z.number().int().min(1).max(100),
});
export type RecordWorkoutSet = z.input<typeof recordWorkoutSetSchema>;

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.').max(256),
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, 'Enter your name.').max(100),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(128)
    .regex(/[a-z]/, 'Add a lowercase letter.')
    .regex(/[A-Z]/, 'Add an uppercase letter.')
    .regex(/[0-9]/, 'Add a number.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;

export const accessSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime({ offset: true }),
});

export const nativeSessionSchema = accessSessionSchema.extend({
  refreshToken: z.string().min(1),
  refreshTokenExpiresAt: z.iso.datetime({ offset: true }),
});

export type AccessSession = z.infer<typeof accessSessionSchema>;

export const csrfSchema = z.object({ csrfToken: z.string().min(1) });

export const problemSchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export function muscleLabel(group: MuscleGroup): string {
  return group === 'FullBody' ? 'Full body' : group === 'None' ? 'Other' : group;
}
