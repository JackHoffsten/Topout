import { z } from 'zod';

export const climbPhotoSchema = z.object({
  base64: z.string().min(1).max(2796204),
  width: z.number().int().min(1).max(1600),
  height: z.number().int().min(1).max(1600),
});
