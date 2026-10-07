import { z } from 'zod';

export const climbingTypes = ['Bouldering', 'Sport', 'TopRope'] as const;
export const climbingEnvironments = ['Indoor', 'Outdoor', 'Board'] as const;
export const climbingOutcomes = ['Attempted', 'Redpoint', 'Flash', 'Onsight', 'DayFlash'] as const;
export const wallAngles = ['Slab', 'Vertical', 'Overhang', 'Roof'] as const;
export const climbingStyles = [
  'Crimpy',
  'Slopy',
  'Juggy',
  'Pinchy',
  'Technical',
  'Powerful',
  'Dynamic',
  'Balance',
  'Endurance',
] as const;
export const gradeSystems = ['Font', 'V', 'French', 'YDS'] as const;
export type ClimbingType = (typeof climbingTypes)[number];
export type GradeSystem = (typeof gradeSystems)[number];

export function systemsForType(type: ClimbingType): GradeSystem[] {
  return type === 'Bouldering' ? ['Font', 'V'] : ['French', 'YDS'];
}
const numbers = (start: number, length: number) => Array.from({ length }, (_, i) => start + i);
export const climbingGrades: Record<GradeSystem, string[]> = {
  Font: [
    '1',
    '2',
    '3',
    '4',
    '4+',
    '5',
    '5+',
    ...numbers(6, 4).flatMap((n) => ['A', 'A+', 'B', 'B+', 'C', 'C+'].map((s) => `${n}${s}`)),
  ],
  V: ['VB', ...numbers(0, 18).map((n) => `V${n}`)],
  French: [
    '1',
    '2',
    '3',
    '4a',
    '4b',
    '4c',
    '5a',
    '5b',
    '5c',
    ...numbers(6, 4).flatMap((n) => ['a', 'a+', 'b', 'b+', 'c', 'c+'].map((s) => `${n}${s}`)),
  ],
  YDS: [
    ...numbers(0, 10).map((n) => `5.${n}`),
    ...numbers(10, 6).flatMap((n) => ['a', 'b', 'c', 'd'].map((s) => `5.${n}${s}`)),
  ],
};
export function climbingLabel(value: string): string {
  return (
    (
      {
        TopRope: 'Top rope',
        Font: 'Fontainebleau',
        V: 'V scale',
        French: 'French',
        YDS: 'YDS',
        Redpoint: 'Redpoint / sent',
        DayFlash: 'Day flash',
        MoreThan: 'More than',
        projects: 'Projects',
        unfinished: 'Unfinished projects',
        completed: 'Completed projects',
        none: 'Not projects',
      } as Record<string, string>
    )[value] ?? value
  );
}

/** One grade, or two distinct endpoints in ascending scale order. */
export function gradeEndpoints(system: GradeSystem, grade: string): string[] {
  const parts = grade.split('-');
  const scale = climbingGrades[system];
  if (parts.length === 1 && scale.includes(parts[0]!)) return parts;
  if (
    parts.length === 2 &&
    scale.indexOf(parts[0]!) >= 0 &&
    scale.indexOf(parts[1]!) > scale.indexOf(parts[0]!) &&
    scale.indexOf(parts[1]!) - scale.indexOf(parts[0]!) <= 3
  )
    return parts;
  return [];
}

/** Use the middle scale step, rounding toward the easier grade. */
export function representativeGrade(system: GradeSystem, grade: string): string {
  const endpoints = gradeEndpoints(system, grade);
  if (!endpoints.length) return '';
  const scale = climbingGrades[system];
  return scale[Math.floor((scale.indexOf(endpoints[0]!) + scale.indexOf(endpoints.at(-1)!)) / 2)]!;
}

const optionalText = (max: number) => z.string().trim().max(max).nullable();
const climbFields = {
  date: z.iso.date().refine((value) => value >= '0001-01-01', 'Choose a valid date.'),
  climbingType: z.enum(climbingTypes),
  gradeSystem: z.enum(gradeSystems),
  grade: z.string().trim(),
  environment: z.enum(climbingEnvironments),
  attempts: z.number().int().min(1).max(1000).nullable(),
  attemptsMode: z.enum(['Exact', 'MoreThan', 'Unknown']).optional(),
  outcome: z.enum(climbingOutcomes),
  wallAngle: z.enum(wallAngles).nullable(),
  styles: z
    .array(z.enum(climbingStyles))
    .max(climbingStyles.length)
    .refine((values) => new Set(values).size === values.length, 'Choose distinct styles.'),
  name: optionalText(100),
  location: optionalText(200),
  isProject: z.boolean().optional(),
  projectId: z.number().int().positive().nullish(),
};
function validateClimb(value: z.infer<z.ZodObject<typeof climbFields>>, ctx: z.RefinementCtx) {
  if ((value.attemptsMode === 'Unknown') !== (value.attempts === null))
    ctx.addIssue({
      code: 'custom',
      path: ['attempts'],
      message: 'Enter a number of attempts or choose Unknown.',
    });
  if (value.projectId != null && value.isProject === false)
    ctx.addIssue({ code: 'custom', path: ['projectId'], message: 'Choose a valid project.' });
  if (!systemsForType(value.climbingType).includes(value.gradeSystem))
    ctx.addIssue({
      code: 'custom',
      path: ['gradeSystem'],
      message: 'Choose a grade system for this climbing type.',
    });
  if (!gradeEndpoints(value.gradeSystem, value.grade).length)
    ctx.addIssue({ code: 'custom', path: ['grade'], message: 'Choose a valid grade.' });
  if (value.environment === 'Board' && value.climbingType !== 'Bouldering')
    ctx.addIssue({
      code: 'custom',
      path: ['environment'],
      message: 'Board climbing is available for bouldering only.',
    });
  if (
    ['Flash', 'Onsight', 'DayFlash'].includes(value.outcome) &&
    (value.attempts !== 1 || (value.attemptsMode ?? 'Exact') !== 'Exact')
  )
    ctx.addIssue({
      code: 'custom',
      path: ['attempts'],
      message: 'Flash, onsight and day flash require one attempt.',
    });
}
export const climbLogInputSchema = z.object(climbFields).superRefine(validateClimb);
export const climbLogSchema = z
  .object({
    id: z.number().int().positive(),
    ...climbFields,
    projectCompleted: z.boolean().optional(),
    totalAttempts: z.number().int().positive().nullish(),
    totalAttemptsIsLowerBound: z.boolean().optional(),
  })
  .superRefine(validateClimb);
export const climbLogsSchema = z.array(climbLogSchema);
export const climbProjectsSchema = z.array(
  z.object({ id: z.number().int().positive(), climb: climbLogSchema }),
);
export const projectAttemptsSchema = z.array(
  z.object({ id: z.number().int().positive(), date: z.iso.date() }),
);
export const climbHistorySchema = z.object({
  totalCount: z.number().int().nonnegative(),
  items: climbLogsSchema,
  nextPage: z.number().int().positive().nullable(),
});
export function climbOutcomeLabel(outcome: string): string {
  return (
    (
      {
        Attempted: 'Not sent',
        Redpoint: 'Sent',
        Flash: 'Flashed',
        Onsight: 'Onsighted',
        DayFlash: 'Day flashed',
      } as Record<string, string>
    )[outcome] ?? outcome
  );
}
export type ClimbLogInput = z.infer<typeof climbLogInputSchema>;
export type ClimbLog = z.infer<typeof climbLogSchema>;
export type ClimbHistoryFilters = {
  project?: 'projects' | 'unfinished' | 'completed' | 'none';
  grade?: string | string[];
  sort?: 'date-desc' | 'date-asc' | 'grade-desc' | 'grade-asc';
  climbingType?: ClimbingType | ClimbingType[];
  gradeSystem?: GradeSystem | GradeSystem[];
  environment?: (typeof climbingEnvironments)[number] | (typeof climbingEnvironments)[number][];
  outcome?: (typeof climbingOutcomes)[number] | (typeof climbingOutcomes)[number][];
  wallAngle?: (typeof wallAngles)[number] | (typeof wallAngles)[number][];
  style?: (typeof climbingStyles)[number] | (typeof climbingStyles)[number][];
  search?: string;
  from?: string;
  to?: string;
};
export function filterValues(value?: string | readonly string[]): string[] {
  return value === undefined ? [] : typeof value === 'string' ? [value] : [...value];
}
export function toggleFilter<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
