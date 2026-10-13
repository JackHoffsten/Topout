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
  await workflow.save(input, undefined);
  expect(creates).toBe(1);
  expect(updates).toEqual([42]);
  expect(uploads).toBe(2);
});

test('failed photo deletion is retried without resupplying it and cleared after success', async () => {
  let deletions = 0;
  const workflow = createClimbSave(
    {
      createClimbLog: async () => ({ id: 42 }),
      updateClimbLog: async (id) => ({ id }),
      saveClimbPhoto: async () => {},
      deleteClimbPhoto: async () => {
        if (++deletions === 1) throw new Error('offline');
      },
    },
    42,
  );
  const input = { date: '2026-10-01' } as ClimbLogInput;
  await expect(workflow.save(input, null)).rejects.toThrow('photo change was not');
  await workflow.save(input, undefined);
  await workflow.save(input, undefined);
  expect(deletions).toBe(2);
});

test.each(['upload', 'deletion'] as const)(
  'pending %s can be cancelled explicitly',
  async (operation) => {
    let changes = 0;
    const failPhoto = async () => {
      changes++;
      throw new Error('offline');
    };
    const workflow = createClimbSave({
      createClimbLog: async () => ({ id: 42 }),
      updateClimbLog: async (id) => ({ id }),
      saveClimbPhoto: failPhoto,
      deleteClimbPhoto: failPhoto,
    });
    const input = { date: '2026-10-01' } as ClimbLogInput;
    await expect(
      workflow.save(input, operation === 'upload' ? { base64: 'photo' } : null),
    ).rejects.toThrow('photo change was not');
    workflow.replacePendingPhoto(undefined);
    await workflow.save(input, undefined);
    expect(changes).toBe(1);
  },
);

test('a pending upload can be replaced by a different photo', async () => {
  const uploads: string[] = [];
  const workflow = createClimbSave({
    createClimbLog: async () => ({ id: 42 }),
    updateClimbLog: async (id) => ({ id }),
    saveClimbPhoto: async (_id, base64) => {
      uploads.push(base64);
      if (base64 === 'old') throw new Error('offline');
    },
    deleteClimbPhoto: async () => {},
  });
  const input = { date: '2026-10-01' } as ClimbLogInput;
  await expect(workflow.save(input, { base64: 'old' })).rejects.toThrow('photo change was not');
  workflow.replacePendingPhoto({ base64: 'new' });
  await workflow.save(input, undefined);
  await workflow.save(input, undefined);
  expect(uploads).toEqual(['old', 'new']);
});
