import { z } from 'zod';
import { exerciseSchema } from './exerciseContracts';
import { workoutTemplateSchema } from './templateContracts';

export const loggedSetSchema = z.object({
  side: z.enum(['Both', 'Left', 'Right']).default('Both'),
  reps: z.number().int().min(1, 'Enter 1–1000 reps.').max(1000, 'Enter 1–1000 reps.'),
  weightKg: z.number().min(0, 'Enter 0–2000 kg.').max(2000, 'Enter 0–2000 kg.'),
  isWarmup: z.boolean(),
  notes: z.string().trim().max(2000).nullable(),
});

export const completeWorkoutInputSchema = z
  .object({
    location: z
      .string()
      .trim()
      .max(200, 'Location may contain up to 200 characters.')
      .nullable()
      .optional(),
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

const replacementSetSchema = z.object({
  order: z.number().int().min(1).max(100),
  side: z.enum(['Both', 'Left', 'Right']),
  isWarmup: z.boolean(),
});

export const workoutLogSchema = z.object({
  replacements: z
    .array(
      z.object({
        originalExerciseId: z.number().int().positive(),
        exercise: exerciseSchema,
        order: z.number().int().min(1).max(100),
        sets: z.array(replacementSetSchema),
      }),
    )
    .optional(),
  removedExerciseIds: z.array(z.number().int().positive()).optional(),
  location: z.string().nullable().optional(),
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
        notes: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

export type WorkoutLogging = z.infer<typeof workoutLoggingSchema>;

export const recordWorkoutSetSchema = loggedSetSchema.extend({
  location: z.string().trim().max(200).optional(),
  exerciseId: z.number().int().positive(),
  order: z.number().int().min(1).max(100),
});

export type RecordWorkoutSet = z.input<typeof recordWorkoutSetSchema>;
export const replaceWorkoutExerciseInputSchema = z.object({
  replacementExerciseId: z.number().int().positive(),
  order: z.number().int().min(1).max(100),
  sets: z.array(replacementSetSchema).max(200),
});
export type ReplaceWorkoutExerciseInput = z.input<typeof replaceWorkoutExerciseInputSchema>;
