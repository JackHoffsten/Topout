import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.').max(256),
  password: z.string().min(1, 'Enter your password.').max(128),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, 'Enter your name.').max(100),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(128)
    .regex(/[a-z]/, 'Add a lowercase letter.')
    .regex(/[A-Z]/, 'Add an uppercase letter.')
    .regex(/[0-9]/, 'Add a number.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;

export const accessSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime({ offset: true }),
});

export const nativeSessionSchema = accessSessionSchema.extend({
  refreshToken: z.string().min(1),
  refreshTokenExpiresAt: z.iso.datetime({ offset: true }),
});

export type AccessSession = z.infer<typeof accessSessionSchema>;

export const csrfSchema = z.object({ csrfToken: z.string().min(1) });
