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

export const exerciseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  muscleGroup: muscleGroupSchema,
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
  muscleGroup: muscleGroupSchema,
});

export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

export const plannedSetSchema = z
  .object({
    targetRepsMin: z.number().int().min(1).max(1000),
    targetRepsMax: z.number().int().min(1).max(1000).nullish(),
    targetWeightKg: z.number().min(0).max(2000).nullish(),
    isWarmup: z.boolean(),
    isAmrap: z.boolean(),
  })
  .refine((s) => s.targetRepsMax == null || s.targetRepsMax >= s.targetRepsMin, {
    message: 'Maximum reps must be at least minimum reps.',
    path: ['targetRepsMax'],
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
