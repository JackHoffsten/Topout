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
  let pendingPhoto: { base64: string } | null | undefined;
  return {
    get committed() {
      return committed;
    },
    // undefined explicitly cancels; a photo or null replaces the pending operation.
    replacePendingPhoto(photo: { base64: string } | null | undefined) {
      pendingPhoto = photo;
    },
    async save(
      input: ClimbLogInput,
      photo: { base64: string } | null | undefined,
      onCommitted?: (result: T) => void,
    ) {
      if (photo !== undefined) pendingPhoto = photo;
      const result = id ? await api.updateClimbLog(id, input) : await api.createClimbLog(input);
      id = result.id;
      committed = result;
      onCommitted?.(result);
      if (pendingPhoto !== undefined) {
        try {
          if (pendingPhoto) await api.saveClimbPhoto(id, pendingPhoto.base64);
          else await api.deleteClimbPhoto(id);
          pendingPhoto = undefined;
        } catch (cause) {
          throw new ClimbPhotoSaveError(cause);
        }
      }
      return result;
    },
  };
}
