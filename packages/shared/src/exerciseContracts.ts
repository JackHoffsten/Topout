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

export function muscleLabel(group: MuscleGroup): string {
  return group === 'FullBody' ? 'Full body' : group === 'None' ? 'Other' : group;
}
