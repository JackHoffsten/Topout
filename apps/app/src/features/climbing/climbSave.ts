import type { ClimbLogInput } from '@topout/shared';

type CommittedClimb = { id: number; projectId?: number | null };
type ClimbSaveApi<T extends CommittedClimb> = {
  createClimbLog(input: ClimbLogInput): Promise<T>;
  updateClimbLog(id: number, input: ClimbLogInput): Promise<T>;
  saveClimbPhoto(id: number, base64: string): Promise<unknown>;
  deleteClimbPhoto(id: number): Promise<unknown>;
};

export class ClimbPhotoSaveError extends Error {
  constructor(cause: unknown) {
    super('The climb was saved, but the photo change was not. Try saving again.', { cause });
  }
}

// Climb and photo writes commit independently. Retain identity at the first
// commit, even when the second write rejects; edits on retry still update it.
export function createClimbSave<T extends CommittedClimb>(
  api: ClimbSaveApi<T>,
  initialId?: number,
) {
  let id = initialId;
  let committed: T | undefined;
  return {
    get committed() {
      return committed;
    },
    async save(
      input: ClimbLogInput,
      photo: { base64: string } | null | undefined,
      onCommitted?: (result: T) => void,
    ) {
      const result = id ? await api.updateClimbLog(id, input) : await api.createClimbLog(input);
      id = result.id;
      committed = result;
      onCommitted?.(result);
      if (photo !== undefined) {
        try {
          if (photo) await api.saveClimbPhoto(id, photo.base64);
          else await api.deleteClimbPhoto(id);
        } catch (cause) {
          throw new ClimbPhotoSaveError(cause);
        }
      }
      return result;
    },
  };
}
