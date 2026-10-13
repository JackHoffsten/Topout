import { test, expect } from '@jest/globals';
import { createClimbSave } from '../features/climbing/climbSave';
import type { ClimbLogInput } from '@topout/shared';

test('photo failure keeps committed climb identity and retries without creating another climb', async () => {
  let creates = 0;
  const updates: number[] = [];
  let uploads = 0;
  const workflow = createClimbSave({
    createClimbLog: async () => {
      creates++;
      return { id: 42, projectId: 7 };
    },
    updateClimbLog: async (id) => {
      updates.push(id);
      return { id, projectId: 7 };
    },
    saveClimbPhoto: async () => {
      if (++uploads === 1) throw new Error('offline');
    },
    deleteClimbPhoto: async () => {},
  });
  const input = { date: '2026-10-01' } as ClimbLogInput;
  await expect(workflow.save(input, { base64: 'photo' })).rejects.toThrow(
    'The climb was saved, but the photo change was not.',
  );
  expect(workflow.committed).toEqual({ id: 42, projectId: 7 });
  await workflow.save(input, { base64: 'photo' });
  expect(creates).toBe(1);
  expect(updates).toEqual([42]);
  expect(uploads).toBe(2);
});
