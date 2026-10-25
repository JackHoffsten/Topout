import { z } from 'zod';
import { exerciseSchema } from './exerciseContracts';

export const exerciseOrderInputSchema = z.object({
  exerciseIds: z
    .array(z.number().int().positive())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'Choose distinct exercises.'),
});

const plannedSideSchema = z
  .object({
    targetRepsMin: z.number().int().min(1).max(1000).nullish().default(null),
    targetRepsMax: z.number().int().min(1).max(1000).nullish(),
    targetWeightKg: z.number().min(0).max(2000).nullish(),
  })
  .refine(
    (s) =>
      s.targetRepsMax == null || (s.targetRepsMin != null && s.targetRepsMax >= s.targetRepsMin),
    {
      message: 'Maximum reps must be at least minimum reps.',
      path: ['targetRepsMax'],
    },
  );

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
      z.object({
        exerciseId: z.number().int().positive(),
        sets: z.array(plannedSetSchema).default([]),
      }),
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
