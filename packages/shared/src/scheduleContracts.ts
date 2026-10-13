import { z } from 'zod';

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
