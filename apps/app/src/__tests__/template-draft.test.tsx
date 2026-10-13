import { expect, it } from '@jest/globals';
import { createDraftSet, parseTemplateDraft } from '../features/templates/templateDraft';

const exercise = { id: 1, name: 'Split squat', muscleGroups: ['Quads'] as const, isCustom: true };

it('round-trips optional targets and separate right-side targets', () => {
  const planned = {
    targetRepsMin: null,
    targetRepsMax: null,
    targetWeightKg: null,
    isWarmup: true,
    isAmrap: false,
    rightTarget: { targetRepsMin: 6, targetRepsMax: 8, targetWeightKg: 12.5 },
  };
  const parsed = parseTemplateDraft('Legs', [
    { exercise: { ...exercise, muscleGroups: ['Quads'] }, sets: [createDraftSet(7, planned)] },
  ]);
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.exercises[0]!.sets).toEqual([planned]);
});

it('accepts comma decimal weights without turning blank targets into zero', () => {
  const set = { ...createDraftSet(1), weight: '12,5' };
  const parsed = parseTemplateDraft('Legs', [
    { exercise: { ...exercise, muscleGroups: ['Quads'] }, sets: [set] },
  ]);
  expect(parsed.success).toBe(true);
  if (parsed.success)
    expect(parsed.data.exercises[0]!.sets[0]).toMatchObject({
      targetRepsMin: null,
      targetRepsMax: null,
      targetWeightKg: 12.5,
    });
});

it('reports a reversed right-side rep range at the matching form field', () => {
  const set = { ...createDraftSet(1), right: { min: '8', max: '6', weight: '' } };
  const parsed = parseTemplateDraft('Legs', [
    { exercise: { ...exercise, muscleGroups: ['Quads'] }, sets: [set] },
  ]);
  expect(parsed.success).toBe(false);
  if (!parsed.success)
    expect(parsed.error.issues[0]!.path).toEqual([
      'exercises',
      0,
      'sets',
      0,
      'rightTarget',
      'targetRepsMax',
    ]);
});
